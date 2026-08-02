# Standalone Analytics & Security Intelligence Platform — Master AI Integration Guide

> **System Prompt & Reference Manual for AI Models & Developers**
> 
> This document provides a complete, self-contained reference guide for integrating, configuring, querying, and deploying the Analytics & Security Intelligence Platform. It contains all SDK specifications, framework implementation guides, REST API endpoint schemas, threat intelligence pipeline rules, and production deployment scripts.

---

## 1. Platform Overview & Core Architecture

The **Analytics & Security Intelligence Platform** is a high-performance, multi-tenant web analytics and threat detection system engineered with Node.js, Express, MongoDB, and Angular 21.

### Architectural Highlights
- **Zero-Dependency SDK (`analytics.js`)**: Ultra-lightweight (`<1.5KB` minified). Runs natively in all browsers without external dependencies.
- **Non-Blocking Transport**: Dispatches tracking signals asynchronously via `navigator.sendBeacon()`, falling back seamlessly to `fetch()` with `{ keepalive: true }`.
- **Multi-Tenant Isolation**: Supports unlimited isolated application profiles identified by auto-generated UUID v4 Tenant IDs (`siteId`).
- **Automated SPA Navigation**: Hooks into `history.pushState` and listens for `popstate` events to track Single Page Application route transitions automatically.
- **Real-Time GeoIP & Device Intelligence**: Automatically maps client IP addresses to countries, regions, and cities via `geoip-lite`, and classifies user-agents into Device Types (`Desktop`, `Mobile`, `Tablet`, `Bot`) and Browsers (`Chrome`, `Safari`, `Firefox`, `Edge`).
- **Automated Threat Intelligence Pipeline**: Evaluates incoming requests against vulnerability probe patterns, injection signatures, malicious security scanners, and high-frequency DDoS rate bursts in real time.
- **UTM Marketing Attribution**: Extracts `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` query parameters from page URLs.

---

## 2. SDK Configuration & HTML Integration

### 2.1 Quick Start HTML Script Tag

Paste the script tag directly before the closing `</head>` tag of your HTML pages:

```html
<script 
  src="https://analytics.yourdomain.com/sdk/analytics.js" 
  data-site-id="YOUR_APP_TENANT_UUID" 
  data-host="https://analytics.yourdomain.com"
  data-auto-track="true" 
  async>
</script>
```

### 2.2 Script Tag Configuration Attributes

| Attribute | Type | Default | Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| `data-site-id` | String | `'default'` | **Yes** | Your unique UUID v4 App Tenant ID. |
| `data-host` | String | Script Origin | No | Origin URL of your analytics server (e.g. `https://analytics.yourdomain.com`). |
| `data-endpoint` | String | `'/api/analytics/visit'` | No | Custom API ingestion endpoint path. |
| `data-auto-track` | Boolean | `true` | No | Set to `"false"` to disable automated initial page load and SPA history tracking. |

### 2.3 Programmatic JavaScript SDK API (`window.AnalyticsSDK`)

If `data-auto-track="false"` is set or custom virtual page views need to be tracked programmatically, use the global `window.AnalyticsSDK` object:

```javascript
// 1. Programmatically initialize SDK configuration
window.AnalyticsSDK.init({
  siteId: 'YOUR_APP_TENANT_UUID',
  endpoint: 'https://analytics.yourdomain.com/api/analytics/visit'
});

// 2. Manually trigger a page visit record with custom payload attributes
window.AnalyticsSDK.trackVisit('/dashboard/checkout', {
  utm_source: 'newsletter',
  utm_medium: 'email',
  utm_campaign: 'summer_sale_2026',
  utm_content: 'hero_cta',
  utm_term: 'analytics_software',
  user_plan: 'enterprise'
});
```

---

## 3. Comprehensive Framework Integration Guides

