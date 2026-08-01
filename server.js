try {
  require('dotenv').config();
} catch (e) {
  // Safe fallback if dotenv module is not installed in production environment
}
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const PageVisit = require('./models/PageVisit');
const RegisteredApp = require('./models/RegisteredApp');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics_db';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Enable CORS for cross-origin analytics tracking beacons
app.use(cors({
  origin: (origin, callback) => {
    // If no origin (e.g. same-origin, curl, server-to-server) or wildcard configured, reflect request origin
    if (!origin || CORS_ORIGIN === '*') {
      return callback(null, origin || '*');
    }
    const allowed = CORS_ORIGIN.split(',').map(o => o.trim());
    if (allowed.includes(origin)) {
      return callback(null, origin);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'site-id']
}));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static SDK files
const publicFolder = path.join(__dirname, 'public');
app.use(express.static(publicFolder));

// Database connection
async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      autoIndex: NODE_ENV !== 'production',
    };
    await mongoose.connect(MONGODB_URI, options);
    console.log(`✅ [${NODE_ENV.toUpperCase()}] Connected to MongoDB Analytics DB successfully.`);
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
  }
}
connectToDatabase();

function detectDeviceType(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|crawling/i.test(ua)) return 'Bot';
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'Tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

function detectBrowser(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('firefox')) return 'Firefox';
  return 'Other';
}

