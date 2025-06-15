// This file contains extensions to the wallet service to add registration functionality

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { WalletCreationResult } from '../../../../../services/wallet.service';
import { CryptoBrowserService } from '../../../../../shared/services/crypto-browser.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { SecureWalletIntegrationService } from '../../../../../shared/services/secure-wallet-integration.service';

/**
 * Extended wallet creation result with points field and auth tokens
 * Note: Standard accounts have zero starting points
 * Only waitlisted accounts receive bonus points
 * 
 * Backend may return either format:
 * - sei_address/eth_address (legacy format)
 * - walletAddress/ethWalletAddress (new format)
 */
export interface StandardWalletCreationResult extends WalletCreationResult {
  starting_points: number;
  token?: string;
  refreshToken?: string;
  userId?: string;
  isWaitlistConversion?: boolean;
  name?: string;
  language_to_learn?: string;
  // Additional wallet address fields from backend
  walletAddress?: string;
  ethWalletAddress?: string;
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
 */
@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
  private apiUrl = environment.apiUrl; // Use environment configuration

  constructor(
    private http: HttpClient,
    private secureWalletIntegrationService: SecureWalletIntegrationService
  ) {}

  /**
   * Check if email exists in waitlist and return user data
   */
  async checkWaitlistStatus(email: string): Promise<WaitlistUserData | null> {
    try {
      const response = await firstValueFrom(this.http.get<any>(`${this.apiUrl}/wallet/email/${email}`));
      
      // If response has name and language_to_learn, treat as waitlist user
      // In real backend, there would be an explicit isWaitlistUser field
      // For mock server, we determine based on existing profile data
      if (response && response.name && response.language_to_learn) {
        console.log('✅ Found existing user data:', {
          email: response.email,
          name: response.name,
          language_to_learn: response.language_to_learn
        });
        
        return {
          email: response.email,
          name: response.name,
          language_to_learn: response.language_to_learn,
          isWaitlistUser: true,
          waitlist_signup_at: response.waitlist_signup_at || new Date().toISOString(),
          converted: response.converted || false // Check if already converted
        };
      }
      
      return null; // Not a waitlist user or no existing data
    } catch (error: any) {
      if (error.status === 404) {
        return null; // Email not found, regular registration can proceed
      }
      console.error('Error checking waitlist status:', error);
      throw error;
    }
  }
   /**
   * Unified wallet creation flow that handles both standard registration and waitlist conversion
   * 
   * The flow:
   * 1. Frontend queries database for email to check if waitlist user exists
   * 2. If waitlist user found (without 'converted: true'), pull name/language_to_learn
   * 3. Everything runs through standard registration endpoint
   * 4. Backend adds 'converted: true' to waitlist record
   * 
   * This approach is much simpler and more reliable than separate flows
   */
  async createWalletWithConversion(
    email: string, 
    passphrase: string,
    name?: string,
    language_to_learn?: string
  ): Promise<StandardWalletCreationResult> {
    try {
      // Step 1: Check if this is a waitlist user and get their data
      let finalName = name;
      let finalLanguage = language_to_learn;
      let isWaitlistConversion = false;

      const waitlistData = await this.checkWaitlistStatus(email);
      if (waitlistData && !waitlistData.converted) {
        // This is a waitlist user who hasn't been converted yet
        finalName = waitlistData.name;
        finalLanguage = waitlistData.language_to_learn;
        isWaitlistConversion = true;
        console.log('✅ Waitlist user detected, using existing data:', {
          name: finalName,
          language_to_learn: finalLanguage
        });
      }

      // Ensure we have all required data for registration
      if (!finalName || !finalLanguage) {
        throw new Error('Name and language to learn are required for registration');
      }

      // SECURITY: Hash the passphrase on the frontend before sending to backend
      const passphraseHash = await this.hashPassphrase(passphrase);

      // Generate mock encrypted wallet data (in real implementation this would be done client-side)
      const mockEncryptedData = {
        encrypted_mnemonic: 'enc_' + Math.random().toString(36).substring(2, 32),
        salt: Math.random().toString(36).substring(2, 16),
        nonce: Math.random().toString(36).substring(2, 12),
        sei_address: 'sei1' + Math.random().toString(36).substring(2, 15),
        sei_public_key: 'sei_pub_' + Math.random().toString(36).substring(2, 32),
        eth_address: '0x' + Math.random().toString(36).substring(2, 40),
        eth_public_key: 'eth_pub_' + Math.random().toString(36).substring(2, 32)
      };

      // Step 2: Use standard registration endpoint for ALL users
      // The backend will automatically detect waitlist conversion based on email lookup
      const requestBody = {
        email: email,
        name: finalName,
        language_to_learn: finalLanguage,
        passphrase_hash: passphraseHash, // Send hashed passphrase, not raw passphrase
        encrypted_mnemonic: mockEncryptedData.encrypted_mnemonic,
        salt: mockEncryptedData.salt,
        nonce: mockEncryptedData.nonce,
        sei_address: mockEncryptedData.sei_address,
        sei_public_key: mockEncryptedData.sei_public_key,
        eth_address: mockEncryptedData.eth_address,
        eth_public_key: mockEncryptedData.eth_public_key
      };

      console.log('🔍 [DEBUG] Making unified registration request to:', `${this.apiUrl}/auth/wallet/signup`);
      console.log('🔍 [DEBUG] Request body:', requestBody);

      const response = await firstValueFrom(this.http.post<any>(`${this.apiUrl}/auth/wallet/signup`, requestBody));

      console.log('🔍 [DEBUG] Registration response:', response);

      const result = {
        status: 'success',
        sei_address: response.walletAddress || mockEncryptedData.sei_address,
        eth_address: response.ethWalletAddress || mockEncryptedData.eth_address,
        waitlist_bonus: response.starting_points || 0,
        message: response.message || 'Account created successfully',
        starting_points: response.starting_points || 0,
        token: response.token,
        refreshToken: response.refreshToken,
        userId: response.userId,
        isWaitlistConversion: response.isWaitlistConversion || isWaitlistConversion,
        name: response.name || finalName,
        language_to_learn: response.language_to_learn || finalLanguage
      };

      console.log('🔍 [DEBUG] Final result:', result);
      return result;
    } catch (error: any) {
      console.error('🚨 [ERROR] Unified wallet creation failed:', error);
      throw new Error(`Failed to create wallet: ${error.message || error}`);
    }
  }

