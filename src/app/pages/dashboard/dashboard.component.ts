import { Component, inject, OnInit, OnDestroy, signal, computed, isDevMode } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../core/services/analytics.service';
import { PageVisitItem, RegisteredApp } from '../../core/models/analytics.model';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { AuthService } from '../../core/services/auth.service';

export type NavSection = 'dashboard' | 'apps' | 'settings' | 'docs';
export type TabType = 'overview' | 'pages' | 'acquisition' | 'devices' | 'threats' | 'feed';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatDialogModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatButtonToggleModule,
    MatSlideToggleModule
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  analyticsService = inject(AnalyticsService);
  authService = inject(AuthService);
  location = inject(Location);
  Math = Math;

  // Login form state
  loginUsername = signal<string>('admin');
  loginPassword = signal<string>('');
  hidePassword = signal<boolean>(true);

  // Auto-detected environment (Localhost / dev mode check)
  isDevEnvironment = isDevMode() || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  // User client browser timezone detection
  userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Timezone';
  userTimezoneOffset = this.getBrowserTimezoneOffset();

  // Top-level Navigation & Sub-tabs
  mainNav = signal<NavSection>('dashboard');
  activeTab = signal<TabType>('overview');
  docsSection = signal<string>('quickstart');

  searchQuery = signal<string>('');
  deviceFilter = signal<string>('all');
  categoryFilter = signal<string>('all');
  dismissAlertBanner = signal<boolean>(false);
  autoRefreshEnabled = signal<boolean>(false);
  secondsUntilRefresh = signal<number>(5);
  showClearModal = signal<boolean>(false);

  // App Management State
  showRegisterAppModal = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  newAppSiteId = signal<string>('');
  newAppName = signal<string>('');
  newAppDomain = signal<string>('');
  newAppDescription = signal<string>('');
  selectedAppForSnippet = signal<string>('consoleapi-products');
  snippetType = signal<'script' | 'npm' | 'react' | 'nextjs' | 'angular' | 'vue' | 'svelte' | 'curl'>('script');

  // Modals state
  showSnippetModal = signal<boolean>(false);
  showDeleteAppModal = signal<boolean>(false);
  appToDelete = signal<RegisteredApp | null>(null);

  // Settings State
  systemInfo = signal<any>(null);
  importJsonText = signal<string>('');
  importFileName = signal<string>('');
  importFileCount = signal<number>(0);
  importJsonData = signal<any[] | null>(null);
  isImporting = signal<boolean>(false);

  // Paginated History State
  historyVisits = signal<PageVisitItem[]>([]);
  historyTotalCount = signal<number>(0);
  historyPage = signal<number>(1);
  historyLimit = signal<number>(10);
  historyTotalPages = signal<number>(1);
  isHistoryLoading = signal<boolean>(false);

  private autoRefreshTimer: any = null;

  // Theme State (Dark & Light Modes)
  currentTheme = signal<'dark' | 'light'>('dark');

  performLogin(): void {
    if (!this.loginUsername() || !this.loginPassword()) return;
    this.authService.login(this.loginUsername(), this.loginPassword()).subscribe((res) => {
      if (res.success) {
        this.loadData();
        this.loadHistory();
        this.analyticsService.fetchApps().subscribe();
      }
    });
  }

  performLogout(): void {
    this.authService.logout();
  }

  ngOnInit(): void {
    const saved = typeof localStorage !== 'undefined' ? (localStorage.getItem('analytics_theme') as 'dark' | 'light') : null;
    const initialTheme = saved || 'dark';
    this.currentTheme.set(initialTheme);
    this.applyTheme(initialTheme);

    const initialPath = typeof window !== 'undefined' ? window.location.pathname.replace(/^\//, '') : 'dashboard';
    if (['dashboard', 'apps', 'settings', 'docs'].includes(initialPath)) {
      this.mainNav.set(initialPath as NavSection);
    } else {
      this.mainNav.set('dashboard');
      this.location.go('/dashboard');
    }

    this.loadData();
    this.loadHistory();
    this.analyticsService.fetchApps().subscribe();
  }

  toggleTheme(): void {
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.currentTheme.set(next);
    this.applyTheme(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('analytics_theme', next);
    }
  }

  applyTheme(theme: 'dark' | 'light'): void {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const body = document.body;
      root.classList.remove('dark', 'light');
      body.classList.remove('dark', 'light');
      root.classList.add(theme);
      body.classList.add(theme);
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  getBrowserTimezoneOffset(): string {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offsetMin) / 60).toString().padStart(2, '0');
    const minutes = (Math.abs(offsetMin) % 60).toString().padStart(2, '0');
    return `UTC${sign}${hours}:${minutes}`;
  }

  loadData(silent = false): void {
    this.analyticsService.fetchAnalytics(this.analyticsService.selectedSiteId(), silent).subscribe();
    this.loadHistory();
  }

  loadHistory(): void {
    this.isHistoryLoading.set(true);
    this.analyticsService.fetchHistory({
      siteId: this.analyticsService.selectedSiteId(),
      search: this.searchQuery(),
      device: this.deviceFilter(),
      category: this.categoryFilter(),
      page: this.historyPage(),
      limit: this.historyLimit()
    }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.historyVisits.set(res.data.visits || []);
          this.historyTotalCount.set(res.data.totalCount || 0);
          this.historyTotalPages.set(res.data.totalPages || 1);
        }
        this.isHistoryLoading.set(false);
      },
      error: () => {
        this.isHistoryLoading.set(false);
      }
    });
  }

  onSiteChange(siteId: string): void {
    this.historyPage.set(1);
    this.analyticsService.fetchAnalytics(siteId).subscribe();
    this.loadHistory();
  }

  setTab(tab: string): void {
    const validTabs: TabType[] = ['overview', 'pages', 'acquisition', 'devices', 'threats', 'feed'];
    if (validTabs.includes(tab as TabType)) {
      this.activeTab.set(tab as TabType);
      if (tab === 'feed' || tab === 'threats') {
        this.loadHistory();
      }
    }
  }

  onCategoryFilterChange(category: string): void {
    this.categoryFilter.set(category);
    this.historyPage.set(1);
    this.loadHistory();
  }

  getGenuinePercentage(): number {
    const summary = this.analyticsService.summary();
    if (!summary || !summary.totalVisits) return 0;
    return Math.round(((summary.trafficBreakdown?.Genuine || 0) / summary.totalVisits) * 100);
  }

  getBotPercentage(): number {
    const summary = this.analyticsService.summary();
    if (!summary || !summary.totalVisits) return 0;
    return Math.round(((summary.trafficBreakdown?.Bot || 0) / summary.totalVisits) * 100);
  }

  getThreatPercentage(): number {
    const summary = this.analyticsService.summary();
    if (!summary || !summary.totalVisits) return 0;
    return Math.round(((summary.trafficBreakdown?.Threat || 0) / summary.totalVisits) * 100);
  }

  // Pagination Handlers
  goToPage(page: number): void {
    if (page < 1 || page > this.historyTotalPages()) return;
    this.historyPage.set(page);
    this.loadHistory();
  }

  changeLimit(limit: number): void {
    this.historyLimit.set(limit);
    this.historyPage.set(1);
    this.loadHistory();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.historyPage.set(1);
    this.loadHistory();
  }

  onDeviceFilterChange(device: string): void {
    this.deviceFilter.set(device);
    this.historyPage.set(1);
    this.loadHistory();
  }

  toggleAutoRefresh(): void {
    const newState = !this.autoRefreshEnabled();
    this.autoRefreshEnabled.set(newState);

    if (newState) {
      this.analyticsService.showToast('Auto-refresh active (5s interval)', 'info');
      this.startAutoRefresh();
    } else {
      this.analyticsService.showToast('Auto-refresh paused', 'info');
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.secondsUntilRefresh.set(5);

    this.autoRefreshTimer = setInterval(() => {
      let current = this.secondsUntilRefresh() - 1;
      if (current <= 0) {
        this.loadData(true);
        current = 5;
      }
      this.secondsUntilRefresh.set(current);
    }, 1000);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  getMaxPageCount(pages: { path: string; count: number }[] | undefined): number {
    if (!pages || pages.length === 0) return 1;
    return Math.max(...pages.map(p => p.count), 1);
  }

  getMaxReferrerCount(referrers: { referrer: string; count: number }[] | undefined): number {
    if (!referrers || referrers.length === 0) return 1;
    return Math.max(...referrers.map(r => r.count), 1);
  }


  openClearModal(): void {
    this.showClearModal.set(true);
  }

  closeClearModal(): void {
    this.showClearModal.set(false);
  }

  confirmClearLogs(): void {
    const site = this.analyticsService.selectedSiteId();
    this.analyticsService.clearAnalytics(site).subscribe(() => {
      this.closeClearModal();
      this.loadHistory();
    });
  }

  copyToClipboard(text: string, label = 'Copied to clipboard'): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.analyticsService.showToast(`${label}!`, 'success');
    });
  }

  exportCsv(): void {
    const visits = this.historyVisits().length ? this.historyVisits() : (this.analyticsService.summary()?.recentVisits || []);
    if (!visits.length) {
      this.analyticsService.showToast('No visit data available to export', 'error');
      return;
    }

    const headers = ['Timestamp (Local)', 'Project', 'Path', 'Full URL', 'Referrer', 'UTM Source', 'UTM Campaign', 'Device', 'Browser', 'IP'];
    const rows = visits.map(v => [
      `"${this.formatDate(v.timestamp)}"`,
      v.siteId || 'default',
      `"${v.path}"`,
      `"${v.fullUrl || v.path}"`,
      `"${v.referrer || ''}"`,
      `"${v.utm_source || ''}"`,
      `"${v.utm_campaign || ''}"`,
      v.deviceType,
      v.browser,
      v.ip
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analytics_${this.analyticsService.selectedSiteId()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.analyticsService.showToast('Analytics CSV exported successfully', 'success');
  }

  // Helpers for chart scaling
  maxHourlyCount = computed(() => {
    const summary = this.analyticsService.summary();
    if (!summary || !summary.hourlyDistribution || !summary.hourlyDistribution.length) return 1;
    const max = Math.max(...summary.hourlyDistribution.map(h => h.count));
    return max > 0 ? max : 1;
  });

  getDeviceCount(type: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot'): number {
    const summary = this.analyticsService.summary();
    return summary?.deviceBreakdown?.[type] || 0;
  }

  getDevicePercentage(type: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot'): number {
    const summary = this.analyticsService.summary();
    if (!summary || !summary.totalVisits) return 0;
    const count = this.getDeviceCount(type);
    return Math.round((count / summary.totalVisits) * 100);
  }

  getCountryFlag(countryCode: string | undefined): string {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  formatDate(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'UTC' }) + ' ' +
           date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) + ' UTC';
  }

  getRelativeTime(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'N/A';
    const now = new Date().getTime();
    const past = new Date(timestamp).getTime();
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  getPageArray(): number[] {
    const total = this.historyTotalPages();
    const current = this.historyPage();
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  setMainNav(nav: NavSection): void {
    this.mainNav.set(nav);
    this.location.go('/' + nav);
    if (nav === 'settings') {
      this.loadSystemInfo();
    }
  }

  loadSystemInfo(): void {
    this.analyticsService.fetchSystemInfo().subscribe((res) => {
      if (res && res.success) {
        this.systemInfo.set(res.data);
      }
    });
  }

  handleFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    this.importFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result;
      this.importJsonText.set(content);
    };
    reader.readAsText(file);
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.importFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const visitsArray = Array.isArray(parsed) ? parsed : (parsed.visits || (parsed.data ? parsed.data.visits : [parsed]));

        if (Array.isArray(visitsArray) && visitsArray.length > 0) {
          this.importJsonData.set(visitsArray);
          this.importFileCount.set(visitsArray.length);
          this.analyticsService.showToast(`Selected "${file.name}" containing ${visitsArray.length} visits. Click "Confirm & Import" to upload.`, 'info');
        } else {
          this.analyticsService.showToast('Invalid JSON structure. File must contain an array of visit objects.', 'error');
        }
      } catch (err: any) {
        this.analyticsService.showToast(`Failed to parse JSON file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  performImport(): void {
    const data = this.importJsonData();
    if (!data || data.length === 0) {
      this.analyticsService.showToast('No visit records selected for import', 'error');
      return;
    }

    this.isImporting.set(true);
    this.analyticsService.importVisits(data).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        if (res && res.success) {
          this.cancelImport();
          this.loadSystemInfo();
          this.loadData();
          this.loadHistory();
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        this.analyticsService.showToast(err.error?.error || 'Failed to import analytics dataset', 'error');
      }
    });
  }

  cancelImport(): void {
    this.importJsonData.set(null);
    this.importFileName.set('');
    this.importFileCount.set(0);
  }

  formatUptime(seconds?: number): string {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  downloadExport(format: 'json' | 'csv'): void {
    const siteId = this.analyticsService.selectedSiteId();
    const exportUrl = `/api/admin/export?siteId=${encodeURIComponent(siteId)}&format=${format}`;
    window.open(exportUrl, '_blank');
    this.analyticsService.showToast(`Downloading ${format.toUpperCase()} analytics dataset...`, 'info');
  }

  generateUuidV4(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  openRegisterModal(app?: any): void {
    if (app) {
      this.isEditMode.set(true);
      this.newAppSiteId.set(app.siteId);
      this.newAppName.set(app.name);
      this.newAppDomain.set(app.domain || '');
      this.newAppDescription.set(app.description || '');
    } else {
      this.isEditMode.set(false);
      this.newAppSiteId.set(this.generateUuidV4());
      this.newAppName.set('');
      this.newAppDomain.set('');
      this.newAppDescription.set('');
    }
    this.showRegisterAppModal.set(true);
  }

  toggleAppStatus(app: RegisteredApp): void {
    const newStatus = app.status === 'paused' ? 'active' : 'paused';
    this.analyticsService.registerApp({
      siteId: app.siteId,
      name: app.name,
      domain: app.domain,
      description: app.description,
      status: newStatus,
    }).subscribe(() => {
      this.analyticsService.showToast(`App "${app.name}" status updated to ${newStatus.toUpperCase()}`, 'info');
      this.analyticsService.fetchApps().subscribe();
    });
  }


  closeRegisterModal(): void {
    this.showRegisterAppModal.set(false);
  }

  saveAppRegistration(): void {
    if (!this.newAppSiteId() || !this.newAppName()) {
      this.analyticsService.showToast('App Tenant ID and App Name are required', 'error');
      return;
    }

    this.analyticsService.registerApp({
      siteId: this.newAppSiteId(),
      name: this.newAppName(),
      domain: this.newAppDomain(),
      description: this.newAppDescription(),
    }).subscribe(() => {
      this.closeRegisterModal();
    });
  }

  openSnippetModal(siteId?: string): void {
    if (siteId) {
      this.selectedAppForSnippet.set(siteId);
    }
    this.showSnippetModal.set(true);
  }

  closeSnippetModal(): void {
    this.showSnippetModal.set(false);
  }

  promptDeleteApp(app: RegisteredApp): void {
    this.appToDelete.set(app);
    this.showDeleteAppModal.set(true);
  }

  closeDeleteAppModal(): void {
    this.showDeleteAppModal.set(false);
    this.appToDelete.set(null);
  }

  confirmDeleteApp(): void {
    const target = this.appToDelete();
    if (!target) return;

    this.analyticsService.deleteApp(target.siteId).subscribe({
      next: () => {
        this.closeDeleteAppModal();
      },
      error: (err) => {
        this.analyticsService.showToast(err.error?.error || 'Failed to remove application tenant', 'error');
      }
    });
  }

  getBaseUrl(): string {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  }

  getTrackingScriptSnippet(siteId: string): string {
    const cleanId = siteId || 'your-app-id';
    const baseUrl = this.getBaseUrl();
    return `<script src="${baseUrl}/sdk/analytics.js" data-site-id="${cleanId}" data-host="${baseUrl}" data-auto-track="true" async></script>`;
  }

  getProgrammaticJsApiSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `// 1. Programmatically initialize Analytics SDK
window.AnalyticsSDK.init({
  siteId: '${siteId}',
  endpoint: '${baseUrl}/api/analytics/visit'
});

// 2. Manually track custom page view or virtual transition with payload data
window.AnalyticsSDK.trackVisit('/dashboard/checkout', {
  utm_source: 'newsletter',
  utm_campaign: 'summer_sale_2026',
  custom_tag: 'premium_user'
});`;
  }

  getNpmSnippet(siteId: string): string {
    const cleanId = siteId || 'your-app-id';
    const baseUrl = this.getBaseUrl();
    return `// Lightweight zero-dependency JS / Fetch Tracker
export function trackPageView(path = window.location.pathname, customData = {}) {
  const payload = {
    siteId: '${cleanId}',
    path: path,
    fullUrl: window.location.href,
    referrer: document.referrer || '',
    ...customData
  };

  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon('${baseUrl}/api/analytics/visit', blob);
  } else {
    fetch('${baseUrl}/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }
}`;
  }

  getCurlSnippet(siteId: string): string {
    const cleanId = siteId || 'your-app-id';
    const baseUrl = this.getBaseUrl();
    return `curl -X POST "${baseUrl}/api/analytics/visit" \\
  -H "Content-Type: application/json" \\
  -d '{
    "siteId": "${cleanId}",
    "path": "/checkout",
    "fullUrl": "https://myapp.com/checkout",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "search_promo"
  }'`;
  }

  getReactSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    fetch('${baseUrl}/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: '${siteId}',
        path: location.pathname + location.search,
        fullUrl: window.location.href,
        referrer: document.referrer
      }),
      keepalive: true
    }).catch(console.error);
  }, [location]);
}`;
  }

  getNextjsSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `// components/AnalyticsScript.tsx (Next.js 13+ App Router)
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
      src="${baseUrl}/sdk/analytics.js"
      data-site-id="${siteId}"
      data-host="${baseUrl}"
      strategy="afterInteractive"
    />
  );
}`;
  }

  getAngularSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `import { Injectable, inject } from '@angular/core';
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
      this.http.post('${baseUrl}/api/analytics/visit', {
        siteId: '${siteId}',
        path: event.urlAfterRedirects,
        fullUrl: window.location.href,
        referrer: document.referrer
      }).subscribe();
    });
  }
}`;
  }

  getVueSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `// router/index.js or main.js (Vue 3 / Nuxt 3)
