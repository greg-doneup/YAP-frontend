import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log('AuthGuard checking authentication for route:', state.url);
    console.log('AuthGuard - isLoggedIn:', this.authService.isLoggedIn);
    console.log('AuthGuard - authToken:', !!this.authService.authToken);
    console.log('AuthGuard - currentUser:', this.authService.currentUserValue);
    console.log('AuthGuard - localStorage user_authenticated:', localStorage.getItem('user_authenticated'));
    
    // Check if user is authenticated through AuthService
    if (this.authService.isLoggedIn && this.authService.authToken) {
      console.log('AuthGuard: User is authenticated via authService, allowing access');
      return true;
    }
    
    // Backup check for our registration flow
    const isUserAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const userWallet = localStorage.getItem('user_wallet');
    if (isUserAuthenticated && userWallet) {
      console.log('AuthGuard: User is authenticated via localStorage flags, allowing access');
      // Refresh auth state if needed
      this.authService.loadUserFromStorage();
      return true;
    }

    // If not authenticated, redirect to welcome screen
    console.log('AuthGuard: User is not authenticated, redirecting to /welcome');
    this.router.navigate(['/welcome']);
    return false;
  }
}
