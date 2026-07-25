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
  timestamp: string | Date;
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

