// This file contains extensions to the auth service for registration functionality

import { Injectable } from '@angular/core';
import { WalletCreationResult } from '../../../../../services/wallet.service';
import { StandardWalletCreationResult } from './registration.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../core/auth/auth.service';
import { TokenService } from '../../../../../core/token/token.service';
import { WalletStorageService, WalletStorageData } from '../../../../../services/wallet-storage.service';
import { environment } from '../../../../../../environments/environment';
import { WalletAuthService } from '../../../../../core/auth/wallet-auth.service';

@Injectable({
  providedIn: 'root'
})
export class RegistrationAuthService {
  constructor(
    private router: Router,
    private authService: AuthService,
    private tokenService: TokenService,
    private walletStorageService: WalletStorageService,
    private walletAuthService: WalletAuthService
  ) {}
  
  /**
   * Complete authentication after wallet creation/retrieval
   */
  async completeAuthentication(result: StandardWalletCreationResult, email: string): Promise<void> {
    console.log('🔍 [DEBUG] completeAuthentication called with:');
    console.log('  result:', result);
    console.log('  email:', email);
    console.log('  result.token:', result.token);
    console.log('  result.userId:', result.userId);
    
    try {
      // Check if we already have tokens from the registration response
      if (result.token) {
        console.log('✅ Using tokens from registration response');
        
        // Use tokens from the registration response
        this.tokenService.setToken(result.token);
        if (result.refreshToken) {
          this.tokenService.setRefreshToken(result.refreshToken);
        }
        
        // Store user information with wallet addresses
        const user = {
          id: result.userId || `user_${Math.random().toString(36).substring(2, 15)}`,
          email: email,
          walletAddress: result.walletAddress || result.sei_address,
          ethWalletAddress: result.ethWalletAddress || result.eth_address,
          createdAt: new Date().toISOString() // Add creation timestamp for new user detection
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_wallet', JSON.stringify({
          sei_address: result.walletAddress || result.sei_address,
          eth_address: result.ethWalletAddress || result.eth_address
        }));
        
        console.log('Stored user with wallet addresses:', user);
        
        // Store wallet data securely in IndexedDB
        await this.storeWalletInIndexedDB(result, email, user.id);
        
        // 🚀 NEW: Complete wallet-first authentication
        await this.walletAuthService.completeWalletAuth(
          email,
          result.walletAddress || result.sei_address,
          result.ethWalletAddress || result.eth_address
        );
        
        // Force refresh the AuthService to load the wallet addresses
        this.authService.loadUserFromStorage();
        
        console.log('Authentication completed with registration tokens', result);
        return;
      }
      
      console.log('❌ No token in result, attempting backend authentication');
      console.log('  - result.token exists:', !!result.token);
      console.log('  - result.userId exists:', !!result.userId);
      
      // Fallback: Try to authenticate with the live backend
      const authResponse = await this.authenticateWithBackend(email, 
        result.walletAddress || result.sei_address, 
        result.ethWalletAddress || result.eth_address);
      