  /**
   * Secure wallet creation using the new architecture
   */
  async createSecureWallet(
    email: string, 
    passphrase: string,
    name: string,
    language_to_learn: string
  ): Promise<StandardWalletCreationResult> {
    try {
      // Check if this is a waitlist user
      const waitlistData = await this.checkWaitlistStatus(email);
      const isWaitlistConversion = waitlistData && !waitlistData.converted;

      let result: any;
      
      if (isWaitlistConversion) {
        // Convert waitlist user to secure wallet
        result = await this.secureWalletIntegrationService.convertWaitlistToSecure(
          email,
          passphrase,
          {
            name: waitlistData.name,
            language_to_learn: waitlistData.language_to_learn
          }
        );
      } else {
        // Register new secure wallet
        result = await this.secureWalletIntegrationService.registerSecureWallet(
          email,
          passphrase,
          name,
          language_to_learn
        );
      }

      if (!result.success) {
        throw new Error(result.message || 'Wallet creation failed');
      }

      // Convert to expected format
      return {
        status: 'success',
        sei_address: result.walletData.seiAddress,
        eth_address: result.walletData.ethAddress,
        waitlist_bonus: isWaitlistConversion ? 100 : 0,
        message: result.message,
        starting_points: isWaitlistConversion ? 100 : 0,
        userId: result.walletData.userId,
        isWaitlistConversion: !!isWaitlistConversion,
        name: isWaitlistConversion ? waitlistData.name : name,
        language_to_learn: isWaitlistConversion ? waitlistData.language_to_learn : language_to_learn,
        // Support both legacy and new address formats
        walletAddress: result.walletData.seiAddress,
        ethWalletAddress: result.walletData.ethAddress
      };

    } catch (error: any) {
      console.error('Error in createSecureWallet:', error);
      throw new Error(`Failed to create secure wallet: ${error.message}`);
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
  ): Promise<WalletCreationResult> {
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
        message: response.message || 'Waitlist wallet retrieved successfully'
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
   * Store wallet securely in IndexedDB
   */
  private async storeWalletSecurely(
    email: string,
    walletData: any,
    stretchedKey: Uint8Array
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
          
          // Encrypt mnemonic for local storage
          const encryptedMnemonic = await this.encryptMnemonicWithStretchedKey(
            walletData.mnemonic,
            stretchedKey
          );
          
          const walletRecord = {
            email,
            encryptedMnemonic,
            seiAddress: walletData.seiWallet.address,
            evmAddress: walletData.evmWallet.address,
            storedAt: new Date().toISOString()
          };
          
          const transaction = db.transaction(['wallets'], 'readwrite');
          const store = transaction.objectStore('wallets');
          store.put(walletRecord);
          
          transaction.oncomplete = () => resolve();
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
}
