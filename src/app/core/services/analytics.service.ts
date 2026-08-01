import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { AnalyticsSummary, RegisteredApp } from '../models/analytics.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  summary = signal<AnalyticsSummary | null>(null);
  selectedSiteId = signal<string>('all');
  registeredApps = signal<RegisteredApp[]>([]);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  toastMessage = signal<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  showToast(text: string, type: 'success' | 'info' | 'error' = 'info'): void {
    this.toastMessage.set({ text, type });
    setTimeout(() => {
      if (this.toastMessage()?.text === text) {
        this.toastMessage.set(null);
      }
    }, 3500);
  }

  fetchAnalytics(siteId: string = 'all', silent = false): Observable<any> {
    if (!silent) this.isLoading.set(true);
    this.error.set(null);
    this.selectedSiteId.set(siteId);

    const query = siteId && siteId !== 'all' ? `?siteId=${encodeURIComponent(siteId)}` : '';

    return this.http.get<any>(`/api/admin/analytics${query}`, { headers: this.authService.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.summary.set(res.data);
        } else {
          this.error.set(res.error || 'Failed to fetch analytics data');
        }
        if (!silent) this.isLoading.set(false);
      }),
      catchError((err) => {
        if (err.status === 401) {
          this.authService.clearAuth();
        }
        this.error.set(err.error?.error || 'Error connecting to analytics backend API');
        if (!silent) this.isLoading.set(false);
        return of(null);
      })
    );
  }

  fetchHistory(params: { siteId?: string; search?: string; device?: string; category?: string; page?: number; limit?: number }): Observable<any> {
    const queryParams: string[] = [];
    if (params.siteId && params.siteId !== 'all') queryParams.push(`siteId=${encodeURIComponent(params.siteId)}`);
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params.device && params.device !== 'all') queryParams.push(`device=${encodeURIComponent(params.device)}`);
    if (params.category && params.category !== 'all') queryParams.push(`category=${encodeURIComponent(params.category)}`);
    if (params.page) queryParams.push(`page=${params.page}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);

    const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';

    return this.http.get<any>(`/api/admin/history${queryString}`, { headers: this.authService.getAuthHeaders() }).pipe(
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        return of({ success: false, visits: [], total: 0, totalPages: 1 });
      })
    );
  }

  fetchApps(): Observable<any> {
    return this.http.get<any>('/api/admin/apps', { headers: this.authService.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.registeredApps.set(res.data);
        }
      }),
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        return of(null);
      })
    );
  }

  registerApp(appData: { siteId: string; name: string; domain?: string; description?: string; status?: string }): Observable<any> {
    return this.http.post<any>('/api/admin/apps', appData, { headers: this.authService.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success) {
          this.showToast(`App "${appData.name}" saved successfully!`, 'success');
          this.fetchApps().subscribe();
          this.fetchAnalytics(this.selectedSiteId(), true).subscribe();
        }
      }),
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        this.showToast(err.error?.error || 'Failed to save application tenant', 'error');
        return of(null);
      })
    );
  }

  deleteApp(siteId: string): Observable<any> {
    return this.http.delete<any>(`/api/admin/apps/${encodeURIComponent(siteId)}`, { headers: this.authService.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success) {
          this.showToast('App tenant unregistered successfully', 'info');
          this.fetchApps().subscribe();
          this.fetchAnalytics(this.selectedSiteId(), true).subscribe();
        }
      }),
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        return of(null);
      })
    );
  }

  fetchSystemInfo(): Observable<any> {
    return this.http.get<any>('/api/admin/system', { headers: this.authService.getAuthHeaders() }).pipe(
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        return of(null);
      })
    );
  }

  clearAnalytics(siteId = 'all'): Observable<any> {
    const query = siteId && siteId !== 'all' ? `?siteId=${encodeURIComponent(siteId)}` : '';
    return this.http.delete<any>(`/api/admin/analytics${query}`, { headers: this.authService.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success) {
          this.showToast(res.message || 'Analytics visit logs purged!', 'success');
          this.fetchAnalytics(this.selectedSiteId(), true).subscribe();
        }
      }),
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        return of(null);
      })
    );
  }

  importVisits(visits: any[]): Observable<any> {
    return this.http.post<any>('/api/admin/import', { visits }, { headers: this.authService.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success) {
          this.showToast(res.message || 'Visits imported successfully!', 'success');
          this.fetchAnalytics(this.selectedSiteId(), true).subscribe();
        }
      }),
      catchError((err) => {
        if (err.status === 401) this.authService.clearAuth();
        return of({ success: false, error: err.error?.error || 'Failed to import visits' });
      })
    );
  }
}
