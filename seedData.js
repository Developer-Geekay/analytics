const mongoose = require('mongoose');
const PageVisit = require('./models/PageVisit');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics_db?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.9.2';

const sampleVisits = [
  // consoleapi-products visits
  {
    siteId: 'consoleapi-products',
    path: '/',
    fullUrl: 'http://products.consoleapi.in/',
    referrer: 'https://google.com',
    utm_source: 'google',
    utm_medium: 'organic',
    utm_campaign: 'brand_search',
    deviceType: 'Desktop',
    browser: 'Chrome',
    ip: '192.168.1.10',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2)
  },
  {
    siteId: 'consoleapi-products',
    path: '/extensions/outsystems-devtool',
    fullUrl: 'http://products.consoleapi.in/extensions/outsystems-devtool?utm_source=twitter&utm_medium=social&utm_campaign=v3_release',
    referrer: 'https://t.co',
    utm_source: 'twitter',
    utm_medium: 'social',
    utm_campaign: 'v3_release',
    deviceType: 'Mobile',
    browser: 'Safari',
    ip: '192.168.1.11',
    timestamp: new Date(Date.now() - 3600 * 1000 * 1)
  },
  {
    siteId: 'consoleapi-products',
    path: '/app/hostpanel',
    fullUrl: 'http://products.consoleapi.in/app/hostpanel?utm_source=newsletter&utm_medium=email&utm_campaign=july_digest',
    referrer: 'https://mail.google.com',
    utm_source: 'newsletter',
    utm_medium: 'email',
    utm_campaign: 'july_digest',
    deviceType: 'Desktop',
    browser: 'Firefox',
    ip: '192.168.1.12',
    timestamp: new Date(Date.now() - 1800 * 1000)
  },
  {
    siteId: 'consoleapi-products',
    path: '/app/tripwire',
    fullUrl: 'http://products.consoleapi.in/app/tripwire?utm_source=github&utm_medium=referral&utm_campaign=readme_link',
    referrer: 'https://github.com',
    utm_source: 'github',
    utm_medium: 'referral',
    utm_campaign: 'readme_link',
    deviceType: 'Desktop',
    browser: 'Chrome',
    ip: '192.168.1.13',
    timestamp: new Date(Date.now() - 900 * 1000)
  },
  // outsystems-devtool standalone extension visits
  {
    siteId: 'outsystems-devtool',
    path: '/',
    fullUrl: 'chrome-extension://lnpjlokgoheakkfofcjbnkckmdnninbb/index.html',
    referrer: '',
    utm_source: 'chrome_store',
    utm_medium: 'extension_popup',
    utm_campaign: 'installed_users',
    deviceType: 'Desktop',
    browser: 'Chrome',
    ip: '192.168.1.14',
    timestamp: new Date(Date.now() - 600 * 1000)
  },
  {
    siteId: 'outsystems-devtool',
    path: '/devtools/network-tab',
    fullUrl: 'chrome-extension://lnpjlokgoheakkfofcjbnkckmdnninbb/devtools.html',
    referrer: '',
    utm_source: 'devtools_panel',
    utm_medium: 'internal',
    utm_campaign: 'developer_usage',
    deviceType: 'Desktop',
    browser: 'Chrome',
    ip: '192.168.1.14',
    timestamp: new Date(Date.now() - 300 * 1000)
  },
  // hostpanel site visits
  {
    siteId: 'hostpanel',
    path: '/dashboard',
    fullUrl: 'http://hostpanel.consoleapi.in/dashboard',
    referrer: 'https://consoleapi.in',
    utm_source: 'consoleapi_hub',
    utm_medium: 'navigation',
    utm_campaign: 'cross_nav',
    deviceType: 'Desktop',
    browser: 'Edge',
    ip: '192.168.1.15',
    timestamp: new Date()
  }
];

async function seedDatabase() {
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("Database connected successfully.");

    const count = await PageVisit.countDocuments();
    if (count > 0) {
      console.log(`Database already contains ${count} page visit records. Cleaning previous sample data...`);
      await PageVisit.deleteMany({ siteId: { $in: ['consoleapi-products', 'outsystems-devtool', 'hostpanel'] } });
    }

    console.log("Seeding initial analytics data & UTM campaign metrics...");
    await PageVisit.insertMany(sampleVisits);
    console.log(`Successfully seeded ${sampleVisits.length} sample page visit records across multi-tenant site IDs!`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB. Migration & Seed complete.");
  } catch (err) {
    console.error("Migration / Seed Error:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, sampleVisits };