async function analyzeRequestTraffic(visitPath = '', userAgent = '', ip = '', timestamp = new Date(), siteId = 'default') {
  let trafficCategory = 'Genuine';
  let threatType = 'None';
  let threatSeverity = 'Low';
  let threatReason = '';

  const pathLower = (visitPath || '').toLowerCase();
  const uaLower = (userAgent || '').toLowerCase();

  // 1. Check for vulnerability probing patterns (sensitive configuration files, admin probes, canary URLs, env files)
  const vulnProbePatterns = [
    { pattern: /\/\.env/i, reason: 'Probing sensitive environment variables (.env)' },
    { pattern: /\/\.git/i, reason: 'Probing exposed .git repository' },
    { pattern: /\/etc\/ssl/i, reason: 'Probing SSL private keys directory (/etc/ssl)' },
    { pattern: /\/actuator/i, reason: 'Spring Boot Actuator endpoint exposure scan' },
    { pattern: /\/server-status/i, reason: 'Apache / Server Status page probing' },
    { pattern: /\/_vti_pvt/i, reason: 'FrontPage Server Extensions private file probe' },
    { pattern: /\/telescope/i, reason: 'Laravel Telescope debug route probe' },
    { pattern: /\/debug\/default\/view/i, reason: 'Yii/Framework debug console probe' },
    { pattern: /zzcanary/i, reason: 'Automated vulnerability scanner canary probe' },
    { pattern: /\/(wp-config|wp-admin|wp-content|xmlrpc\.php)/i, reason: 'WordPress admin / vulnerability scanner' },
    { pattern: /\/(phpmyadmin|pma|adminer|dbadmin)/i, reason: 'Database administration portal probe' },
    { pattern: /\/(eval-|eval\(|shell\.php|cmd\.php|c99\.php)/i, reason: 'Webshell / Remote Code Execution probe' },
    { pattern: /\.(bak|sql|tar|gz|zip|config|key|pem|env)$/i, reason: 'Backup or secret credential file probe' },
    { pattern: /\/server$/i, reason: 'Internal server route enumeration scan' }
  ];

  for (const item of vulnProbePatterns) {
    if (item.pattern.test(visitPath)) {
      trafficCategory = 'Threat';
      threatType = 'Vulnerability Probe';
      threatSeverity = 'Critical';
      threatReason = item.reason;
      return { trafficCategory, threatType, threatSeverity, threatReason };
    }
  }

  // 2. Check for Path Traversal & Injection Attempts
  const injectionPatterns = [
    { pattern: /(\.\.\/|\.\.%2f|%2e%2e%2f)/i, reason: 'Directory Path Traversal attack pattern (../)' },
    { pattern: /(union\s+select|select\s+.*\s+from|drop\s+table|insert\s+into|exec\s*\(|or\s+1=1)/i, reason: 'SQL Injection attack payload' },
    { pattern: /(<script|javascript:|onerror\s*=|onload\s*=)/i, reason: 'Cross-Site Scripting (XSS) payload' }
  ];

  for (const item of injectionPatterns) {
    if (item.pattern.test(visitPath)) {
      trafficCategory = 'Threat';
      threatType = 'Path Traversal';
      threatSeverity = 'High';
      threatReason = item.reason;
      return { trafficCategory, threatType, threatSeverity, threatReason };
    }
  }

  // 3. Check User-Agent for known malicious security scanners
  const maliciousScannerUAs = [/sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i, /gobuster/i, /dirbuster/i, /wpscan/i, /nessus/i, /openvas/i, /censys/i];
  if (maliciousScannerUAs.some(rx => rx.test(uaLower))) {
    trafficCategory = 'Threat';
    threatType = 'Suspicious Scanner';
    threatSeverity = 'High';
    threatReason = 'Malicious security scanner / automated reconnaissance user-agent';
    return { trafficCategory, threatType, threatSeverity, threatReason };
  }

  // 4. Rate Burst / DDoS Attack Detection (IP rate check in past 10 seconds)
  if (ip) {
    const tenSecAgo = new Date(Date.now() - 10000);
    const recentRequestsFromIpCount = await PageVisit.countDocuments({
      ip,
      timestamp: { $gte: tenSecAgo }
    });
    if (recentRequestsFromIpCount >= 5) {
      trafficCategory = 'Threat';
      threatType = 'DDoS Burst';
      threatSeverity = 'Critical';
      threatReason = `DDoS burst traffic detected (${recentRequestsFromIpCount + 1} req/10s from IP ${ip})`;
      return { trafficCategory, threatType, threatSeverity, threatReason };
    }
  }

  // 5. Check if Standard Bot / Crawler
  if (/bot|crawler|spider|crawling|slurp|seek|mediapartners|googlebot|bingbot|yandexbot|duckduckbot/i.test(uaLower)) {
    trafficCategory = 'Bot';
    threatType = 'None';
    threatSeverity = 'Low';
    threatReason = 'Search engine crawler or benign web spider';
    return { trafficCategory, threatType, threatSeverity, threatReason };
  }

  return { trafficCategory, threatType, threatSeverity, threatReason };
}

const geoip = require('geoip-lite');
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function lookupGeoLocation(ip) {
  if (!ip) return { country: 'Unknown', countryCode: '', region: '', city: '' };
  try {
    const geo = geoip.lookup(ip);
    if (!geo || !geo.country) return { country: 'Unknown', countryCode: '', region: '', city: '' };
    let countryName = geo.country;
    try {
      countryName = regionNames.of(geo.country) || geo.country;
    } catch (e) {
      countryName = geo.country;
    }
    return {
      country: countryName,
      countryCode: geo.country,
      region: geo.region || '',
      city: geo.city || ''
    };
  } catch (err) {
    return { country: 'Unknown', countryCode: '', region: '', city: '' };
  }
}

function sanitizeIpString(rawIp = '') {
  if (!rawIp) return '';
  const ignoredIPs = ['51.211.242.147', '127.0.0.1', '::1', 'localhost'];
  const parts = rawIp.split(',').map(p => p.trim()).filter(Boolean);
  const cleanParts = parts.filter(ip => 
    !ignoredIPs.includes(ip) &&
    !ip.startsWith('::ffff:127.0.0.1')
  );
  return cleanParts.length > 0 ? cleanParts[0] : '';
}

async function recordVisit(data) {
  try {
    const { siteId = 'default', path: visitPath, fullUrl, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, userAgent, ip: rawIp } = data;
    if (!visitPath || visitPath.startsWith('/api')) {
      return;
    }
    const cleanIp = sanitizeIpString(rawIp);
    // Reject if no valid client IP remains (e.g. sole proxy IP 51.211.242.147 or localhost)
    if (!cleanIp) {
      return;
    }
    // Only skip standard static web media assets (css, js, images, fonts)
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)$/i.test(visitPath)) {
      return;
    }

    await connectToDatabase();

    // Deduplication check: same IP + path + siteId within 3 seconds
    const threeSecAgo = new Date(Date.now() - 3000);
    const existing = await PageVisit.findOne({
      siteId,
      ip: cleanIp,
      path: visitPath,
      timestamp: { $gte: threeSecAgo },
    });

    if (existing) return;

    const analysis = await analyzeRequestTraffic(visitPath, userAgent, cleanIp, new Date(), siteId);
    const deviceType = analysis.trafficCategory === 'Bot' ? 'Bot' : detectDeviceType(userAgent);
    const browser = detectBrowser(userAgent);
    const geo = lookupGeoLocation(cleanIp);

    await PageVisit.create({
      siteId,
      path: visitPath,
      fullUrl: fullUrl || visitPath,
      referrer: referrer || '',
      utm_source: utm_source || '',
      utm_medium: utm_medium || '',
      utm_campaign: utm_campaign || '',
      utm_content: utm_content || '',
      utm_term: utm_term || '',
      userAgent: userAgent || '',
      ip: cleanIp || '',
      country: geo.country,
      countryCode: geo.countryCode,
      region: geo.region,
      city: geo.city,
      deviceType,
      browser,
      trafficCategory: analysis.trafficCategory,
      threatType: analysis.threatType,
      threatSeverity: analysis.threatSeverity,
      threatReason: analysis.threatReason,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Error recording page visit:", err.message);
  }
}

/* ==========================================
   API ENDPOINTS
   ========================================== */

// 1. Ingestion Endpoint (Public Tracking Beacon - No Auth Required)
app.post('/api/analytics/visit', async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp;

    await recordVisit({
      ...req.body,
      userAgent: req.headers['user-agent'] || '',
      ip,
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ==========================================
   ADMIN AUTHENTICATION & AUTHORIZATION SYSTEM
   ========================================== */

const crypto = require('crypto');
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
const AUTH_SECRET = process.env.AUTH_SECRET || 'analytics_secret_token_key_987654321';

const activeTokens = new Set();

function generateAuthToken(username) {
  const payload = `${username}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}.${signature}`).toString('base64');
  activeTokens.add(token);
  return token;
}

function verifyAuthToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [username, timestamp, random, signature] = decoded.split(/[:.]/);
    const payload = `${username}:${timestamp}:${random}`;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
    if (signature === expectedSig && activeTokens.has(token)) {
      return { username };
    }
  } catch (e) {
    return false;
  }
  return false;
}

// 1. Admin Login Endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateAuthToken(username);
    res.cookie('analytics_admin_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    return res.json({
      success: true,
      token,
      user: { username: ADMIN_USER, role: 'administrator' }
    });
  }
  return res.status(401).json({ success: false, error: 'Invalid admin username or password.' });
});

