import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip token refresh for auth endpoints to prevent infinite loops
    if (this.isAuthEndpoint(request.url)) {
      return next.handle(request);
    }
    
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Try to refresh the token if we have a refresh token
          if (this.authService.refreshToken) {
            return this.handle401Error(request, next);
          } else {
            // No refresh token, navigate to login
            this.router.navigate(['/auth/login'], {
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
      
      return this.authService.refreshAccessToken().pipe(
        switchMap((token: string) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token);
          
          // Clone the original request with the new token
          return next.handle(this.addToken(request, token));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          
          // If refresh token fails, redirect to login
          this.router.navigate(['/auth/login'], {
            queryParams: { returnUrl: this.router.url }
          });
          
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
      'auth/login',
      'auth/register',
      'auth/refresh',
      'auth/verify'
    ];
    
    return authEndpoints.some(endpoint => url.includes(endpoint));
  }
}