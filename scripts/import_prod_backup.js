const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const geoip = require('geoip-lite');
const PageVisit = require('../models/PageVisit');
const RegisteredApp = require('../models/RegisteredApp');

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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics_db';
const TARGET_APP_ID = process.env.TARGET_APP_ID || '4d9f0164-38f3-4e0e-b55a-180132ebfb70';
const BACKUP_FILE = path.join(__dirname, '../analytics_backup_2026-07-25T22-36-20-582Z.json');

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

function analyzeRequestTraffic(visitPath = '', userAgent = '') {
  let trafficCategory = 'Genuine';
  let threatType = 'None';
  let threatSeverity = 'Low';
  let threatReason = '';

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

  const uaLower = (userAgent || '').toLowerCase();
  const maliciousScannerUAs = [/sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i, /gobuster/i, /dirbuster/i, /wpscan/i, /nessus/i, /openvas/i, /censys/i];
  if (maliciousScannerUAs.some(rx => rx.test(uaLower))) {
    trafficCategory = 'Threat';
    threatType = 'Suspicious Scanner';
    threatSeverity = 'High';
    threatReason = 'Malicious security scanner / automated reconnaissance user-agent';
    return { trafficCategory, threatType, threatSeverity, threatReason };
  }

  if (/bot|crawler|spider|crawling|slurp|seek|mediapartners|googlebot|bingbot|yandexbot|duckduckbot/i.test(uaLower)) {
    trafficCategory = 'Bot';
    threatType = 'None';
    threatSeverity = 'Low';
    threatReason = 'Search engine crawler or benign web spider';
    return { trafficCategory, threatType, threatSeverity, threatReason };
  }

  return { trafficCategory, threatType, threatSeverity, threatReason };
}

async function importBackupData() {
  try {
    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected.');

    if (!fs.existsSync(BACKUP_FILE)) {
      throw new Error(`Backup file not found at: ${BACKUP_FILE}`);
    }

    const rawData = fs.readFileSync(BACKUP_FILE, 'utf8');
    const rawVisits = JSON.parse(rawData);
    console.log(`📦 Loaded ${rawVisits.length} raw visit records from production backup JSON.`);

    // Clear all existing visit records in local database
    await PageVisit.deleteMany({});
    console.log('🧹 Purged previous visit logs.');

    const localhostIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];
    const nonLocalVisits = rawVisits.filter(item => item.ip && !localhostIPs.includes(item.ip) && !item.ip.startsWith('::ffff:127.0.0.1'));

    console.log(`🧹 Filtered out ${rawVisits.length - nonLocalVisits.length} localhost IP records. Importing ${nonLocalVisits.length} external production records...`);

    const cleanVisits = nonLocalVisits.map((item) => {
      const visitPath = item.path || '/';
      const userAgent = item.userAgent || '';
      const analysis = analyzeRequestTraffic(visitPath, userAgent);
      const deviceType = item.deviceType || (analysis.trafficCategory === 'Bot' ? 'Bot' : detectDeviceType(userAgent));
      const browser = item.browser || detectBrowser(userAgent);
      const geo = lookupGeoLocation(item.ip);

      return {
        siteId: TARGET_APP_ID,
        path: visitPath,
        fullUrl: item.fullUrl || visitPath,
        referrer: item.referrer || '',
        utm_source: item.utm_source || '',
        utm_medium: item.utm_medium || '',
        utm_campaign: item.utm_campaign || '',
        utm_content: item.utm_content || '',
        utm_term: item.utm_term || '',
        userAgent,
        ip: item.ip,
        country: geo.country,
        countryCode: geo.countryCode,
        region: geo.region,
        city: geo.city,
        deviceType,
        browser,
        trafficCategory: item.trafficCategory || analysis.trafficCategory,
        threatType: item.threatType || analysis.threatType,
        threatSeverity: item.threatSeverity || analysis.threatSeverity,
        threatReason: item.threatReason || analysis.threatReason,
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        createdAt: item.createdAt ? new Date(item.createdAt) : (item.timestamp ? new Date(item.timestamp) : new Date()),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : (item.timestamp ? new Date(item.timestamp) : new Date()),
      };
    });

    const inserted = await PageVisit.insertMany(cleanVisits);
    console.log(`✅ Successfully imported ${inserted.length} page visits with geolocation info into local MongoDB!`);

    // Ensure RegisteredApp record is upserted for target siteId
    await RegisteredApp.findOneAndUpdate(
      { siteId: TARGET_APP_ID },
      {
        siteId: TARGET_APP_ID,
        name: 'ConsoleAPI Products (Prod)',
        domain: 'https://products.consoleapi.in',
        description: 'Production App Tenant',
        status: 'active',
      },
      { upsert: true, new: true }
    );

    // Print summary stats
    const genuineCount = await PageVisit.countDocuments({ siteId: TARGET_APP_ID, trafficCategory: 'Genuine' });
    const botCount = await PageVisit.countDocuments({ siteId: TARGET_APP_ID, trafficCategory: 'Bot' });
    const threatCount = await PageVisit.countDocuments({ siteId: TARGET_APP_ID, trafficCategory: 'Threat' });
    console.log(`📊 Import Traffic Analysis Summary:`);
    console.log(`   - Genuine Visits: ${genuineCount}`);
    console.log(`   - Bot Crawls:     ${botCount}`);
    console.log(`   - Threat Probes:  ${threatCount}`);

    await mongoose.disconnect();
    console.log('✨ Data load & sync complete.');
  } catch (err) {
    console.error('❌ Error during backup import:', err);
    process.exit(1);
  }
}

importBackupData();
