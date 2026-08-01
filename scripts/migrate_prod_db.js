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

// Auto-load .env.prod if present and process.env.MONGODB_URI is not explicitly provided
let envProdUri = '';
const envProdPath = path.join(__dirname, '../.env.prod');
if (fs.existsSync(envProdPath)) {
  const content = fs.readFileSync(envProdPath, 'utf8');
  const match = content.match(/^MONGODB_URI=(.+)$/m);
  if (match) {
    envProdUri = match[1].trim();
  }
}

const MONGODB_URI = process.env.MONGODB_URI || envProdUri || 'mongodb://127.0.0.1:27017/analytics_db';
const TARGET_APP_ID = process.env.TARGET_APP_ID || '4d9f0164-38f3-4e0e-b55a-180132ebfb70';
const BACKUP_FILE = path.join(__dirname, '../analytics_backup_2026-07-25T22-36-20-582Z.json');

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

async function runProductionMigration() {
  try {
    const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
    console.log(`🔌 Connecting to Production MongoDB Database: ${maskedUri}...`);
    console.log(`🎯 Target App Tenant ID: ${TARGET_APP_ID}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully.');

    const shouldRestoreBackup = process.argv.includes('--restore-backup') || process.env.RESTORE_BACKUP === 'true';

    if (shouldRestoreBackup && fs.existsSync(BACKUP_FILE)) {
      console.log(`📦 --restore-backup flag detected: Overwriting production DB with 95 clean backup records & exact captured timestamps...`);
      const rawData = fs.readFileSync(BACKUP_FILE, 'utf8');
      const rawVisits = JSON.parse(rawData);

      await PageVisit.deleteMany({});
      const localhostIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];
      const nonLocalVisits = rawVisits.filter(item => item.ip && !localhostIPs.includes(item.ip) && !item.ip.startsWith('::ffff:127.0.0.1'));

      const cleanVisits = nonLocalVisits.map((item) => {
        const visitPath = item.path || '/';
        const userAgent = item.userAgent || '';
        const analysis = analyzeRequestTraffic(visitPath, userAgent);
        const deviceType = item.deviceType || (analysis.trafficCategory === 'Bot' ? 'Bot' : detectDeviceType(userAgent));
        const browser = item.browser || detectBrowser(userAgent);
        const exactTime = item.timestamp ? new Date(item.timestamp) : new Date();
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
          timestamp: exactTime,
          createdAt: item.createdAt ? new Date(item.createdAt) : exactTime,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : exactTime,
        };
      });

      const inserted = await PageVisit.insertMany(cleanVisits);
      console.log(`✅ Restored ${inserted.length} clean visits with geolocation & exact captured timestamps to production DB!`);
    } else {
      // Standard In-Place Migration on existing DB records
      console.log('🧹 Analyzing IP addresses to sanitize dual-IP strings and remove 51.211.242.147 / localhost proxy entries...');
      const allVisits = await PageVisit.find().lean();
      let deletedIpCount = 0;
      let sanitizedDualIpCount = 0;
      const deleteIds = [];
      const ipUpdateOps = [];

      for (const visit of allVisits) {
        const cleanIp = sanitizeIpString(visit.ip);
        if (!cleanIp) {
          deleteIds.push(visit._id);
        } else if (cleanIp !== visit.ip) {
          sanitizedDualIpCount++;
          ipUpdateOps.push({
            updateOne: {
              filter: { _id: visit._id },
              update: { $set: { ip: cleanIp } }
            }
          });
        }
      }

      if (deleteIds.length > 0) {
        const delRes = await PageVisit.deleteMany({ _id: { $in: deleteIds } });
        deletedIpCount = delRes.deletedCount || deleteIds.length;
      }

      if (ipUpdateOps.length > 0) {
        await PageVisit.bulkWrite(ipUpdateOps);
      }

      console.log(`🧹 Purged ${deletedIpCount} entries with sole proxy IP (51.211.242.147 / localhost).`);
      console.log(`✨ Sanitized ${sanitizedDualIpCount} dual/multi IP strings (removed proxy IP 51.211.242.147 and extracted true client IP).`);

      // Sync siteId fallback assignment
      const syncSiteIdResult = await PageVisit.updateMany(
        { $or: [{ siteId: { $exists: false } }, { siteId: '' }, { siteId: 'default' }, { siteId: '7ec6a37d-0079-432b-84ba-27b766a5c94c' }] },
        { $set: { siteId: TARGET_APP_ID } }
      );
      if (syncSiteIdResult.modifiedCount > 0) {
        console.log(`📌 Synced ${syncSiteIdResult.modifiedCount} records to Production App Tenant ID: ${TARGET_APP_ID}`);
      }

      // Run Traffic & Security Threat Classification & Geolocation Backfill
      const remainingVisits = await PageVisit.find().lean();
      console.log(`🔍 Classifying traffic categories, threat vectors & geolocation for ${remainingVisits.length} production visit records...`);

      let updatedCount = 0;
      const bulkOps = [];

      for (const visit of remainingVisits) {
        const visitPath = visit.path || '/';
        const userAgent = visit.userAgent || '';
        const analysis = analyzeRequestTraffic(visitPath, userAgent);
        const geo = lookupGeoLocation(visit.ip);

        const setObj = {};
        if (visit.trafficCategory !== analysis.trafficCategory) setObj.trafficCategory = analysis.trafficCategory;
        if (visit.threatType !== analysis.threatType) setObj.threatType = analysis.threatType;
        if (visit.threatSeverity !== analysis.threatSeverity) setObj.threatSeverity = analysis.threatSeverity;
        if (visit.threatReason !== analysis.threatReason) setObj.threatReason = analysis.threatReason;

        if (!visit.country || visit.country === 'Unknown') setObj.country = geo.country;
        if (!visit.countryCode) setObj.countryCode = geo.countryCode;
        if (!visit.region) setObj.region = geo.region;
        if (!visit.city) setObj.city = geo.city;

        if (!visit.timestamp && visit.createdAt) {
          setObj.timestamp = visit.createdAt;
        }

        if (Object.keys(setObj).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { _id: visit._id },
              update: { $set: setObj }
            }
          });
        }
      }

      if (bulkOps.length > 0) {
        const bulkRes = await PageVisit.bulkWrite(bulkOps);
        updatedCount = bulkRes.modifiedCount || bulkOps.length;
      }
      console.log(`✅ Backfilled & updated ${updatedCount} visit records with security classification & geolocation metadata.`);
    }

    // Step 4: Ensure Tenant App Registration
    await RegisteredApp.findOneAndUpdate(
      { siteId: TARGET_APP_ID },
      {
        siteId: TARGET_APP_ID,
        name: 'ConsoleAPI Products (Production)',
        domain: 'https://products.consoleapi.in',
        description: 'Production App Tenant',
        status: 'active',
      },
      { upsert: true, new: true }
    );
    console.log(`✅ RegisteredApp tenant record verified for ${TARGET_APP_ID}.`);

    // Step 5: Final Summary Breakdown
    const genuineCount = await PageVisit.countDocuments({ trafficCategory: 'Genuine' });
    const botCount = await PageVisit.countDocuments({ trafficCategory: 'Bot' });
    const threatCount = await PageVisit.countDocuments({ trafficCategory: 'Threat' });
    const totalRemaining = await PageVisit.countDocuments();

    console.log(`\n======================================================`);
    console.log(`📊 PRODUCTION DATABASE MIGRATION SUMMARY REPORT:`);
    console.log(`======================================================`);
    console.log(`   - Target App Tenant ID:          ${TARGET_APP_ID}`);
    console.log(`   - Total Clean Production Visits: ${totalRemaining}`);
    console.log(`   - Genuine User Visits:           ${genuineCount}`);
    console.log(`   - Search Engine Bot Crawls:      ${botCount}`);
    console.log(`   - Security Threat Probes:        ${threatCount}`);
    console.log(`======================================================\n`);

    await mongoose.disconnect();
    console.log('✨ Production Database Migration successfully completed!');
  } catch (err) {
    console.error('❌ Migration Error:', err);
    process.exit(1);
  }
}

runProductionMigration();
