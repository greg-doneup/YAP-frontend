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
    
    console.log('🔐 AuthGuard checking authentication for route:', state.url);
    console.log('🔐 AuthGuard - isLoggedIn:', this.authService.isLoggedIn);
    console.log('🔐 AuthGuard - authToken:', !!this.authService.authToken);
    console.log('🔐 AuthGuard - currentUser:', this.authService.currentUserValue);
    console.log('🔐 AuthGuard - localStorage user_authenticated:', localStorage.getItem('user_authenticated'));
    console.log('🔐 AuthGuard - localStorage currentUser:', localStorage.getItem('currentUser'));
    console.log('🔐 AuthGuard - localStorage user_wallet:', localStorage.getItem('user_wallet'));
    
    // Check if user is authenticated through AuthService
    if (this.authService.isLoggedIn && this.authService.authToken) {
      console.log('✅ AuthGuard: User is authenticated via authService, allowing access');
      return true;
    }
    
    // Enhanced backup check for our registration flow
    const isUserAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const currentUserStr = localStorage.getItem('currentUser');
    const userWalletStr = localStorage.getItem('user_wallet');
    
    console.log('🔐 AuthGuard - Checking localStorage auth flags:');
    console.log('  - isUserAuthenticated:', isUserAuthenticated);
    console.log('  - has currentUser:', !!currentUserStr);
    console.log('  - has userWallet:', !!userWalletStr);
    
    if (isUserAuthenticated && (currentUserStr || userWalletStr)) {
      console.log('✅ AuthGuard: User is authenticated via localStorage flags, allowing access');
      
      // Reload auth state from localStorage
      try {
        this.authService.loadUserFromStorage();
        console.log('✅ AuthGuard: Successfully reloaded auth state from localStorage');
        return true;
      } catch (error) {
        console.error('❌ AuthGuard: Failed to reload auth state from localStorage:', error);
      }
    }
    
    // Final check: If we have a current user in localStorage but no auth flag, still allow access
    // This handles cases where the user_authenticated flag might have been cleared
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser && currentUser.email) {
          console.log('⚠️ AuthGuard: Found currentUser without auth flag, allowing access and setting flag');
          localStorage.setItem('user_authenticated', 'true');
          this.authService.loadUserFromStorage();
          return true;
        }
      } catch (error) {
        console.error('❌ AuthGuard: Failed to parse currentUser from localStorage:', error);
      }
    }

    // If not authenticated, redirect to welcome screen
    console.log('❌ AuthGuard: User is not authenticated, redirecting to /welcome');
    this.router.navigate(['/welcome']);
    return false;
  }
}
