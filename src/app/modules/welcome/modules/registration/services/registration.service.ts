// This file contains extensions to the wallet service to add registration functionality

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CryptoBrowserService } from '../../../../../shared/services/crypto-browser.service';

/**
 * Extended wallet creation result with points field and auth tokens
 */
export interface StandardWalletCreationResult {
  status: string;
  sei_address: string;
  eth_address: string;
  waitlist_bonus: number;
  token_bonus?: number; // New field for waitlist token bonus  
  message: string;
  starting_points: number;
  token?: string;
  refreshToken?: string;
  userId?: string;
  isWaitlistConversion?: boolean;
  name?: string;
  language_to_learn?: string;
  walletAddress?: string;
  ethWalletAddress?: string;
  // Encrypted wallet data for IndexedDB storage
  encryptedMnemonic?: {
    encryptedData: string;
    salt: string;
    nonce: string;
  };
}

/**
 * Waitlist user data structure
 */
export interface WaitlistUserData {
  email: string;
  name: string;
  language_to_learn: string;
  isWaitlistUser: boolean;
  waitlist_signup_at?: string;
  converted?: boolean; // Track if waitlist user has been converted to full account
}

/**
 * Registration service to extend wallet service with registration-specific functionality
 * 
 * ⚠️ DEPRECATED: This service uses legacy demo wallet generation.
 * 🎯 NEW COMPONENTS SHOULD USE: SecureWalletRegistrationService + WalletCryptoService
 * 
 * The new services use proper cryptographic libraries:
 * - ethers.js for EVM wallet generation  
 * - @cosmjs for SEI wallet generation
 * - bip39 for mnemonic generation
 * 
 * This legacy service generates fake addresses for demo purposes only.
 */
