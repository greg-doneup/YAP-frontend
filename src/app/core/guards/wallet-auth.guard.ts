import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { WalletAuthService } from '../auth/wallet-auth.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class WalletAuthGuard implements CanActivate {
  
  constructor(
    private walletAuthService: WalletAuthService,
    private authService: AuthService, // Keep for backward compatibility
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log('🔐 WalletAuthGuard checking authentication for route:', state.url);
    
    // Make this async to wait for wallet initialization
    return this.checkAuthenticationAsync(state.url);
  }

  private async checkAuthenticationAsync(url: string): Promise<boolean> {
    console.log('🔐 WalletAuthGuard - Starting async authentication check for:', url);
    
    // Force wallet authentication refresh and wait for it to complete
    try {
      await this.walletAuthService.refreshWalletAuth();
      console.log('🔐 WalletAuthGuard - Wallet auth refresh completed');
    } catch (error) {
      console.warn('🔐 WalletAuthGuard - Wallet auth refresh failed:', error);
    }
    
    console.log('🔐 WalletAuthGuard - Wallet-based auth:', this.walletAuthService.isAuthenticated);
    console.log('🔐 WalletAuthGuard - Auth strength:', this.walletAuthService.authStrength);
    console.log('🔐 WalletAuthGuard - Current wallet user:', this.walletAuthService.currentWalletUser);
    
    // Primary check: Wallet-based authentication
    if (this.walletAuthService.isAuthenticated) {
      console.log('✅ WalletAuthGuard: User is authenticated via wallet, allowing access');
      
      // Ensure backward compatibility by syncing with AuthService
      const legacyUser = this.walletAuthService.toLegacyUser();
      if (legacyUser && !this.authService.currentUserValue) {
        console.log('🔄 Syncing wallet auth with legacy AuthService');
        // Force AuthService to load from localStorage
        this.authService.loadUserFromStorage();
      }
      
      return true;
    }
    
    // Fallback: Check legacy authentication for backward compatibility
    console.log('🔄 WalletAuthGuard: No wallet auth, checking legacy authentication...');
    
    // Check if user is authenticated through legacy AuthService
    if (this.authService.isLoggedIn && this.authService.authToken) {
      console.log('✅ WalletAuthGuard: User is authenticated via legacy authService, allowing access');
      return true;
    }
    
    // Enhanced backup check for legacy registration flow
    const isUserAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const currentUserStr = localStorage.getItem('currentUser');
    const userWalletStr = localStorage.getItem('user_wallet');
    
    console.log('🔐 WalletAuthGuard - Checking legacy localStorage auth flags:');
    console.log('  - isUserAuthenticated:', isUserAuthenticated);
    console.log('  - has currentUser:', !!currentUserStr);
    console.log('  - has userWallet:', !!userWalletStr);
    
    if (isUserAuthenticated && (currentUserStr || userWalletStr)) {
      console.log('✅ WalletAuthGuard: User is authenticated via legacy localStorage flags, allowing access');
      console.log('🔄 Refreshing wallet authentication to sync state');
      
      // Try to refresh wallet auth to sync with legacy data
      this.walletAuthService.refreshWalletAuth();
      
      // Refresh auth state if needed
      this.authService.loadUserFromStorage();
      return true;
    }
    
    // Final check: If we have a current user in localStorage but no auth flag, still allow access
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser && currentUser.email) {
          console.log('⚠️ WalletAuthGuard: Found currentUser without auth flag, allowing access and setting flag');
          localStorage.setItem('user_authenticated', 'true');
          this.authService.loadUserFromStorage();
          this.walletAuthService.refreshWalletAuth();
          return true;
        }
      } catch (error) {
        console.error('❌ WalletAuthGuard: Failed to parse currentUser from localStorage:', error);
      }
    }

    // If not authenticated, redirect to welcome screen
    console.log('❌ WalletAuthGuard: User is not authenticated, redirecting to /welcome');
    this.router.navigate(['/welcome']);
    return false;
  }
}
