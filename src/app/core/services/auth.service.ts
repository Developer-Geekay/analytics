import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';

export interface AdminUser {
  username: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AdminUser;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  // Authentication Signals
  isAuthenticated = signal<boolean>(false);
  currentUser = signal<AdminUser | null>(null);
  isAuthChecking = signal<boolean>(true);
  isLoggingIn = signal<boolean>(false);
  loginError = signal<string | null>(null);

  private readonly TOKEN_KEY = 'analytics_admin_token';

  constructor() {
    this.checkAuth();
  }

  getToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  checkAuth(): void {
    const token = this.getToken();
    if (!token) {
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
      this.isAuthChecking.set(false);
      return;
    }

    this.http.get<AuthResponse>('/api/admin/me', { headers: this.getAuthHeaders() }).pipe(
      tap((res) => {
        if (res.success && res.user) {
          this.isAuthenticated.set(true);
          this.currentUser.set(res.user);
        } else {
          this.clearAuth();
        }
        this.isAuthChecking.set(false);
      }),
      catchError(() => {
        this.clearAuth();
        this.isAuthChecking.set(false);
        return of(null);
      })
    ).subscribe();
  }

  login(username: string, password: string): Observable<AuthResponse> {
    this.isLoggingIn.set(true);
    this.loginError.set(null);

    return this.http.post<AuthResponse>('/api/admin/login', { username, password }).pipe(
      tap((res) => {
        this.isLoggingIn.set(false);
        if (res.success && res.token && res.user) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.TOKEN_KEY, res.token);
          }
          this.isAuthenticated.set(true);
          this.currentUser.set(res.user);
        } else {
          this.loginError.set(res.error || 'Invalid credentials');
        }
      }),
      catchError((err) => {
        this.isLoggingIn.set(false);
        const errorMsg = err.error?.error || 'Authentication server unreachable';
        this.loginError.set(errorMsg);
        return of({ success: false, error: errorMsg });
      })
    );
  }

  logout(): void {
    this.http.post('/api/admin/logout', {}, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.clearAuth()),
      catchError(() => {
        this.clearAuth();
        return of(null);
      })
    ).subscribe();
  }

  clearAuth(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }
}
