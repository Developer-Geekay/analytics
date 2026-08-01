# Multi-Tenant Analytics & Security Intelligence Platform

A high-performance, lightweight (<1.5KB), zero-dependency analytics and threat intelligence platform built with **Node.js, Express, MongoDB, and Angular 21**. Supports multi-tenant application isolation, automated Single Page Application (SPA) route change detection, UTM marketing attribution, real-time GeoIP lookups, device fingerprinting, and automated security threat detection.

---

## Table of Contents
- [Features](#features)
- [Quick Start Guide](#quick-start-guide)
- [SDK Configuration Attributes](#sdk-configuration-attributes)
- [Programmatic JavaScript SDK API](#programmatic-javascript-sdk-api)
- [Framework Integration Guides](#framework-integration-guides)
  - [React & React Router](#1-react--react-router)
  - [Next.js (App Router & Pages Router)](#2-nextjs-app-router)
  - [Angular Integration Service](#3-angular-integration-service)
  - [Vue.js 3 & Nuxt 3](#4-vuejs-3--nuxt-3)
  - [Svelte & SvelteKit](#5-svelte--sveltekit)
  - [Node.js & Express Server Middleware](#6-nodejs--express-server-middleware)
  - [Python (Flask / FastAPI / Django)](#7-python-flask--fastapi--django)
- [REST API Reference](#rest-api-reference)
  - [POST /api/analytics/visit (Public Ingestion Beacon)](#post-apianalyticsvisit-public-ingestion-beacon)
  - [GET /api/admin/analytics (Aggregated Metrics)](#get-apiadminanalytics-aggregated-metrics)
  - [GET /api/admin/history (Paginated Raw Logs)](#get-apiadminhistory-paginated-raw-logs)
  - [App Tenant Management APIs](#app-tenant-management-apis)
  - [Data Export & Import APIs](#data-export--import-apis)
  - [System Health & Purge APIs](#system-health--purge-apis)
- [Automated Threat & Bot Engine](#automated-threat--bot-engine)
- [UTM Attribution Engine](#utm-attribution-engine)
- [Deployment & Production Setup](#deployment--production-setup)
  - [Docker & Docker Compose](#docker--docker-compose)
  - [PM2 Process Supervision](#pm2-process-supervision)
  - [Nginx Reverse Proxy & SSL](#nginx-reverse-proxy--ssl)
- [Environment Variables (.env)](#environment-variables-env)

---

## Features

- ⚡ **Lightweight SDK (`analytics.js`)**: `<1.5KB` minified, zero external runtime dependencies.
- 🏢 **Multi-Tenant Isolation**: Unique UUID v4 App Tenant IDs (`data-site-id`).
- ⚡ **Non-Blocking Ingestion**: Uses `navigator.sendBeacon` with `fetch(..., { keepalive: true })` fallback.
- 🔄 **Automated SPA Navigation**: Intercepts `history.pushState` and handles `popstate` events automatically.
- 🛡️ **Automated Threat Intelligence**: Detects vulnerability probes (`.env`, `.git`, webshells), SQLi/XSS path traversals, malicious scanners (`sqlmap`, `nmap`), and DDoS rate bursts (>=5 req/10s).
- 🌍 **GeoIP & Device Detection**: Country, region, city geolocation parsing alongside Device Type (`Desktop`, `Mobile`, `Tablet`, `Bot`) and Browser categorization.
- 📊 **UTM Marketing Attribution**: Automatic parsing of `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`.
- 💾 **Data Portability**: Full JSON/CSV export and dataset backup restore capabilities.

---

## Quick Start Guide

Paste the following script tag right before the closing `</head>` tag of your HTML:

```html
<script 
  src="http://localhost:3000/sdk/analytics.js" 
  data-site-id="YOUR_APP_TENANT_UUID" 
  async>
</script>
```

---

## SDK Configuration Attributes

Customize SDK behavior using `data-*` HTML attributes:

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `data-site-id` | String | `'default'` | **Required.** Your unique UUID v4 App Tenant ID. |
| `data-host` | String | Script Origin | Analytics server origin URL (e.g. `https://analytics.yourdomain.com`). |
| `data-endpoint` | String | `'/api/analytics/visit'` | Relative API ingestion path. |
| `data-auto-track` | Boolean | `true` | Set to `"false"` to disable automated initial page load and SPA history tracking. |

---

## Programmatic JavaScript SDK API

For custom events or manual SPA route transitions, use the global `window.AnalyticsSDK` object:

```javascript
// 1. Programmatically initialize Analytics SDK
window.AnalyticsSDK.init({
  siteId: 'YOUR_APP_TENANT_UUID',
  endpoint: 'https://analytics.yourdomain.com/api/analytics/visit'
});

// 2. Manually trigger a page visit record with custom data payload
window.AnalyticsSDK.trackVisit('/dashboard/checkout', {
  utm_source: 'newsletter',
  utm_campaign: 'summer_sale_2026',
  custom_tag: 'premium_user'
});
```

---

## Framework Integration Guides

### 1. React & React Router

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    fetch('http://localhost:3000/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: 'YOUR_APP_TENANT_UUID',
        path: location.pathname + location.search,
        fullUrl: window.location.href,
        referrer: document.referrer
      }),
      keepalive: true
    }).catch(console.error);
  }, [location]);
}
```

### 2. Next.js (App Router)

```tsx
// components/AnalyticsScript.tsx
'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsScript() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).AnalyticsSDK) {
      (window as any).AnalyticsSDK.trackVisit(pathname + (searchParams?.toString() ? '?' + searchParams.toString() : ''));
    }
  }, [pathname, searchParams]);

  return (
    <Script
      src="http://localhost:3000/sdk/analytics.js"
      data-site-id="YOUR_APP_TENANT_UUID"
      data-host="http://localhost:3000"
      strategy="afterInteractive"
    />
  );
}
```

### 3. Angular Integration Service

```typescript
import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackingService {
  private router = inject(Router);
  private http = inject(HttpClient);

  init(): void {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.http.post('http://localhost:3000/api/analytics/visit', {
        siteId: 'YOUR_APP_TENANT_UUID',
        path: event.urlAfterRedirects,
        fullUrl: window.location.href,
        referrer: document.referrer
      }).subscribe();
    });
  }
}
```

### 4. Vue.js 3 & Nuxt 3

```javascript
// router/index.js
export function setupAnalytics(router) {
  router.afterEach((to) => {
    fetch('http://localhost:3000/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: 'YOUR_APP_TENANT_UUID',
        path: to.fullPath,
        fullUrl: window.location.origin + to.fullPath,
        referrer: document.referrer
      }),
      keepalive: true
    }).catch(() => {});
  });
}
```

### 5. Svelte & SvelteKit

```svelte
<!-- +layout.svelte -->
<script>
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $: if (browser && $page.url) {
    fetch('http://localhost:3000/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: 'YOUR_APP_TENANT_UUID',
        path: $page.url.pathname + $page.url.search,
        fullUrl: $page.url.href,
        referrer: document.referrer
      }),
      keepalive: true
    }).catch(() => {});
  }
</script>
```

### 6. Node.js & Express Server Middleware

```javascript
const analyticsMiddleware = (req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/static')) {
    fetch('http://localhost:3000/api/analytics/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'] || '',
        'X-Forwarded-For': req.ip
      },
      body: JSON.stringify({
        siteId: 'YOUR_APP_TENANT_UUID',
        path: req.originalUrl || req.path,
        fullUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        referrer: req.headers['referer'] || ''
      })
    }).catch(err => console.error('Analytics record error:', err));
  }
  next();
};

app.use(analyticsMiddleware);
```

### 7. Python (Flask / FastAPI / Django)

```python
import requests
from flask import request

def track_page_visit(path_override=None):
    try:
        payload = {
            "siteId": "YOUR_APP_TENANT_UUID",
            "path": path_override or request.path,
            "fullUrl": request.url,
            "referrer": request.referrer or ""
        }
        headers = {
            "User-Agent": request.headers.get("User-Agent", ""),
            "X-Forwarded-For": request.remote_addr
        }
        requests.post("http://localhost:3000/api/analytics/visit", json=payload, headers=headers, timeout=2)
    except Exception as e:
        print(f"Analytics dispatch error: {e}")
```

---

## REST API Reference

### POST `/api/analytics/visit` (Public Ingestion Beacon)

Public beacon endpoint for recording visit data. No auth required.

**Request Payload:**
```json
{
  "siteId": "YOUR_APP_TENANT_UUID",
  "path": "/products/laptop-pro",
  "fullUrl": "https://mystore.com/products/laptop-pro?utm_source=newsletter&utm_medium=email",
  "referrer": "https://google.com",
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "summer_deal",
  "utm_content": "hero_banner",
  "utm_term": "laptops"
}
```

### GET `/api/admin/analytics` (Aggregated Metrics)

Requires Basic Auth (`admin:admin123`) or Session / Bearer Token (`Authorization: Bearer <AUTH_SECRET>`).

**Query Parameters:**
- `siteId`: App Tenant UUID (or `'all'`)
- `startDate`: Optional cutoff date (`YYYY-MM-DD`)
- `endDate`: Optional cutoff date (`YYYY-MM-DD`)

### GET `/api/admin/history` (Paginated Raw Logs)

**Query Parameters:**
- `page`: Page number (default: `1`)
- `limit`: Page size (default: `10`)
- `search`: Search query string (path, IP, country)
- `device`: Device type filter (`Desktop`, `Mobile`, `Tablet`, `Bot`)
- `category`: Traffic category (`Genuine`, `Bot`, `Threat`)
- `threatType`: Threat classification (`Vulnerability Probe`, `Path Traversal`, `DDoS Burst`, `Suspicious Scanner`)

### App Tenant Management APIs
- `GET /api/admin/apps`: List registered tenants.
- `POST /api/admin/apps`: Register/update app tenant.
- `DELETE /api/admin/apps/:siteId`: Unregister app tenant.

### Data Export & Import APIs
- `GET /api/admin/export?format=json|csv`: Download analytics backup.
- `POST /api/admin/import`: Restore JSON dataset array into MongoDB.

### System Health & Purge APIs
- `GET /api/admin/system`: Fetch MongoDB cluster status, Node version, memory usage, document count.
- `DELETE /api/admin/clear`: Clear page visit logs.

---

## Automated Threat & Bot Engine

| Threat Type | Severity | Description & Pattern |
| :--- | :--- | :--- |
| **Vulnerability Probe** | Critical | Probing sensitive endpoints (`.env`, `.git`, `/etc/ssl`, `/wp-admin`, `/actuator`, webshells). |
| **Path Traversal** | High | Directory traversal (`../`), SQL Injection (`UNION SELECT`), or XSS scripts. |
| **Suspicious Scanner** | High | Automated reconnaissance security tools (`sqlmap`, `nikto`, `nmap`, `masscan`, `gobuster`). |
| **DDoS Burst** | Critical | High rate burst (>= 5 requests within 10 seconds from single IP). |
| **Bot** | Low | Standard benign search engine crawlers (`Googlebot`, `Bingbot`, `YandexBot`). |

---

## UTM Attribution Engine

Automatically captures query string parameters:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

---

## Deployment & Production Setup

### Docker & Docker Compose

```yaml
version: '3.8'

services:
  analytics-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - MONGODB_URI=mongodb://mongo:27017/analytics
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=prod_secure_password
      - AUTH_SECRET=your_secret_key
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

### PM2 Process Supervision

```bash
npm install
npm run build
npm install -g pm2
pm2 start server.js --name "analytics-platform"
pm2 save
pm2 startup
```

### Nginx Reverse Proxy & SSL

```nginx
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

## Environment Variables (.env)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Server listening port |
| `NODE_ENV` | `development` | Runtime environment mode |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/analytics_db` | MongoDB connection URI string |
| `CORS_ORIGIN` | `*` | CORS origin policy |
| `ADMIN_USERNAME` | `admin` | Admin login username |
| `ADMIN_PASSWORD` | `admin123` | Admin login password |
| `AUTH_SECRET` | `analytics_secret_token_key_987654321` | JWT & token encryption secret |