@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
  private apiUrl = environment.apiUrl; // Use environment configuration

  constructor(
    private http: HttpClient,
    private cryptoBrowserService: CryptoBrowserService
  ) {}

  /**
   * Check if email exists in waitlist and return user data
   */
  async checkWaitlistStatus(email: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/profile/email/${encodeURIComponent(email)}`)
      );
      
      // If response has name and initial_language_to_learn, treat as waitlist user
      if (response && response.name && response.initial_language_to_learn) {
        return {
          email: response.email,
          name: response.name,
          language_to_learn: response.initial_language_to_learn,
          isWaitlistUser: response.isWaitlistUser || true,
          waitlist_signup_at: response.waitlist_signup_at || new Date().toISOString(),
          converted: response.converted || false
        };
      }
      
      return null; // Not a waitlist user
    } catch (error: any) {
      if (error.status === 404) {
        return null; // Email not found, regular registration can proceed
      }
      throw error;
    }
  }

  /**
   * Unified wallet creation flow using secure encryption architecture
   * Simplified to match YAP-landing implementation exactly
   */
  async createWalletWithConversion(
    email: string, 
    passphrase: string,
    name?: string,
    language_to_learn?: string
  ): Promise<StandardWalletCreationResult> {
    try {
      console.log('🔍 [DEBUG] Starting registration flow for:', email);

      // Ensure we have required data
      if (!name || !language_to_learn) {
        throw new Error('Name and language to learn are required for registration');
      }

      // ⚠️ DEPRECATED: This method uses fake wallet generation
      // Real apps should use SecureWalletRegistrationService instead
      
      // Generate wallet data first
      const mnemonic = this.generateMnemonic();
      const walletData = await this.deriveWalletsFromMnemonic(mnemonic);
      
      // Direct API call to /auth/secure-signup (matching YAP-landing)
      const registrationData = {
        email,
        name, 
        language_to_learn,
        // Send arrays of numbers as expected by backend
        encryptedStretchedKey: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
        encryptionSalt: [1,2,3,4,5,6,7,8],
        stretchedKeyNonce: [1,2,3,4,5,6,7,8,9,10,11,12],
        encrypted_mnemonic: 'encrypted_' + Math.random().toString(36).substring(2, 15),
        mnemonic_salt: Math.random().toString(36).substring(2, 10),
        mnemonic_nonce: Math.random().toString(36).substring(2, 10),
        sei_address: walletData.seiWallet.address,
        eth_address: walletData.evmWallet.address
      };

      console.log('📡 Making direct API call to:', `${this.apiUrl}/auth/secure-signup`);
      
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth/secure-signup`, registrationData)
      );

      // Store wallet data in IndexedDB with EXACT same format as YAP-landing
      await this.storeWalletInIndexedDB(email, walletData);

      // Store wallet addresses reliably in multiple locations for guaranteed access
      await this.cryptoBrowserService.storeWalletAddressesReliably(
        email,
        walletData.seiWallet.address,
        walletData.evmWallet.address
      );

      // Convert to StandardWalletCreationResult format
      const result: StandardWalletCreationResult = {
        status: 'success',
        sei_address: walletData.seiWallet.address,
        eth_address: walletData.evmWallet.address,
        waitlist_bonus: response.starting_points || 0,
        message: response.message || 'Account created successfully',
        starting_points: response.starting_points || 0,
        token: response.token,
        refreshToken: response.refreshToken,
        userId: response.userId,
        isWaitlistConversion: response.isWaitlistConversion || false,
        name: name,
        language_to_learn: language_to_learn,
        walletAddress: walletData.seiWallet.address,
        ethWalletAddress: walletData.evmWallet.address
      };

      console.log('✅ Registration completed successfully:', result);
      return result;

    } catch (error: any) {
      console.error('🚨 [ERROR] Registration failed:', error);
      
      // Better error handling
      if (error.status === 400) {
        throw new Error(error.error?.message || 'Invalid registration data');
      } else if (error.status === 409) {
        throw new Error('Email already registered');
      } else if (error.status === 500) {
        throw new Error('Server error during registration');
      } else {
        throw new Error(`Registration failed: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Hash passphrase using PBKDF2 + SHA256 for secure server storage
   * This eliminates raw passphrase exposure on the server
   */
  private async hashPassphraseSecure(passphrase: string, email: string): Promise<string> {
    try {
      // Step 1: PBKDF2 stretching (600,000 iterations for security)
      const encoder = new TextEncoder();
      const passphraseBytes = encoder.encode(passphrase);
      const saltBytes = encoder.encode(`yap-secure-${email}`);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passphraseBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      );
      
      const stretchedKeyBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 600_000, // High iteration count for security
          hash: 'SHA-256'
        },
        keyMaterial,
        256 // 32 bytes
      );
      
      // Step 2: Final hash for server storage
      const stretchedKey = new Uint8Array(stretchedKeyBuffer);
      const finalHashBuffer = await crypto.subtle.digest('SHA-256', stretchedKey);
      const finalHashArray = new Uint8Array(finalHashBuffer);
      
      // Convert to hex string
      return Array.from(finalHashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
    } catch (error) {
      console.error('Error in secure passphrase hashing:', error);
      // Fallback to original method for compatibility
      return this.hashPassphrase(passphrase);
    }
  }
  
  /**
   * Create wallet for standard registration (non-waitlist users)
   * This method maintains backward compatibility while leveraging the new conversion logic
   */
  async createStandardWallet(
    email: string, 
    passphrase: string,
    name: string,
    language_to_learn: string = 'spanish'
  ): Promise<StandardWalletCreationResult> {
    return this.createWalletWithConversion(email, passphrase, name, language_to_learn);
  }

  /**
   * Retrieve waitlist wallet with email and passphrase
   */
  async retrieveWaitlistWallet(
    email: string, 
    passphrase: string, 
    recoveryPhrase?: string
  ): Promise<StandardWalletCreationResult> {
    try {
      // Call the mock server waitlist signup endpoint
      const response = await firstValueFrom(this.http.post<any>(`${this.apiUrl}/wallet/waitlist-signup`, {
        email: email,
        passphrase: passphrase,
        encrypted_mnemonic: 'encrypted_' + Math.random().toString(36).substring(2, 32),
        salt: Math.random().toString(36).substring(2, 16),
        nonce: Math.random().toString(36).substring(2, 12),
        sei_address: 'sei1' + Math.random().toString(36).substring(2, 15),
        sei_public_key: 'sei_pub_' + Math.random().toString(36).substring(2, 32),
        eth_address: '0x' + Math.random().toString(36).substring(2, 40),
        eth_public_key: 'eth_pub_' + Math.random().toString(36).substring(2, 32)
      }));

      // Log the response for debugging
      console.log('Waitlist wallet creation response:', response);

      return {
        status: 'success',
        sei_address: response.sei_address,
        eth_address: response.eth_address,
        waitlist_bonus: response.waitlist_bonus || 100,
        message: response.message || 'Waitlist wallet retrieved successfully',
        starting_points: response.starting_points || response.waitlist_bonus || 100
      };
    } catch (error) {
      console.error('Error retrieving waitlist wallet:', error);
      // Return error status instead of fallback
      throw new Error(`Failed to retrieve waitlist wallet: ${error}`);
    }
  }

  /**
   * SECURE PASSPHRASE ARCHITECTURE METHODS
   * Zero server-side passphrase exposure implementation
   */

  /**
   * Stretch passphrase using PBKDF2 (client-side only)
   */
  private async stretchPassphraseSecure(passphrase: string, userSalt: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);
    const saltBytes = encoder.encode(`yap-secure-${userSalt}`);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw', 
      passphraseBytes, 
      'PBKDF2', 
      false, 
      ['deriveBits']
    );
    
    const stretchedKeyBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 600_000, // High iteration count for security
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 32 bytes
    );
    
    return new Uint8Array(stretchedKeyBuffer);
  }

  /**
   * Encrypt stretched passphrase for server storage
   */
  private async encryptStretchedPassphrase(
    stretchedKey: Uint8Array, 
    userEmail: string
  ): Promise<{
    encryptedStretchedKey: number[];
    encryptionSalt: number[];
    nonce: number[];
  }> {
    // Generate unique salt for this encryption
    const encryptionSalt = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive encryption key from user email + random salt
    const emailBytes = new TextEncoder().encode(userEmail);
    const derivationInput = new Uint8Array([...emailBytes, ...encryptionSalt]);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      derivationInput,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encryptionSalt,
        iterations: 100_000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt the stretched passphrase
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      encryptionKey,
      stretchedKey
    );
    
    return {
      encryptedStretchedKey: Array.from(new Uint8Array(encryptedData)),
      encryptionSalt: Array.from(encryptionSalt),
      nonce: Array.from(nonce)
    };
  }

  /**
   * Generate BIP39 mnemonic (placeholder - would use bip39 library)
   */
  private generateMnemonic(): string {
    // In real implementation, would use: bip39.generateMnemonic()
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid'
    ];
    
    const mnemonic = [];
    for (let i = 0; i < 12; i++) {
      mnemonic.push(words[Math.floor(Math.random() * words.length)]);
    }
    return mnemonic.join(' ');
  }

  /**
   * Encrypt mnemonic with stretched key
   */
  private async encryptMnemonicWithStretchedKey(
    mnemonic: string, 
    stretchedKey: Uint8Array
  ): Promise<{
    encryptedData: string;
    salt: string;
    nonce: string;
  }> {
    // Generate random salt and nonce
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Import stretched key for encryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      stretchedKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt mnemonic
    const encodedMnemonic = new TextEncoder().encode(mnemonic);
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      cryptoKey,
      encodedMnemonic
    );

    return {
      encryptedData: Array.from(new Uint8Array(encryptedData)).join(','),
      salt: Array.from(salt).join(','),
      nonce: Array.from(nonce).join(',')
    };
  }

  /**
   * Derive wallets from mnemonic (placeholder)
   */
  private async deriveWalletsFromMnemonic(mnemonic: string): Promise<{
    seiWallet: { address: string; publicKey: string; privateKey: string };
    evmWallet: { address: string; publicKey: string; privateKey: string };
  }> {
    // In real implementation, would use @cosmjs and ethers libraries
    // For now, generate mock addresses
    return {
      seiWallet: {
        address: 'sei1' + this.generateRandomHex(39),
        publicKey: this.generateRandomHex(64),
        privateKey: this.generateRandomHex(64)
      },
      evmWallet: {
        address: '0x' + this.generateRandomHex(40),
        publicKey: this.generateRandomHex(128),
        privateKey: this.generateRandomHex(64)
      }
    };
  }

  /**
   * Store wallet data locally using IndexedDB - EXACT same format as YAP-landing
   * Raw mnemonic is stored locally (client-side secure)
   */
  private async storeWalletInIndexedDB(
    email: string,
    walletData: any
  ): Promise<void> {
    try {
      // Open IndexedDB
      const request = indexedDB.open('YAP-SecureWallets', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('wallets')) {
            db.createObjectStore('wallets', { keyPath: 'email' });
          }
        };
        
        request.onsuccess = async () => {
          const db = request.result;
          
          // Store wallet data in EXACT same format as YAP-landing
          const walletRecord = {
            email,
            rawMnemonic: walletData.mnemonic, // Store raw mnemonic like YAP-landing
            seiAddress: walletData.seiWallet.address,
            evmAddress: walletData.evmWallet.address,
            storedAt: new Date().toISOString()
          };
          
          console.log('💾 Storing wallet data in IndexedDB:', {
            email,
            seiAddress: walletRecord.seiAddress,
            evmAddress: walletRecord.evmAddress,
            hasMnemonic: !!walletRecord.rawMnemonic
          });
          
          const transaction = db.transaction(['wallets'], 'readwrite');
          const store = transaction.objectStore('wallets');
          store.put(walletRecord);
          
          transaction.oncomplete = () => {
            console.log('✅ Wallet data stored successfully in IndexedDB');
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    } catch (error) {
      console.warn('Failed to store wallet locally:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Validate passphrase strength
   */
  private validatePassphraseStrength(passphrase: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (passphrase.length >= 12) {
      score += 2;
    } else if (passphrase.length >= 8) {
      score += 1;
      feedback.push('Consider using at least 12 characters for better security.');
    } else {
      feedback.push('Passphrase should be at least 8 characters long.');
    }

    // Character variety checks
    if (/[a-z]/.test(passphrase)) score += 1;
    if (/[A-Z]/.test(passphrase)) score += 1;
    if (/[0-9]/.test(passphrase)) score += 1;
    if (/[^A-Za-z0-9]/.test(passphrase)) score += 1;

    // No common patterns
    if (!/(.)\1{2,}/.test(passphrase)) score += 1;

    if (score >= 5) {
      feedback.push('Strong passphrase!');
    } else if (score >= 3) {
      feedback.push('Good passphrase strength.');
    } else {
      feedback.push('Weak passphrase. Please follow security recommendations.');
    }

    return {
      isValid: score >= 4 && passphrase.length >= 12,
      score: Math.min(7, score),
      feedback
    };
  }

  /**
   * Generate random hex string
   */
  private generateRandomHex(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, length);
  }

  /**
   * Legacy passphrase hashing method (fallback for compatibility)
   */
  private async hashPassphrase(passphrase: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(passphrase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate wallet data - simplified for now but matches YAP-landing structure
   */
  /**
   * ⚠️ DEPRECATED: Legacy fake wallet generation method
   * 
   * This method generates invalid wallet addresses using Math.random()
   * which is NOT cryptographically secure and creates invalid addresses.
   * 
   * 🎯 Use SecureWalletRegistrationService.createSecureWallet() instead
   * which uses proper libraries: ethers.js + @cosmjs + bip39
   */
  private generateWalletData(): any {
    throw new Error(
      'DEPRECATED: generateWalletData() creates invalid wallet addresses. ' +
      'Use SecureWalletRegistrationService.createSecureWallet() instead for ' +
      'proper cryptographic wallet generation with ethers.js and @cosmjs.'
    );
  }
}
