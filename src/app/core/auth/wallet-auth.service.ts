// Wallet-First Authentication Service
// This service makes wallet presence the primary source of authentication

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CryptoBrowserService } from '../../shared/services/crypto-browser.service';
import { TokenService } from '../token/token.service';

export interface WalletUser {
  email: string;
  seiAddress: string;
  evmAddress: string;
  hasWallet: boolean;
  isAuthenticated: boolean;
  lastWalletCheck?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WalletAuthService {
  private currentWalletUserSubject = new BehaviorSubject<WalletUser | null>(null);
  public currentWalletUser$ = this.currentWalletUserSubject.asObservable();

  constructor(
    private cryptoService: CryptoBrowserService,
    private tokenService: TokenService
  ) {
    // Initialize wallet authentication on service startup
    this.initializeWalletAuth();
  }

  /**
   * Initialize wallet-based authentication
   * This checks for wallet presence first, then tries to restore user data
   */
  private async initializeWalletAuth(): Promise<void> {
    console.log('🔐 Initializing wallet-first authentication...');

    try {
      // Step 1: Check if we have any wallets in IndexedDB
      const availableWallets = await this.getAvailableWallets();
      
      if (availableWallets.length === 0) {
        console.log('❌ No wallets found in IndexedDB - user not authenticated');
        this.currentWalletUserSubject.next(null);
        return;
      }

      // Step 2: If we have wallets, try to restore user data from localStorage
      const primaryWallet = availableWallets[0]; // Use first wallet as primary
      const storedEmail = this.getStoredEmailForWallet(primaryWallet);
      
      if (!storedEmail) {
        console.log('⚠️ Wallet found but no email mapping - partial authentication');
        // We have wallet but no email - still authenticate but mark as incomplete
        const walletUser: WalletUser = {
          email: `wallet-${primaryWallet.seiAddress.slice(-8)}@local.wallet`,
          seiAddress: primaryWallet.seiAddress,
          evmAddress: primaryWallet.evmAddress,
          hasWallet: true,
          isAuthenticated: true,
          lastWalletCheck: new Date()
        };
        
        this.currentWalletUserSubject.next(walletUser);
        console.log('✅ Wallet-based authentication successful (no email)');
        return;
      }

      // Step 3: Full authentication - we have both wallet and email
      const walletUser: WalletUser = {
        email: storedEmail,
        seiAddress: primaryWallet.seiAddress,
        evmAddress: primaryWallet.evmAddress,
        hasWallet: true,
        isAuthenticated: true,
        lastWalletCheck: new Date()
      };

      this.currentWalletUserSubject.next(walletUser);
      console.log('✅ Full wallet-based authentication successful:', {
        email: walletUser.email,
        seiAddress: walletUser.seiAddress,
        evmAddress: walletUser.evmAddress
      });

    } catch (error) {
      console.error('❌ Error during wallet authentication initialization:', error);
      this.currentWalletUserSubject.next(null);
    }
  }

  /**
   * Get all available wallets from IndexedDB
   */
  private async getAvailableWallets(): Promise<Array<{seiAddress: string, evmAddress: string, email?: string}>> {
    const wallets: Array<{seiAddress: string, evmAddress: string, email?: string}> = [];

    try {
      // Check YAP-SecureWallets database (primary)
      const secureWallets = await this.cryptoService.getAllWalletsFromSecureDB();
      if (secureWallets && secureWallets.length > 0) {
        wallets.push(...secureWallets.map((wallet: any) => ({
          seiAddress: wallet.seiAddress,
          evmAddress: wallet.evmAddress,
          email: wallet.email
        })));
      }

      // Check legacy wallet metadata if no secure wallets found
      if (wallets.length === 0) {
        const legacyAddresses = await this.cryptoService.getWalletAddresses();
        if (legacyAddresses) {
          wallets.push({
            seiAddress: legacyAddresses.seiAddress,
            evmAddress: legacyAddresses.evmAddress
          });
        }
      }

      console.log(`Found ${wallets.length} wallet(s) in IndexedDB`);
      return wallets;
    } catch (error) {
      console.error('Error getting available wallets:', error);
      return [];
    }
  }

  /**
   * Get stored email for a wallet from localStorage
   */
  private getStoredEmailForWallet(wallet: {seiAddress: string, evmAddress: string}): string | null {
    try {
      // Check if we have a currentUser in localStorage
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser.email && (
          currentUser.walletAddress === wallet.seiAddress || 
          currentUser.ethWalletAddress === wallet.evmAddress
        )) {
          return currentUser.email;
        }
      }

      // Check wallet_addresses in localStorage  
      const walletAddressesStr = localStorage.getItem('user_wallet');
      if (walletAddressesStr) {
        const walletData = JSON.parse(walletAddressesStr);
        if (walletData.sei_address === wallet.seiAddress || walletData.eth_address === wallet.evmAddress) {
          // Try to find associated email
          const userEmail = localStorage.getItem('user_email');
          if (userEmail) {
            return userEmail;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting stored email for wallet:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated based on wallet presence
   */
  public get isAuthenticated(): boolean {
    const currentUser = this.currentWalletUserSubject.value;
    return !!(currentUser && currentUser.hasWallet && currentUser.isAuthenticated);
  }

  /**
   * Get current wallet user
   */
  public get currentWalletUser(): WalletUser | null {
    return this.currentWalletUserSubject.value;
  }

  /**
   * Convert wallet user to legacy user format for compatibility
   */
  public toLegacyUser(): any | null {
    const walletUser = this.currentWalletUser;
    if (!walletUser) return null;

    return {
      id: `wallet-${walletUser.seiAddress.slice(-8)}`,
      email: walletUser.email,
      walletAddress: walletUser.seiAddress,
      ethWalletAddress: walletUser.evmAddress
    };
  }

  /**
   * Force refresh wallet authentication
   */
  public async refreshWalletAuth(): Promise<void> {
    console.log('🔄 Refreshing wallet authentication...');
    await this.initializeWalletAuth();
  }

  /**
   * Complete wallet authentication after registration
   */
  public async completeWalletAuth(email: string, seiAddress: string, evmAddress: string): Promise<void> {
    console.log('✅ Completing wallet authentication after registration');
    
    const walletUser: WalletUser = {
      email,
      seiAddress,
      evmAddress,
      hasWallet: true,
      isAuthenticated: true,
      lastWalletCheck: new Date()
    };

    this.currentWalletUserSubject.next(walletUser);

    // Also update localStorage for backward compatibility
    localStorage.setItem('user_authenticated', 'true');
    localStorage.setItem('currentUser', JSON.stringify(this.toLegacyUser()));
    localStorage.setItem('user_wallet', JSON.stringify({
      sei_address: seiAddress,
      eth_address: evmAddress
    }));
    localStorage.setItem('user_email', email);

    console.log('✅ Wallet authentication completed successfully');
  }

  /**
   * Logout - clear wallet authentication
   */
  public async logout(): Promise<void> {
    console.log('🚪 Logging out - clearing wallet authentication');
    
    this.currentWalletUserSubject.next(null);
    
    // Clear localStorage flags
    localStorage.removeItem('user_authenticated');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user_wallet');
    localStorage.removeItem('user_email');
    
    // Clear tokens
    this.tokenService.clearTokens();
    
    console.log('✅ Wallet authentication cleared');
  }

  /**
   * Check if the current authentication is wallet-based (vs traditional JWT-based)
   */
  public get isWalletBasedAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get wallet authentication strength
   */
  public get authStrength(): 'none' | 'wallet-only' | 'wallet-with-email' | 'full' {
    const walletUser = this.currentWalletUser;
    
    if (!walletUser) return 'none';
    if (!walletUser.hasWallet) return 'none';
    if (walletUser.email.includes('@local.wallet')) return 'wallet-only';
    if (walletUser.email && !this.tokenService.getToken()) return 'wallet-with-email';
    return 'full';
  }
}
