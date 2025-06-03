import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class WelcomeGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log('WelcomeGuard checking authentication for route:', state.url);
    console.log('WelcomeGuard - isLoggedIn:', this.authService.isLoggedIn);
    console.log('WelcomeGuard - authToken:', !!this.authService.authToken);
    console.log('WelcomeGuard - currentUser:', this.authService.currentUserValue);
    
    // Check if user is authenticated (has valid JWT token)
    if (this.authService.isLoggedIn && this.authService.authToken) {
      // If authenticated, redirect to dashboard
      console.log('WelcomeGuard: User is authenticated, redirecting to /dashboard');
      this.router.navigate(['/dashboard']);
      return false;
    }

    // If not authenticated, allow access to welcome screen
    console.log('WelcomeGuard: User is not authenticated, allowing access to welcome');
    return true;
  }
}