import { useRouter } from 'vue-router';

export function setupAnalytics(router) {
  router.afterEach((to) => {
    fetch('${baseUrl}/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: '${siteId}',
        path: to.fullPath,
        fullUrl: window.location.origin + to.fullPath,
        referrer: document.referrer
      }),
      keepalive: true
    }).catch(() => {});
  });
}`;
  }

  getSvelteSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `<!-- +layout.svelte (SvelteKit) -->
<script>
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $: if (browser && $page.url) {
    fetch('${baseUrl}/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: '${siteId}',
        path: $page.url.pathname + $page.url.search,
        fullUrl: $page.url.href,
        referrer: document.referrer
      }),
      keepalive: true
    }).catch(() => {});
  }
</script>`;
  }

  getNodeSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `// Express.js Server Middleware (Node.js)
const analyticsMiddleware = (req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/static')) {
    fetch('${baseUrl}/api/analytics/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'] || '',
        'X-Forwarded-For': req.ip
      },
      body: JSON.stringify({
        siteId: '${siteId}',
        path: req.originalUrl || req.path,
        fullUrl: \`\${req.protocol}://\${req.get('host')}\${req.originalUrl}\`,
        referrer: req.headers['referer'] || ''
      })
    }).catch(err => console.error('Analytics record error:', err));
  }
  next();
};

app.use(analyticsMiddleware);`;
  }

  getPythonSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `# Python Flask / FastAPI Integration
import requests
from flask import request

def track_page_visit(path_override=None):
    try:
        payload = {
            "siteId": "${siteId}",
            "path": path_override or request.path,
            "fullUrl": request.url,
            "referrer": request.referrer or ""
        }
        headers = {
            "User-Agent": request.headers.get("User-Agent", ""),
            "X-Forwarded-For": request.remote_addr
        }
        requests.post("${baseUrl}/api/analytics/visit", json=payload, headers=headers, timeout=2)
    except Exception as e:
        print(f"Analytics dispatch error: {e}")`;
  }

  getApiBeaconSnippet(siteId = 'YOUR_APP_TENANT_ID'): string {
    const baseUrl = this.getBaseUrl();
    return `curl -X POST "${baseUrl}/api/analytics/visit" \\
  -H "Content-Type: application/json" \\
  -d '{
    "siteId": "${siteId}",
    "path": "/products/laptop-pro",
    "fullUrl": "https://mystore.com/products/laptop-pro?utm_source=newsletter&utm_medium=email",
    "referrer": "https://google.com",
    "utm_source": "newsletter",
    "utm_medium": "email",
    "utm_campaign": "summer_deal",
    "utm_content": "hero_banner",
    "utm_term": "laptops"
  }'`;
  }

  getApiAnalyticsQuerySnippet(): string {
    const baseUrl = this.getBaseUrl();
    return `# Query Aggregated Analytics
curl -X GET "${baseUrl}/api/admin/analytics?siteId=YOUR_APP_TENANT_ID&startDate=2026-01-01&endDate=2026-12-31" \\
  -H "Authorization: Basic admin:admin123"

# Response Schema:
# {
#   "success": true,
#   "metrics": {
#     "totalVisits": 1420,
#     "genuineVisits": 1280,
#     "botVisits": 90,
#     "threatVisits": 50,
#     "topPages": [{ "path": "/pricing", "count": 310 }],
#     "deviceBreakdown": { "Desktop": 850, "Mobile": 500, "Tablet": 70 },
#     "threatTypes": { "Vulnerability Probe": 35, "DDoS Burst": 15 },
#     "utmCampaigns": [{ "campaign": "summer_deal", "count": 140 }]
#   }
# }`;
  }

  getApiHistoryQuerySnippet(): string {
    const baseUrl = this.getBaseUrl();
    return `# Query Paginated Raw Visit Logs
curl -X GET "${baseUrl}/api/admin/history?siteId=YOUR_APP_TENANT_ID&page=1&limit=10&category=Threat&threatType=Vulnerability%20Probe" \\
  -H "Authorization: Basic admin:admin123"

# Response Schema:
# {
#   "success": true,
#   "data": [
#     {
#       "_id": "66ac64d9f9a21b34c09231f2",
#       "siteId": "consoleapi-products",
#       "path": "/.env",
#       "ip": "185.220.101.5",
#       "country": "Germany",
#       "deviceType": "Bot",
#       "trafficCategory": "Threat",
#       "threatType": "Vulnerability Probe",
#       "threatSeverity": "Critical",
#       "threatReason": "Probing sensitive environment variables (.env)",
#       "timestamp": "2026-08-01T18:05:22.100Z"
#     }
#   ],
#   "pagination": { "total": 45, "page": 1, "limit": 10, "totalPages": 5 }
# }`;
  }

  getApiAppsSnippet(): string {
    const baseUrl = this.getBaseUrl();
    return `# 1. List Registered App Tenants
curl -X GET "${baseUrl}/api/admin/apps" -H "Authorization: Basic admin:admin123"

# 2. Register / Update App Tenant
curl -X POST "${baseUrl}/api/admin/apps" \\
  -H "Authorization: Basic admin:admin123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "siteId": "my-tenant-uuid-1234",
    "name": "E-Commerce Storefront",
    "domain": "https://store.example.com",
    "description": "Production store app"
  }'

# 3. Delete App Tenant
curl -X DELETE "${baseUrl}/api/admin/apps/my-tenant-uuid-1234" -H "Authorization: Basic admin:admin123"`;
  }

  getApiExportImportSnippet(): string {
    const baseUrl = this.getBaseUrl();
    return `# 1. Export JSON Analytics Backup
curl -X GET "${baseUrl}/api/admin/export?format=json&siteId=YOUR_TENANT_ID" \\
  -H "Authorization: Basic admin:admin123" -o analytics_backup.json

# 2. Restore / Import JSON Analytics Dataset
curl -X POST "${baseUrl}/api/admin/import" \\
  -H "Authorization: Basic admin:admin123" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "siteId": "YOUR_TENANT_ID",
      "path": "/dashboard",
      "ip": "203.0.113.195",
      "country": "United States",
      "deviceType": "Desktop",
      "browser": "Chrome",
      "trafficCategory": "Genuine",
      "timestamp": "2026-08-01T12:00:00.000Z"
    }
  ]'`;
  }

  getApiSystemSnippet(): string {
    const baseUrl = this.getBaseUrl();
    return `# Get System Health & MongoDB Cluster Specs
curl -X GET "${baseUrl}/api/admin/system" -H "Authorization: Basic admin:admin123"

# Purge All Visit Logs (Use with caution)
curl -X DELETE "${baseUrl}/api/admin/clear" -H "Authorization: Basic admin:admin123"`;
  }

  getDockerSnippet(): string {
    return `# Dockerfile for Analytics Platform
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
CMD ["node", "server.js"]`;
  }

  getDockerComposeSnippet(): string {
    return `# docker-compose.yml
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
      - ADMIN_PASSWORD=prod_secure_password_here
      - AUTH_SECRET=your_random_secret_key_here
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
  mongo_data:`;
  }

  getPm2Snippet(): string {
    return `# 1. Clone & Build Angular Production Frontend
git clone https://github.com/yourusername/analytics.git
cd analytics
npm install
npm run build

# 2. Environment Variables (.env)
export PORT=3000
export MONGODB_URI="mongodb://localhost:27017/analytics"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your_secure_password"
export AUTH_SECRET="your_jwt_secret_key"

# 3. Start Node.js API & Server via PM2
npm install -g pm2
pm2 start server.js --name "analytics-platform"
pm2 save
pm2 startup`;
  }

  getNginxSnippet(): string {
    return `# /etc/nginx/sites-available/analytics.conf
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
}`;
  }
}



