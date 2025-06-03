import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpClient
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { TokenService } from './token/token.service';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private baseUrl = environment.apiUrl;
  
  constructor(
    private tokenService: TokenService,
    private http: HttpClient,
    private router: Router
  ) {}
  
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip token processing for auth endpoints to prevent infinite loops
    if (this.isAuthEndpoint(request.url)) {
      return next.handle(request);
    }
    
    // Add token to all requests if available
    const token = this.tokenService.getToken();
    if (token) {
      request = this.addToken(request, token);
    }
    
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Try to refresh the token if we have a refresh token
          const refreshToken = this.tokenService.getRefreshToken();
          if (refreshToken) {
            return this.handle401Error(request, next);
          } else {
            // No refresh token, navigate to login
            this.router.navigate(['/welcome'], {
              queryParams: { returnUrl: this.router.url }
            });
          }
        }
        
        return throwError(() => error);
      })
    );
  }
  
  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);
      
      // Get the refresh token directly from TokenService
      const refreshToken = this.tokenService.getRefreshToken();
      
      if (!refreshToken) {
        this.isRefreshing = false;
        this.router.navigate(['/welcome']);
        return throwError(() => new Error('No refresh token available'));
      }
      
      // Direct HTTP call to refresh token without using AuthService
      // to avoid circular dependency
      return this.http.post<any>(`${this.baseUrl}/auth/refresh`, { refreshToken }).pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          
          // Store the new tokens
          if (response.token) {
            this.tokenService.setToken(response.token);
            if (response.refreshToken) {
              this.tokenService.setRefreshToken(response.refreshToken);
            }
            
            this.refreshTokenSubject.next(response.token);
            
            // Clone the original request with the new token
            return next.handle(this.addToken(request, response.token));
          } else {
            // If no token in response, treat as error
            throw new Error('Invalid token refresh response');
          }
        }),
        catchError((err) => {
          this.isRefreshing = false;
          
          // If refresh token fails, redirect to welcome
          this.tokenService.clearTokens();
          this.router.navigate(['/welcome']);
          
          return throwError(() => err);
        })
      );
    } else {
      // Wait until refreshTokenSubject has a non-null value (the new token)
      // then retry the request with the new token
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => next.handle(this.addToken(request, token)))
      );
    }
  }
  
  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  private isAuthEndpoint(url: string): boolean {
    // Skip token refresh for auth endpoints to prevent loops
    const authEndpoints = [
      // Auth endpoints
      'auth/login',
      'auth/register',
      'auth/refresh',
      'auth/verify',
      'auth/wallet',
      
      // Wallet endpoints - these can be auth-related and should skip the token refresh process
      'wallet/',
      'wallet/email',
      'wallet/waitlist',
      'wallet/waitlist-signup',
      'wallet/signup',
      'wallet/login',
      'wallet/recover',
      'wallet/secure-account',
      'wallet/secure',
      
      // Health checks
      'health',
      'healthz',
      
      // Waitlist endpoints
      'waitlist'
    ];
    
    return authEndpoints.some(endpoint => url.includes(endpoint));
  }
}