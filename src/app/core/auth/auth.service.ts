import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { ApiService } from '../api-service.service';
import { ErrorService } from '../error/error.service';

export interface User {
  id: string;
  email: string;
  username?: string;
  roles?: string[];
  walletAddress?: string;
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
  userId: string;
  email: string;
  name?: string;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';

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
    return this.apiService.post<void>('auth/logout', {})
      .pipe(
        tap(() => {
          localStorage.removeItem(this.tokenKey);
          this.currentUserSubject.next(null);
        }),
        catchError(error => {
          localStorage.removeItem(this.tokenKey);
          this.currentUserSubject.next(null);
          this.errorService.handleError(error, 'logout-failed');
          return throwError(() => error);
        })
      );
  }

  validateToken(token: string): Observable<User> {
    return this.apiService.get<AuthResponse>('auth/validate')
      .pipe(
        map(response => this.handleAuthResponse(response)),
        catchError(error => {
          localStorage.removeItem(this.tokenKey);
          this.currentUserSubject.next(null);
          this.errorService.handleError(error, 'token-validation-failed');
          return throwError(() => error);
        })
      );
  }

  refreshToken(): Observable<string> {
    return this.apiService.post<{ token: string }>('auth/refresh', {})
      .pipe(
        tap(response => {
          localStorage.setItem(this.tokenKey, response.token);
        }),
        map(response => response.token),
        catchError(error => {
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

  private handleAuthResponse(response: AuthResponse): User {
    const user = {
      id: response.userId,
      email: response.email,
      name: response.name,
      role: response.role
    };
    localStorage.setItem(this.tokenKey, response.token);
    this.currentUserSubject.next(user);
    return user;
  }
}
