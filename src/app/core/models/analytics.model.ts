export interface PageVisitItem {
  _id?: string;
  siteId: string;
  path: string;
  fullUrl?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot';
  browser: string;
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  trafficCategory?: 'Genuine' | 'Bot' | 'Threat';
  threatType?: 'None' | 'Vulnerability Probe' | 'Path Traversal' | 'DDoS Burst' | 'Suspicious Scanner';
  threatSeverity?: 'Low' | 'Medium' | 'High' | 'Critical';
  threatReason?: string;
  timestamp: string | Date;
}

export interface CountryMetric {
  country: string;
  countryCode: string;
  count: number;
  percentage: number;
}

export interface TopPageMetric {
  path: string;
  count: number;
  percentage: number;
  lastVisited?: string | Date;
}

export interface UtmCampaignMetric {
  source: string;
  campaign: string;
  count: number;
}

export interface DeviceBreakdown {
  Desktop: number;
  Mobile: number;
  Tablet: number;
  Bot: number;
}

export interface TrafficBreakdown {
  Genuine: number;
  Bot: number;
  Threat: number;
}

export interface ThreatPathMetric {
  path: string;
  threatType: string;
  reason: string;
  count: number;
}

export interface ThreatIPMetric {
  ip: string;
  count: number;
  lastThreatType: string;
}

export interface BrowserMetric {
  browser: string;
  count: number;
}

export interface ReferrerMetric {
  referrer: string;
  count: number;
}

export interface HourlyMetric {
  hour: string;
  count: number;
}

export interface AnalyticsSummary {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  availableSites: string[];
  trafficBreakdown?: TrafficBreakdown;
  threatsCount?: number;
  criticalAlerts?: PageVisitItem[];
  topThreatPaths?: ThreatPathMetric[];
  topThreatIPs?: ThreatIPMetric[];
  topCountries?: CountryMetric[];
  topPages: TopPageMetric[];
  utmCampaigns: UtmCampaignMetric[];
  deviceBreakdown: DeviceBreakdown;
  browserBreakdown?: BrowserMetric[];
  topReferrers?: ReferrerMetric[];
  hourlyDistribution?: HourlyMetric[];
  recentVisits: PageVisitItem[];
}

export interface RegisteredApp {
  _id?: string;
  siteId: string;
  name: string;
  domain?: string;
  description?: string;
  status?: 'active' | 'paused';
  isRegistered?: boolean;
  totalVisits?: number;
  lastActive?: string | Date | null;
  createdAt?: string | Date;
}