### 3.1 React & React Router (SPA Hook)

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useAnalytics(siteId: string = 'YOUR_APP_TENANT_UUID') {
  const location = useLocation();

  useEffect(() => {
    const payload = {
      siteId,
      path: location.pathname + location.search,
      fullUrl: window.location.href,
      referrer: document.referrer || ''
    };

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('https://analytics.yourdomain.com/api/analytics/visit', blob);
    } else {
      fetch('https://analytics.yourdomain.com/api/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  }, [location, siteId]);
}
```

### 3.2 Next.js 13+ (App Router & Pages Router)

```tsx
// components/AnalyticsScript.tsx
'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsScript({ siteId = 'YOUR_APP_TENANT_UUID' }: { siteId?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).AnalyticsSDK) {
      const fullPath = pathname + (searchParams?.toString() ? '?' + searchParams.toString() : '');
      (window as any).AnalyticsSDK.trackVisit(fullPath);
    }
  }, [pathname, searchParams]);

  return (
    <Script
      src="https://analytics.yourdomain.com/sdk/analytics.js"
      data-site-id={siteId}
      data-host="https://analytics.yourdomain.com"
      strategy="afterInteractive"
    />
  );
}
```

### 3.3 Angular Injectable Service

```typescript
import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackingService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private siteId = 'YOUR_APP_TENANT_UUID';
  private endpoint = 'https://analytics.yourdomain.com/api/analytics/visit';

  init(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.http.post(this.endpoint, {
        siteId: this.siteId,
        path: event.urlAfterRedirects,
        fullUrl: window.location.href,
        referrer: document.referrer || ''
      }).subscribe({ error: () => {} });
    });
  }
}
```

### 3.4 Vue.js 3 & Nuxt 3 Router Navigation Guard

```javascript
// router/index.js (Vue 3 / Nuxt 3 Client Plugin)
export function setupAnalytics(router, siteId = 'YOUR_APP_TENANT_UUID') {
  router.afterEach((to) => {
    const payload = {
      siteId,
      path: to.fullPath,
      fullUrl: window.location.origin + to.fullPath,
      referrer: document.referrer || ''
    };

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('https://analytics.yourdomain.com/api/analytics/visit', blob);
    } else {
      fetch('https://analytics.yourdomain.com/api/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  });
}
```

### 3.5 Svelte & SvelteKit Integration

```svelte
<!-- +layout.svelte -->
<script>
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  export let siteId = 'YOUR_APP_TENANT_UUID';

  $: if (browser && $page.url) {
    const payload = {
      siteId,
      path: $page.url.pathname + $page.url.search,
      fullUrl: $page.url.href,
      referrer: document.referrer || ''
    };

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('https://analytics.yourdomain.com/api/analytics/visit', blob);
    } else {
      fetch('https://analytics.yourdomain.com/api/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  }
</script>
```

### 3.6 Node.js & Express Server-Side Middleware

```javascript
// middleware/analytics.js
const analyticsMiddleware = (siteId = 'YOUR_APP_TENANT_UUID') => {
  return (req, res, next) => {
    // Exclude static assets and health check routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/static') && !req.path.match(/\.(css|js|png|jpg|ico|svg)$/)) {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      
      fetch('https://analytics.yourdomain.com/api/analytics/visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': req.headers['user-agent'] || '',
          'X-Forwarded-For': Array.isArray(clientIp) ? clientIp[0] : clientIp
        },
        body: JSON.stringify({
          siteId,
          path: req.originalUrl || req.path,
          fullUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          referrer: req.headers['referer'] || ''
        })
      }).catch(err => console.error('Analytics middleware dispatch error:', err.message));
    }
    next();
  };
};

module.exports = analyticsMiddleware;
```

### 3.7 Python (Flask / FastAPI / Django) Integration

```python
import requests
from flask import request

ANALYTICS_ENDPOINT = "https://analytics.yourdomain.com/api/analytics/visit"
SITE_ID = "YOUR_APP_TENANT_UUID"

def track_page_visit(path_override=None):
    try:
        payload = {
            "siteId": SITE_ID,
            "path": path_override or request.path,
            "fullUrl": request.url,
            "referrer": request.referrer or ""
        }
        headers = {
            "User-Agent": request.headers.get("User-Agent", ""),
            "X-Forwarded-For": request.remote_addr
        }
        requests.post(ANALYTICS_ENDPOINT, json=payload, headers=headers, timeout=2)
    except Exception as e:
        print(f"Analytics logging error: {e}")
```

---

## 4. Complete REST API Reference

### 4.1 Ingestion Beacon Endpoint: `POST /api/analytics/visit`

Public beacon ingestion endpoint. No authentication required.

#### Request Headers
- `Content-Type: application/json`
- `User-Agent`: Optional browser user-agent header.
- `X-Forwarded-For`: Optional client IP override header.

#### JSON Request Body Schema
```json
{
  "siteId": "YOUR_APP_TENANT_UUID",
  "path": "/products/laptop-pro",
  "fullUrl": "https://mystore.com/products/laptop-pro?utm_source=newsletter&utm_medium=email&utm_campaign=summer_sale",
  "referrer": "https://google.com",
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "summer_sale",
  "utm_content": "hero_cta",
  "utm_term": "laptops"
}
```

#### Ingestion Engine Features
1. **Deduplication Engine**: Drops consecutive duplicate visits from the same IP + path + siteId within 3 seconds.
2. **Static Asset Filter**: Skips requests to static media extensions (`.css`, `.js`, `.png`, `.jpg`, `.svg`, `.ico`, `.woff`, `.ttf`, `.map`).
3. **GeoIP Enrichment**: Resolves IP to Country, Country Code, Region, and City.
4. **Threat Intelligence Evaluation**: Assigns traffic categories (`Genuine`, `Bot`, `Threat`) and threat severities (`Low`, `Medium`, `High`, `Critical`).

#### Success Response
```json
{
  "success": true
}
```

---

### 4.2 Admin Aggregated Analytics API: `GET /api/admin/analytics`

Requires Authentication (Session Cookie, Basic Auth `admin:admin123`, or Header `Authorization: Bearer <AUTH_SECRET>`).

#### Query Parameters
- `siteId` (String): Filter metrics for a specific App Tenant UUID or `'all'`.
- `startDate` (String, ISO 8601): Optional start date filter (`YYYY-MM-DD`).
- `endDate` (String, ISO 8601): Optional end date filter (`YYYY-MM-DD`).

#### Response JSON Schema
```json
{
  "success": true,
  "metrics": {
    "totalVisits": 1420,
    "genuineVisits": 1280,
    "botVisits": 90,
    "threatVisits": 50,
    "topPages": [
      { "path": "/pricing", "count": 310 },
      { "path": "/docs", "count": 240 }
    ],
    "topReferrers": [
      { "referrer": "https://google.com", "count": 520 }
    ],
    "deviceBreakdown": {
      "Desktop": 850,
      "Mobile": 500,
      "Tablet": 70
    },
    "browserBreakdown": {
      "Chrome": 910,
      "Safari": 320,
      "Firefox": 120,
      "Edge": 70
    },
    "threatTypes": {
      "Vulnerability Probe": 35,
      "DDoS Burst": 15
    },
    "geoBreakdown": [
      { "country": "United States", "countryCode": "US", "count": 780 },
      { "country": "Germany", "countryCode": "DE", "count": 210 }
    ],
    "utmCampaigns": [
      { "campaign": "summer_sale", "count": 140 }
    ]
  }
}
```

---

### 4.3 Admin Paginated History API: `GET /api/admin/history`

Requires Authentication.

#### Query Filter Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `siteId` | String | `'all'` | App Tenant UUID filter. |
| `page` | Integer | `1` | Page number for pagination. |
| `limit` | Integer | `10` | Items per page (1 to 100). |
| `search` | String | `""` | Search substring for matching path, IP, or country. |
| `device` | String | `'all'` | Filter by device: `Desktop`, `Mobile`, `Tablet`, `Bot`. |
| `category` | String | `'all'` | Traffic category filter: `Genuine`, `Bot`, `Threat`. |
| `threatType` | String | `'all'` | Threat filter: `Vulnerability Probe`, `Path Traversal`, `DDoS Burst`, `Suspicious Scanner`. |

#### Response JSON Schema
```json
{
  "success": true,
  "data": [
    {
      "_id": "66ac64d9f9a21b34c09231f2",
      "siteId": "consoleapi-products",
      "path": "/.env",
      "fullUrl": "https://products.consoleapi.in/.env",
      "referrer": "",
      "ip": "185.220.101.5",
      "country": "Germany",
      "countryCode": "DE",
      "region": "Bavaria",
      "city": "Munich",
      "deviceType": "Bot",
      "browser": "Other",
      "trafficCategory": "Threat",
      "threatType": "Vulnerability Probe",
      "threatSeverity": "Critical",
      "threatReason": "Probing sensitive environment variables (.env)",
      "timestamp": "2026-08-01T18:05:22.100Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### 4.4 App Tenant Management APIs

#### List App Tenants: `GET /api/admin/apps`
Returns array of registered app profiles.

#### Register or Edit App Tenant: `POST /api/admin/apps`
**Request Body:**
```json
{
  "siteId": "my-tenant-uuid-1234",
  "name": "E-Commerce Storefront",
  "domain": "https://store.example.com",
  "description": "Production e-commerce storefront app"
}
```

#### Delete App Tenant: `DELETE /api/admin/apps/:siteId`
Removes the specified app registration.

---

### 4.5 Data Backup & Dataset Restore APIs

#### Export Dataset: `GET /api/admin/export?format=json|csv&siteId=YOUR_TENANT_ID`
Returns attachment file download containing recorded visit logs.

#### Import Backup Dataset: `POST /api/admin/import`
Restores array of page visit JSON objects into MongoDB.

---

### 4.6 System Health Specs & Purge APIs

#### Get Cluster Health Specs: `GET /api/admin/system`
Returns MongoDB connection state, memory usage, document count, collections count, Node version, and system uptime.

#### Clear All Visit Logs: `DELETE /api/admin/clear`
Purges recorded visit logs from MongoDB.

---

## 5. Automated Threat & Bot Intelligence Pipeline

Every incoming visit is evaluated against multi-stage security rules:

```
Incoming Request Visit
   │
   ├─► 1. Vulnerability Probe Check (.env, .git, /etc/ssl, /wp-admin, /actuator, webshells)
   │      └─► MATCH: Category="Threat", Type="Vulnerability Probe", Severity="Critical"
   │
   ├─► 2. Injection Attack Check (../ path traversal, SQLi UNION SELECT, XSS)
   │      └─► MATCH: Category="Threat", Type="Path Traversal", Severity="High"
   │
   ├─► 3. Malicious Scanner UA Check (sqlmap, nikto, nmap, masscan, gobuster, wpscan)
   │      └─► MATCH: Category="Threat", Type="Suspicious Scanner", Severity="High"
   │
   ├─► 4. Rate Burst DDoS Check (>= 5 requests / 10 seconds from same IP)
   │      └─► MATCH: Category="Threat", Type="DDoS Burst", Severity="Critical"
   │
   ├─► 5. Standard Bot Check (Googlebot, Bingbot, YandexBot crawlers)
   │      └─► MATCH: Category="Bot", Type="None", Severity="Low"
   │
   └─► Default: Category="Genuine", Type="None", Severity="Low"
```

---

## 6. UTM Attribution Engine

The platform automatically extracts, parses, and aggregates standard UTM marketing parameters from URLs:

| Parameter | Purpose | Example Value |
| :--- | :--- | :--- |
| `utm_source` | Identifies referrer platform / traffic origin | `chromestore`, `google`, `newsletter` |
| `utm_medium` | Identifies marketing medium | `organic`, `cpc`, `email`, `banner` |
| `utm_campaign` | Identifies specific campaign name | `outsystems-devtool`, `summer_sale_2026` |
| `utm_content` | Differentiates ad/link variants | `outsystems-devtool`, `cta_button` |
| `utm_term` | Identifies targeted search keywords | `outsystems-devtool`, `analytics_tools` |

---

## 7. Production Deployment & Hosting Guides

### 7.1 Docker & Docker Compose Setup

#### Production `Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000
CMD ["node", "server.js"]
```

#### `docker-compose.yml`
```yaml
version: '3.8'

services:
  analytics-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - MONGODB_URI=mongodb://mongo:27017/analytics_db
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=prod_secure_password_123
      - AUTH_SECRET=your_jwt_secret_key_here
    depends_on:
      - mongo
    restart: always

  mongo:
    image: mongo:latest
    container_name: analytics-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: always

volumes:
  mongo_data:
```

---

### 7.2 PM2 Process Manager Supervision

```bash
# 1. Clone repository & install dependencies
git clone https://github.com/yourusername/analytics.git
cd analytics
npm install

# 2. Build production Angular frontend
npm run build

# 3. Configure environment variables
export PORT=3000
export MONGODB_URI="mongodb://localhost:27017/analytics_db"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your_secure_password"
export AUTH_SECRET="your_jwt_secret_key"

# 4. Start process supervisor via PM2
npm install -g pm2
pm2 start server.js --name "analytics-platform"
pm2 save
pm2 startup
```

---

### 7.3 Nginx Reverse Proxy & SSL Setup

```nginx
# /etc/nginx/sites-available/analytics.conf
server {
    listen 80;
    server_name analytics.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. System Environment Variables Reference (`.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Server HTTP listening port |
| `NODE_ENV` | `development` | Deployment environment mode (`development` or `production`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/analytics_db` | MongoDB connection URI string |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated origins or `*`) |
| `ADMIN_USERNAME` | `admin` | Superadmin login username |
| `ADMIN_PASSWORD` | `admin123` | Superadmin login password |
| `AUTH_SECRET` | `analytics_secret_token_key_987654321` | JWT & token encryption secret key |
