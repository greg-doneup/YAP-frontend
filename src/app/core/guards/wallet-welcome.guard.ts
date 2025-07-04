import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { WalletAuthService } from '../auth/wallet-auth.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class WalletWelcomeGuard implements CanActivate {

  constructor(
    private walletAuthService: WalletAuthService,
    private authService: AuthService, // Keep for backward compatibility
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log('🏠 WalletWelcomeGuard checking authentication for route:', state.url);
    
    // Make this async to wait for wallet initialization
    return this.checkAuthenticationAsync(state.url);
  }

  private async checkAuthenticationAsync(url: string): Promise<boolean> {
    console.log('🏠 WalletWelcomeGuard - Starting async authentication check for:', url);
    
    // Force wallet authentication refresh and wait for it to complete
    try {
      await this.walletAuthService.refreshWalletAuth();
      console.log('🏠 WalletWelcomeGuard - Wallet auth refresh completed');
    } catch (error) {
      console.warn('🏠 WalletWelcomeGuard - Wallet auth refresh failed:', error);
    }
    
    console.log('🏠 WalletWelcomeGuard - Wallet-based auth:', this.walletAuthService.isAuthenticated);
    console.log('🏠 WalletWelcomeGuard - Auth strength:', this.walletAuthService.authStrength);
    console.log('🏠 WalletWelcomeGuard - Current wallet user:', this.walletAuthService.currentWalletUser);
    
    // Primary check: Wallet-based authentication
    if (this.walletAuthService.isAuthenticated) {
      console.log('🔄 WalletWelcomeGuard: User is authenticated via wallet, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
      return false;
    }
    
    // Fallback: Check legacy authentication for backward compatibility
    console.log('🔄 WalletWelcomeGuard: No wallet auth, checking legacy authentication...');
    
    // Check if user is authenticated through legacy AuthService
    if (this.authService.isLoggedIn && this.authService.authToken) {
      console.log('🔄 WalletWelcomeGuard: User is authenticated via legacy authService, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
      return false;
    }
    
    // Enhanced backup check for legacy registration flow
    const isUserAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const currentUserStr = localStorage.getItem('currentUser');
    const userWalletStr = localStorage.getItem('user_wallet');
    
    console.log('🏠 WalletWelcomeGuard - Checking legacy localStorage auth flags:');
    console.log('  - isUserAuthenticated:', isUserAuthenticated);
    console.log('  - has currentUser:', !!currentUserStr);
    console.log('  - has userWallet:', !!userWalletStr);
    
    if (isUserAuthenticated && (currentUserStr || userWalletStr)) {
      console.log('🔄 WalletWelcomeGuard: User is authenticated via legacy localStorage flags, redirecting to dashboard');
      
      // Try to refresh wallet auth to sync with legacy data
      this.walletAuthService.refreshWalletAuth();
      
      // Refresh auth state if needed
      this.authService.loadUserFromStorage();
      
      this.router.navigate(['/dashboard']);
      return false;
    }
    
    // Final check: If we have a current user in localStorage but no auth flag, redirect to dashboard
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser && currentUser.email) {
          console.log('⚠️ WalletWelcomeGuard: Found currentUser without auth flag, setting flag and redirecting to dashboard');
          localStorage.setItem('user_authenticated', 'true');
          this.authService.loadUserFromStorage();
          this.walletAuthService.refreshWalletAuth();
          this.router.navigate(['/dashboard']);
          return false;
        }
      } catch (error) {
        console.error('❌ WalletWelcomeGuard: Failed to parse currentUser from localStorage:', error);
      }
    }

    // If not authenticated, allow access to welcome page
    console.log('✅ WalletWelcomeGuard: User is not authenticated, allowing access to welcome page');
    return true;
  }
}
