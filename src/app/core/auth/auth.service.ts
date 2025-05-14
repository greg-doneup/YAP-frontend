import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../api-service.service';
import { ErrorService } from '../error/error.service';

export interface User {
  id: string;
  email: string;
  username?: string;
  roles?: string[];
  walletAddress?: string;
  ethWalletAddress?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
  name?: string;
  role?: string;
  walletAddress?: string;
  ethWalletAddress?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';
  private refreshTokenKey = 'refresh_token';
  private refreshingToken = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private apiService: ApiService,
    private errorService: ErrorService
  ) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      this.validateToken(token).subscribe();
    }
  }

  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get authToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  public get refreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  login(credentials: LoginCredentials): Observable<User> {
    return this.apiService.post<AuthResponse>('auth/login', credentials)
      .pipe(
        map(response => this.handleAuthResponse(response)),
        catchError(error => {
          this.errorService.handleError(error, 'login-failed');
          return throwError(() => error);
        })
      );
  }

  register(userData: RegisterData): Observable<User> {
    return this.apiService.post<AuthResponse>('auth/register', userData)
      .pipe(
        map(response => this.handleAuthResponse(response)),
        catchError(error => {
          this.errorService.handleError(error, 'registration-failed');
          return throwError(() => error);
        })
      );
  }

  logout(): Observable<void> {
    const refreshToken = this.refreshToken;
    this.clearAuthData();
    if (refreshToken) {
      return this.apiService.post<void>('auth/revoke', { refreshToken })
        .pipe(
          catchError(error => {
            console.error("Failed to revoke refresh token:", error);
            return of(void 0);
          })
        );
    } else {
      return of(void 0);
    }
  }

  validateToken(token: string): Observable<User> {
    return this.apiService.get<AuthResponse>('auth/validate')
      .pipe(
        map(response => {
          if (!response.refreshToken) {
            response.refreshToken = this.refreshToken || '';
          }
          return this.handleAuthResponse(response);
        }),
        catchError(error => {
          this.clearAuthData();
          this.errorService.handleError(error, 'token-validation-failed');
          return throwError(() => error);
        })
      );
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshingToken) {
      return this.refreshTokenSubject.asObservable()
        .pipe(
          switchMap(token => {
            if (token) {
              return of(token);
            }
            return throwError(() => new Error('Refresh token is null during refresh process'));
          })
        );
    }
    
    this.refreshingToken = true;
    this.refreshTokenSubject.next(null);
    
    const refreshToken = this.refreshToken;
    
    if (!refreshToken) {
      this.refreshingToken = false;
      return throwError(() => new Error('No refresh token available'));
    }
    
    return this.apiService.post<AuthResponse>('auth/refresh', { refreshToken })
      .pipe(
        map(response => {
          localStorage.setItem(this.tokenKey, response.token);
          localStorage.setItem(this.refreshTokenKey, response.refreshToken);
          
          if (response.userId && this.currentUserValue) {
            const updatedUser = { ...this.currentUserValue };
            if (response.walletAddress) updatedUser.walletAddress = response.walletAddress;
            if (response.ethWalletAddress) updatedUser.ethWalletAddress = response.ethWalletAddress;
            this.currentUserSubject.next(updatedUser);
          }
          
          this.refreshingToken = false;
          this.refreshTokenSubject.next(response.token);
          
          return response.token;
        }),
        catchError(error => {
          this.refreshingToken = false;
          if (error?.status === 401) {
            this.clearAuthData();
          }
          this.errorService.handleError(error, 'token-refresh-failed');
          return throwError(() => error);
        })
      );
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.apiService.post<void>('auth/password-reset/request', { email })
      .pipe(
        catchError(error => {
          this.errorService.handleError(error, 'password-reset-request-failed');
          return throwError(() => error);
        })
      );
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.apiService.post<void>('auth/password-reset/confirm', {
      token,
      newPassword
    }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'password-reset-failed');
        return throwError(() => error);
      })
    );
  }
  
  revokeToken(token: string): Observable<void> {
    return this.apiService.post<void>('auth/revoke', { refreshToken: token })
      .pipe(
        catchError(error => {
          this.errorService.handleError(error, 'token-revocation-failed');
          return throwError(() => error);
        })
      );
  }

  private handleAuthResponse(response: AuthResponse): User {
    const user: User = {
      id: response.userId,
      email: response.email,
      walletAddress: response.walletAddress,
      ethWalletAddress: response.ethWalletAddress
    };
    
    localStorage.setItem(this.tokenKey, response.token);
    if (response.refreshToken) {
      localStorage.setItem(this.refreshTokenKey, response.refreshToken);
    }
    
    this.currentUserSubject.next(user);
    return user;
  }
  
  private clearAuthData(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    this.currentUserSubject.next(null);
    this.refreshTokenSubject.next(null);
  }
}