// 2. Admin Logout Endpoint
app.post('/api/admin/logout', (req, res) => {
  const token = req.headers.authorization?.substring(7) || req.cookies?.analytics_admin_token;
  if (token) activeTokens.delete(token);
  res.clearCookie('analytics_admin_token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 3. Admin Check Me Endpoint
app.get('/api/admin/me', (req, res) => {
  const token = req.headers.authorization?.substring(7) || req.cookies?.analytics_admin_token;
  const user = verifyAuthToken(token);
  if (user) {
    return res.json({ success: true, user: { username: user.username, role: 'administrator' } });
  }
  return res.status(401).json({ success: false, authenticated: false });
});

// Admin Authorization Middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.analytics_admin_token) {
    token = req.cookies.analytics_admin_token;
  }

  const user = verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Admin authentication required.' });
  }

  req.adminUser = user;
  next();
}

// Protect all remaining /api/admin/* endpoints
app.use('/api/admin', requireAdminAuth);

// 2. Admin Analytics Query Endpoint
app.get('/api/admin/analytics', async (req, res) => {
  try {
    await connectToDatabase();
    const { siteId } = req.query;

    const filter = {
      ip: { $nin: ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'] }
    };
    if (siteId && siteId !== 'all') {
      filter.siteId = siteId;
    }

    const totalVisits = await PageVisit.countDocuments(filter);
    const uniqueVisitorsArray = await PageVisit.distinct('ip', filter);
    const uniqueVisitors = uniqueVisitorsArray.filter(Boolean).length || (totalVisits > 0 ? 1 : 0);

    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayFilter = { ...filter, timestamp: { $gte: past24h } };
    const todayVisits = await PageVisit.countDocuments(todayFilter);

    // List of distinct projects
    const availableSites = await PageVisit.distinct('siteId');

    // Traffic Classification Analysis (Genuine vs Bot vs Threat)
    const trafficAgg = await PageVisit.aggregate([
      { $match: filter },
      { $group: { _id: "$trafficCategory", count: { $sum: 1 } } }
    ]);

    const trafficBreakdown = { Genuine: 0, Bot: 0, Threat: 0 };
    trafficAgg.forEach((t) => {
      const categoryKey = t._id || 'Genuine';
      if (trafficBreakdown.hasOwnProperty(categoryKey)) {
        trafficBreakdown[categoryKey] = t.count;
      }
    });

    const threatsCount = trafficBreakdown.Threat || 0;

    // Critical Security Threats & Probes (Top recent 20)
    const criticalAlerts = await PageVisit.find({ ...filter, trafficCategory: 'Threat' })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('siteId path fullUrl referrer deviceType browser ip timestamp trafficCategory threatType threatSeverity threatReason userAgent');

    // Top Probed Threat Paths
    const topThreatPathsAgg = await PageVisit.aggregate([
      { $match: { ...filter, trafficCategory: 'Threat' } },
      { $group: { _id: { path: "$path", threatType: "$threatType", reason: "$threatReason" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const topThreatPaths = topThreatPathsAgg.map(item => ({
      path: item._id.path,
      threatType: item._id.threatType || 'Vulnerability Probe',
      reason: item._id.reason || 'Probing restricted route',
      count: item.count
    }));

    // Top Attacking IPs
    const topThreatIPsAgg = await PageVisit.aggregate([
      { $match: { ...filter, trafficCategory: 'Threat' } },
      { $group: { _id: "$ip", count: { $sum: 1 }, lastThreatType: { $last: "$threatType" } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const topThreatIPs = topThreatIPsAgg.map(item => ({
      ip: item._id || 'Unknown',
      count: item.count,
      lastThreatType: item.lastThreatType || 'Probing Attempt'
    }));

    // Top Pages
    const topPagesAgg = await PageVisit.aggregate([
      { $match: filter },
      { $group: { _id: "$path", count: { $sum: 1 }, lastVisited: { $max: "$timestamp" } } },
      { $sort: { count: -1 } },
      { $limit: 25 }
    ]);

    const topPages = topPagesAgg.map((item) => ({
      path: item._id,
      count: item.count,
      percentage: totalVisits > 0 ? Math.round((item.count / totalVisits) * 100) : 0,
      lastVisited: item.lastVisited,
    }));

    // Top UTM Campaigns & Sources
    const utmCampaignsAgg = await PageVisit.aggregate([
      { $match: { ...filter, utm_source: { $ne: '' } } },
      { $group: { _id: { source: "$utm_source", campaign: "$utm_campaign" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const utmCampaigns = utmCampaignsAgg.map((item) => ({
      source: item._id.source || 'Direct',
      campaign: item._id.campaign || '(not set)',
      count: item.count,
    }));

    // Device breakdown
    const deviceAgg = await PageVisit.aggregate([
      { $match: filter },
      { $group: { _id: "$deviceType", count: { $sum: 1 } } }
    ]);

    const deviceBreakdown = { Desktop: 0, Mobile: 0, Tablet: 0, Bot: 0 };
    deviceAgg.forEach((d) => {
      if (d._id && deviceBreakdown.hasOwnProperty(d._id)) {
        deviceBreakdown[d._id] = d.count;
      }
    });

    // Browser breakdown
    const browserAgg = await PageVisit.aggregate([
      { $match: filter },
      { $group: { _id: "$browser", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const browserBreakdown = browserAgg.map(b => ({ browser: b._id || 'Other', count: b.count }));

    // Referrer breakdown
    const referrerAgg = await PageVisit.aggregate([
      { $match: { ...filter, referrer: { $ne: '' } } },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 25 }
    ]);
    const topReferrers = referrerAgg.map(r => ({ referrer: r._id, count: r.count }));

    // 24-hour hourly trend distribution
    const hourlyDistribution = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 3600 * 1000);
      const end = new Date(now.getTime() - i * 3600 * 1000);
      const hourLabel = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const count = await PageVisit.countDocuments({
        ...filter,
        timestamp: { $gte: start, $lt: end }
      });
      hourlyDistribution.push({ hour: hourLabel, count });
    }

    // Top Countries & Geographic Distribution
    const topCountriesAgg = await PageVisit.aggregate([
      { $match: filter },
      { $group: { _id: { country: "$country", countryCode: "$countryCode" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const topCountries = topCountriesAgg.map(item => ({
      country: item._id.country || 'Unknown',
      countryCode: item._id.countryCode || '',
      count: item.count,
      percentage: totalVisits > 0 ? Math.round((item.count / totalVisits) * 100) : 0,
    }));

    // Recent visits
    const recentVisits = await PageVisit.find(filter)
      .sort({ timestamp: -1 })
      .limit(50)
      .select('siteId path fullUrl referrer utm_source utm_medium utm_campaign deviceType browser ip country countryCode region city timestamp trafficCategory threatType threatSeverity threatReason');

    return res.json({
      success: true,
      data: {
        totalVisits,
        uniqueVisitors,
        todayVisits,
        availableSites,
        trafficBreakdown,
        threatsCount,
        criticalAlerts,
        topThreatPaths,
        topThreatIPs,
        topCountries,
        topPages,
        utmCampaigns,
        deviceBreakdown,
        browserBreakdown,
        topReferrers,
        hourlyDistribution,
        recentVisits,
      }
    });
  } catch (error) {
    console.error("GET /api/admin/analytics Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Full Paginated History Endpoint
app.get('/api/admin/history', async (req, res) => {
  try {
    await connectToDatabase();
    const { siteId, search, device, category, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const filter = {
      ip: { $nin: ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'] }
    };
    if (siteId && siteId !== 'all') {
      filter.siteId = siteId;
    }
    if (device && device !== 'all') {
      filter.deviceType = new RegExp(`^${device}$`, 'i');
    }
    if (category && category !== 'all') {
      filter.trafficCategory = category;
    }
    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { path: regex },
        { siteId: regex },
        { ip: regex },
        { country: regex },
        { city: regex },
        { browser: regex },
        { utm_source: regex },
        { utm_campaign: regex },
        { threatType: regex },
        { threatReason: regex }
      ];
    }

    const totalCount = await PageVisit.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const skip = (pageNum - 1) * limitNum;

    const visits = await PageVisit.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('siteId path fullUrl referrer utm_source utm_medium utm_campaign deviceType browser ip country countryCode region city timestamp trafficCategory threatType threatSeverity threatReason');

    return res.json({
      success: true,
      data: {
        visits,
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages,
      }
    });
  } catch (error) {
    console.error("GET /api/admin/history Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. App Management Endpoints
app.get('/api/admin/apps', async (req, res) => {
  try {
    await connectToDatabase();
    const registered = await RegisteredApp.find().lean();
    const activeSitesFromVisits = await PageVisit.distinct('siteId');

    const appMap = new Map();
    registered.forEach(app => {
      appMap.set(app.siteId, {
        ...app,
        isRegistered: true,
      });
    });

    // Merge any unregistered sites found in traffic logs
    activeSitesFromVisits.forEach(siteId => {
      if (siteId && !appMap.has(siteId)) {
        appMap.set(siteId, {
          siteId,
          name: siteId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          domain: `https://${siteId}.com`,
          description: 'Auto-detected tenant from incoming web traffic',
          status: 'active',
          isRegistered: false,
        });
      }
    });

    const appsList = Array.from(appMap.values());

    // Enrich each app with total visit count and last active timestamp
    const enrichedApps = await Promise.all(
      appsList.map(async (appItem) => {
        const totalVisits = await PageVisit.countDocuments({ siteId: appItem.siteId });
        const lastVisitDoc = await PageVisit.findOne({ siteId: appItem.siteId }).sort({ timestamp: -1 }).select('timestamp');
        return {
          ...appItem,
          totalVisits,
          lastActive: lastVisitDoc ? lastVisitDoc.timestamp : null,
        };
      })
    );

    return res.json({ success: true, data: enrichedApps });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/apps', async (req, res) => {
  try {
    await connectToDatabase();
    const { siteId, name, domain, description } = req.body;
    if (!siteId || !name) {
      return res.status(400).json({ success: false, error: 'Site ID and App Name are required.' });
    }

    const cleanSiteId = siteId.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');
    const existing = await RegisteredApp.findOne({ siteId: cleanSiteId });

    if (existing) {
      existing.name = name;
      existing.domain = domain || existing.domain;
      existing.description = description || existing.description;
      if (req.body.status) existing.status = req.body.status;
      await existing.save();
      return res.json({ success: true, message: `Application ${name} updated successfully!`, data: existing });
    } else {
      const newApp = await RegisteredApp.create({
        siteId: cleanSiteId,
        name,
        domain: domain || `https://${cleanSiteId}.com`,
        description: description || 'Registered application tenant',
        status: req.body.status || 'active',
      });
      return res.json({ success: true, message: `Application ${name} registered successfully!`, data: newApp });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/apps/:siteId', async (req, res) => {
  try {
    await connectToDatabase();
    const { siteId } = req.params;
    await RegisteredApp.deleteOne({ siteId });
    return res.json({ success: true, message: `App ${siteId} unregistered successfully` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Database Export Endpoint (JSON & CSV)
app.get('/api/admin/export', async (req, res) => {
  try {
    await connectToDatabase();
    const { siteId, format = 'json' } = req.query;
    const filter = (siteId && siteId !== 'all') ? { siteId } : {};

    const visits = await PageVisit.find(filter).sort({ timestamp: -1 }).lean();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'csv') {
      const headers = ['_id', 'siteId', 'path', 'fullUrl', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'deviceType', 'browser', 'ip', 'timestamp'];
      let csvContent = headers.join(',') + '\n';

      visits.forEach(v => {
        const row = [
          v._id,
          `"${(v.siteId || '').replace(/"/g, '""')}"`,
          `"${(v.path || '').replace(/"/g, '""')}"`,
          `"${(v.fullUrl || '').replace(/"/g, '""')}"`,
          `"${(v.referrer || '').replace(/"/g, '""')}"`,
          `"${(v.utm_source || '').replace(/"/g, '""')}"`,
          `"${(v.utm_medium || '').replace(/"/g, '""')}"`,
          `"${(v.utm_campaign || '').replace(/"/g, '""')}"`,
          `"${(v.deviceType || '').replace(/"/g, '""')}"`,
          `"${(v.browser || '').replace(/"/g, '""')}"`,
          `"${(v.ip || '').replace(/"/g, '""')}"`,
          `"${v.timestamp ? new Date(v.timestamp).toISOString() : ''}"`,
        ];
        csvContent += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics_export_${timestampStr}.csv`);
      return res.send(csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analytics_export_${timestampStr}.json`);
      return res.send(JSON.stringify(visits, null, 2));
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Database Import Endpoint
app.post('/api/admin/import', async (req, res) => {
  try {
    await connectToDatabase();
    const { visits } = req.body;

    if (!visits || !Array.isArray(visits) || visits.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or empty visits array provided for import.' });
    }

    const cleanVisits = visits.map(v => ({
      siteId: v.siteId || 'default',
      path: v.path || '/',
      fullUrl: v.fullUrl || v.path || '/',
      referrer: v.referrer || '',
      utm_source: v.utm_source || '',
      utm_medium: v.utm_medium || '',
      utm_campaign: v.utm_campaign || '',
      utm_content: v.utm_content || '',
      utm_term: v.utm_term || '',
      deviceType: v.deviceType || detectDeviceType(v.userAgent || ''),
      browser: v.browser || detectBrowser(v.userAgent || ''),
      ip: v.ip || '127.0.0.1',
      userAgent: v.userAgent || 'Imported Visit',
      timestamp: v.timestamp ? new Date(v.timestamp) : new Date(),
    }));

    const result = await PageVisit.insertMany(cleanVisits);
    return res.json({
      success: true,
      message: `Successfully imported ${result.length} page visits into database!`,
      importedCount: result.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. System Info Endpoint
app.get('/api/admin/system', async (req, res) => {
  try {
    await connectToDatabase();
    const totalVisits = await PageVisit.countDocuments();
    const totalApps = await RegisteredApp.countDocuments();

    let totalDocuments = totalVisits + totalApps;
    let collectionsCount = 2;
    try {
      if (mongoose.connection.db) {
        const collections = await mongoose.connection.db.listCollections().toArray();
        collectionsCount = collections.length;
        let sumDocs = 0;
        for (const col of collections) {
          const count = await mongoose.connection.db.collection(col.name).countDocuments();
          sumDocs += count;
        }
        if (sumDocs >= 0) totalDocuments = sumDocs;
      }
    } catch (e) { }

    const dbState = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const memory = process.memoryUsage();

    return res.json({
      success: true,
      data: {
        totalVisits,
        totalVisitsCount: totalVisits,
        totalApps,
        totalDocuments,
        collectionsCount,
        dbState,
        dbConnected: mongoose.connection.readyState === 1,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
        env: process.env.NODE_ENV || 'development',
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Clear Analytics Endpoint
app.delete('/api/admin/analytics', async (req, res) => {
  try {
    await connectToDatabase();
    const { siteId } = req.query;
    const filter = (siteId && siteId !== 'all') ? { siteId } : {};

    const result = await PageVisit.deleteMany(filter);
    return res.json({ success: true, message: `Successfully cleared ${result.deletedCount || 0} analytics records.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// SPA Fallback - Check dist/browser first, then fallback to __dirname root (for flat release deployments)
const fsModule = require('fs');
const angularDistFolder = fsModule.existsSync(path.join(__dirname, 'dist/browser'))
  ? path.join(__dirname, 'dist/browser')
  : fsModule.existsSync(path.join(__dirname, 'index.html'))
    ? __dirname
    : null;

if (angularDistFolder) {
  app.use(express.static(angularDistFolder));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(path.join(angularDistFolder, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Analytics Ingestion Server Running</title></head>
      <body style="font-family:sans-serif; background:#090d16; color:#fff; padding:40px; text-align:center;">
        <h2>Standalone Analytics Platform Active</h2>
        <p>Express Ingestion API & MongoDB Connected. SDK available at <a href="/sdk/analytics.js" style="color:#38bdf8;">/sdk/analytics.js</a></p>
      </body>
      </html>
    `);
  });
}

app.listen(PORT, () => {
  console.log(`Analytics Server listening on http://localhost:${PORT}`);
});
