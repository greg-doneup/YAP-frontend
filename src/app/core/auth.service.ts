import { Injectable } from '@angular/core';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { ApiService } from './api-service.service';
import { Router } from '@angular/router';

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}
  
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.apiService.post<AuthResponse>('auth/login', credentials)
      .pipe(
        tap(response => {
          this.setSession(response);
          this.isAuthenticatedSubject.next(true);
        })
      );
  }
  
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/auth/login']);
  }
  
  private setSession(authResponse: AuthResponse): void {
    localStorage.setItem('auth_token', authResponse.token);
    localStorage.setItem('user_id', authResponse.user.id);
  }
  
  private hasToken(): boolean {
    return !!localStorage.getItem('auth_token');
  }
}