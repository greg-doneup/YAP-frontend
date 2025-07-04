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
      console.log('WelcomeGuard: User is authenticated via authService, redirecting to /dashboard');
      this.router.navigate(['/dashboard']);
      return false;
    }

    // Backup check for our registration flow (same as AuthGuard)
    const isUserAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const userWallet = localStorage.getItem('user_wallet');
    const currentUser = localStorage.getItem('currentUser');
    
    console.log('WelcomeGuard - Checking localStorage auth flags:');
    console.log('  - isUserAuthenticated:', isUserAuthenticated);
    console.log('  - has currentUser:', !!currentUser);
    console.log('  - has userWallet:', !!userWallet);
    
    if (isUserAuthenticated && (currentUser || userWallet)) {
      console.log('WelcomeGuard: User is authenticated via localStorage flags, redirecting to /dashboard');
      // Refresh auth state if needed
      this.authService.loadUserFromStorage();
      this.router.navigate(['/dashboard']);
      return false;
    }
    
    // Final check: If we have a current user in localStorage but no auth flag, still redirect to dashboard
    // This handles cases where the user_authenticated flag might have been cleared (same as AuthGuard)
    if (currentUser) {
      try {
        const parsedUser = JSON.parse(currentUser);
        if (parsedUser && parsedUser.email) {
          console.log('⚠️ WelcomeGuard: Found currentUser without auth flag, redirecting to dashboard and setting flag');
          localStorage.setItem('user_authenticated', 'true');
          this.authService.loadUserFromStorage();
          this.router.navigate(['/dashboard']);
          return false;
        }
      } catch (error) {
        console.error('❌ WelcomeGuard: Failed to parse currentUser from localStorage:', error);
      }
    }

    // If not authenticated, allow access to welcome screen
    console.log('WelcomeGuard: User is not authenticated, allowing access to welcome');
    return true;
  }
}