      if (authResponse && authResponse.token) {
        // Use real tokens from backend
        this.tokenService.setToken(authResponse.token);
        this.tokenService.setRefreshToken(authResponse.refreshToken || 'refresh-token');
        
        // Store user information
        const user = {
          id: authResponse.userId || `user_${Math.random().toString(36).substring(2, 15)}`,
          email: email,
          walletAddress: result.walletAddress || result.sei_address,
          ethWalletAddress: result.ethWalletAddress || result.eth_address,
          createdAt: new Date().toISOString() // Add creation timestamp for new user detection
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_wallet', JSON.stringify({
          sei_address: result.walletAddress || result.sei_address,
          eth_address: result.ethWalletAddress || result.eth_address
        }));
        
        console.log('Stored user with wallet addresses (backend auth):', user);
        
        // Store wallet data securely in IndexedDB
        await this.storeWalletInIndexedDB(result, email, user.id);
        
        // Force refresh the AuthService to load the wallet addresses
        this.authService.loadUserFromStorage();
        
        console.log('Authentication completed with live backend', result);
      } else {
        throw new Error('No token received from backend');
      }
    } catch (error) {
      console.warn('Live backend authentication failed, falling back to mock auth:', error);
      
      // Fallback to mock authentication
      this.completeMockAuthentication(result, email);
    }
  }

  /**
   * Store wallet data securely in IndexedDB - CRITICAL FOR TRANSACTION SIGNING
   * This method ensures the encrypted mnemonic is properly stored for wallet functionality
   */
  private async storeWalletInIndexedDB(result: StandardWalletCreationResult, email: string, userId: string): Promise<void> {
    try {
      console.log('🔍 [DEBUG] Storing wallet data in IndexedDB for user:', userId);
      console.log('🔍 [DEBUG] Result data:', {
        walletAddress: result.walletAddress,
        sei_address: result.sei_address,
        ethWalletAddress: result.ethWalletAddress,
        eth_address: result.eth_address,
        hasEncryptedMnemonic: !!result.encryptedMnemonic,
        encryptedMnemonic: result.encryptedMnemonic
      });
      
      // CRITICAL: Validate that we have encrypted mnemonic data
      if (!result.encryptedMnemonic || !result.encryptedMnemonic.encryptedData) {
        console.error('❌ CRITICAL ERROR: No encrypted mnemonic data available - wallet will not be functional!');
        console.error('❌ Registration result:', result);
        throw new Error('Missing encrypted mnemonic - wallet cannot sign transactions without this data!');
      }
      
      console.log('✅ Encrypted mnemonic data validated - proceeding with secure storage');
      
      // Store wallet data in the SECURE IndexedDB format that the wallet management component expects
      await this.storeSecureWalletData(result, email);
      
      // Store public addresses in localStorage for quick access (non-sensitive data)
      localStorage.setItem('wallet_addresses', JSON.stringify({
        sei_address: result.walletAddress || result.sei_address,
        eth_address: result.ethWalletAddress || result.eth_address,
        stored_at: new Date().toISOString(),
        user_email: email
      }));
      
      console.log('✅ Wallet data stored securely - mnemonic in IndexedDB, addresses in localStorage');
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR storing wallet data in IndexedDB:', error);
      console.error('❌ This will prevent the wallet from being functional for transaction signing!');
      // Re-throw error because wallet storage is critical for functionality
      throw new Error(`Failed to store wallet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store wallet data in secure IndexedDB format with proper encryption
   * This is the primary method for storing wallet data that can be retrieved for transaction signing
   */
  private async storeSecureWalletData(result: StandardWalletCreationResult, email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('YAP-SecureWallets', 1);
      
      request.onerror = () => {
        console.error('❌ Failed to open YAP-SecureWallets database:', request.error);
        reject(new Error('Failed to open secure wallet database'));
      };
      
      request.onsuccess = () => {
        const db = request.result;
        console.log('✅ YAP-SecureWallets database opened successfully');
        
        // Create the wallet record with all necessary data for transaction signing
        const walletRecord = {
          email: email,
          seiAddress: result.walletAddress || result.sei_address,
          evmAddress: result.ethWalletAddress || result.eth_address,
          // Store encrypted mnemonic data for transaction signing
          encryptedMnemonic: result.encryptedMnemonic?.encryptedData || '',
          mnemonicSalt: result.encryptedMnemonic?.salt || '',
          mnemonicNonce: result.encryptedMnemonic?.nonce || '',
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          version: '2.0' // Track the storage format version
        };
        
        console.log('💾 Storing wallet record:', {
          email: walletRecord.email,
          seiAddress: walletRecord.seiAddress,
          evmAddress: walletRecord.evmAddress,
          hasEncryptedMnemonic: !!walletRecord.encryptedMnemonic,
          mnemonicLength: walletRecord.encryptedMnemonic.length,
          version: walletRecord.version
        });
        
        const transaction = db.transaction(['wallets'], 'readwrite');
        const store = transaction.objectStore('wallets');
        const putRequest = store.put(walletRecord);
        
        putRequest.onsuccess = () => {
          console.log('✅ Secure wallet data stored successfully in IndexedDB');
          resolve();
        };
        
        putRequest.onerror = () => {
          console.error('❌ Failed to store secure wallet data:', putRequest.error);
          reject(new Error('Failed to store wallet data in IndexedDB'));
        };
      };
      
      request.onupgradeneeded = (event) => {
        console.log('🔄 Upgrading YAP-SecureWallets database schema');
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create wallets store if it doesn't exist
        if (!db.objectStoreNames.contains('wallets')) {
          const store = db.createObjectStore('wallets', { keyPath: 'email' });
          store.createIndex('seiAddress', 'seiAddress', { unique: false });
          store.createIndex('evmAddress', 'evmAddress', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('✅ Created wallets store with proper indexes');
        }
        
        // Create legacy stores for backward compatibility if needed
        if (!db.objectStoreNames.contains('walletMetadata')) {
          db.createObjectStore('walletMetadata');
        }
        if (!db.objectStoreNames.contains('encryptedWallets')) {
          db.createObjectStore('encryptedWallets');
        }
      };
    });
  }

  /**
   * Fallback mock authentication for development
   */
  private completeMockAuthentication(result: StandardWalletCreationResult, email: string): void {
    // Store auth data in localStorage/session
    localStorage.setItem('user_authenticated', 'true');
    localStorage.setItem('user_wallet', JSON.stringify({
      sei_address: result.walletAddress || result.sei_address,
      eth_address: result.ethWalletAddress || result.eth_address
    }));
    
    // Create a mock JWT token for authentication
    const mockToken = this.generateMockToken(email, 
      result.walletAddress || result.sei_address, 
      result.ethWalletAddress || result.eth_address);
    
    // Set the token in the token service
    this.tokenService.setToken(mockToken);
    this.tokenService.setRefreshToken('mock-refresh-token');
    
    // Store user information in the auth service with wallet addresses
    const mockUserId = `user_${Math.random().toString(36).substring(2, 15)}`;
    const user = {
      id: mockUserId,
      email: email,
      walletAddress: result.walletAddress || result.sei_address,
      ethWalletAddress: result.ethWalletAddress || result.eth_address,
      createdAt: new Date().toISOString() // Add creation timestamp for new user detection
    };
    
    // Store user in localStorage and update the AuthService
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    console.log('Mock authentication completed with wallet addresses:', user);
    
    // Store wallet data securely in IndexedDB (mock version)
    this.storeWalletInIndexedDB(result, email, mockUserId).catch(error => {
      console.warn('Failed to store wallet data in IndexedDB during mock auth:', error);
    });
    
    // Force refresh the AuthService by calling loadUserFromStorage
    this.authService.loadUserFromStorage();
  }

  /**
   * Authenticate with the live backend
   */
  private async authenticateWithBackend(email: string, seiAddress: string, ethAddress: string): Promise<any> {
    const authPayload = {
      userId: email, // Using email as userId for wallet auth
      walletAddress: seiAddress,
      ethWalletAddress: ethAddress,
      signupMethod: 'wallet'
    };

    const response = await fetch(`${environment.apiUrl}/auth/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authPayload)
    });

    if (!response.ok) {
      throw new Error(`Backend auth failed: ${response.status}`);
    }

    return await response.json();
  }
  
  /**
   * Generate a mock token for testing
   */
  private generateMockToken(email: string, seiAddress: string, ethAddress: string): string {
    // Create a simple mock JWT-like token structure
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      email: email,
      sei_address: seiAddress,
      eth_address: ethAddress,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours from now
      iat: Math.floor(Date.now() / 1000)
    }));
    const signature = btoa('mocksignature');
    
    return `${header}.${payload}.${signature}`;
  }
}
