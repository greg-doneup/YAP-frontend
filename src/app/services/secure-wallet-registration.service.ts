import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SecurePassphraseService } from './secure-passphrase.service';
import { WalletCryptoService } from './wallet-crypto.service';

export interface SecureRegistrationRequest {
  email: string;
  username: string;
  name: string;
  language_to_learn: string;
  native_language?: string; // Add native language field
  encryptedStretchedKey: string;
  encryptionSalt: string;
  stretchedKeyNonce: string;
  encrypted_mnemonic: string; // Snake case to match YAP-landing
  mnemonic_salt: string; // Snake case to match YAP-landing
  mnemonic_nonce: string; // Snake case to match YAP-landing
  sei_address: string; // Snake case to match YAP-landing
  sei_public_key: string;
  eth_address: string; // Snake case to match YAP-landing
  eth_public_key: string;
  clientMetadata?: {
    userAgent: string;
    timestamp: string;
    securityVersion: string;
  };
}

export interface SecureRegistrationResponse {
  success: boolean;
  userId: string;
  message: string;
  token?: string;
  refreshToken?: string;
  starting_points?: number;
  isWaitlistConversion?: boolean;
  walletAddress?: string;
  ethWalletAddress?: string;
  // Encrypted wallet data for IndexedDB storage
  encryptedMnemonic?: {
    encryptedData: string;
    salt: string;
    nonce: string;
  };
}

export interface WaitlistUserData {
  email: string;
  name: string;
  language_to_learn: string;
  isWaitlistUser: boolean;
  waitlist_signup_at?: string;
  converted?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SecureWalletRegistrationService {
  private apiUrl = environment.apiUrl; // Fixed: Use environment configuration instead of hardcoded URL

  constructor(
    private http: HttpClient,
    private securePassphraseService: SecurePassphraseService,
    private walletCryptoService: WalletCryptoService
  ) {}

  /**
   * Check if email exists in waitlist and return user data
   */
  async checkWaitlistStatus(email: string): Promise<WaitlistUserData | null> {
    try {
      const response = await firstValueFrom(this.http.get<any>(`${this.apiUrl}/profile/email/${email}`));
      
      // If response has name and initial_language_to_learn, treat as waitlist user
      if (response && response.name && response.initial_language_to_learn) {
        console.log('✅ Found existing user data:', {
          email: response.email,
          name: response.name,
          initial_language_to_learn: response.initial_language_to_learn,
          isWaitlistUser: response.isWaitlistUser,
          converted: response.converted
        });
        
        return {
          email: response.email,
          name: response.name,
          language_to_learn: response.initial_language_to_learn,
          isWaitlistUser: response.isWaitlistUser || true,
          waitlist_signup_at: response.waitlist_signup_at || new Date().toISOString(),
          converted: response.converted || false
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
   * Unified secure wallet creation flow
   * Uses the exact same secure encryption as YAP-landing
   * 1. Check profile to prevent duplicate emails and detect waitlist users
   * 2. For all cases (new users + waitlist), go to /auth/secure-signup
   */
  async createSecureWallet(
    email: string,
    passphrase: string,
    name?: string,
    languageToLearn?: string,
    nativeLanguage?: string
  ): Promise<SecureRegistrationResponse> {
    try {
      console.log('🔍 [DEBUG] Starting secure wallet creation for:', email);

      // Step 1: Check if email already exists (for validation and waitlist detection)
      let finalName = name;
      let finalLanguage = languageToLearn;
      let isWaitlistConversion = false;

      try {
        const waitlistData = await this.checkWaitlistStatus(email);
        if (waitlistData) {
          if (waitlistData.converted) {
            throw new Error('Email already registered with an existing wallet');
          }
          // This is a waitlist user who hasn't been converted yet
          finalName = waitlistData.name;
          finalLanguage = waitlistData.language_to_learn;
          isWaitlistConversion = true;
          console.log('✅ Waitlist user detected, using existing data:', {
            name: finalName,
            language_to_learn: finalLanguage
          });
        }
      } catch (error: any) {
        if (error.status === 404) {
          // Email not found - this is a new user, proceed with provided data
          console.log('✅ New user detected, proceeding with registration');
        } else if (error.message?.includes('already registered')) {
          // Re-throw registration conflict errors
          throw error;
        } else {
          // For other errors (like 500), log but don't block registration
          console.warn('Profile check failed, proceeding with registration:', error.message);
        }
      }

      // Ensure we have all required data for registration
      if (!finalName || !finalLanguage) {
        throw new Error('Name and language to learn are required for registration');
      }

      // Step 1: Generate mnemonic and derive wallets
      const mnemonic = this.walletCryptoService.generateMnemonic();
      const walletData = await this.walletCryptoService.deriveWalletsFromMnemonic(mnemonic);

      // Step 2: Stretch passphrase using secure architecture
      const stretchedKey = await this.securePassphraseService.stretchPassphrase(passphrase, email);

      // Step 3: Encrypt stretched key for server storage
      const encryptedStretchedKeyData = await this.securePassphraseService.encryptStretchedPassphrase(
        stretchedKey, 
        email
      );

      // Step 4: Encrypt mnemonic with stretched key
      const encryptedMnemonic = await this.walletCryptoService.encryptMnemonic(mnemonic, stretchedKey);

      // Step 5: Prepare registration request using EXACT same structure as YAP-landing
      const registrationData: SecureRegistrationRequest = {
        email: email,
        username: finalName, // YAP-landing uses username
        name: finalName, // Also include name field 
        language_to_learn: finalLanguage, // Include language field
        native_language: nativeLanguage || 'english', // Add native language field
        encryptedStretchedKey: encryptedStretchedKeyData.encryptedStretchedKey.join(','),
        encryptionSalt: encryptedStretchedKeyData.encryptionSalt.join(','),
        stretchedKeyNonce: encryptedStretchedKeyData.nonce.join(','),
        encrypted_mnemonic: encryptedMnemonic.encryptedData, // Snake case
        mnemonic_salt: encryptedMnemonic.salt, // Snake case
        mnemonic_nonce: encryptedMnemonic.nonce, // Snake case
        sei_address: walletData.seiWallet.address, // Snake case
        sei_public_key: walletData.seiWallet.publicKey,
        eth_address: walletData.evmWallet.address, // Snake case
        eth_public_key: walletData.evmWallet.publicKey,
        clientMetadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          securityVersion: '2.0'
        }
      };

      console.log('🔍 [DEBUG] Making secure registration request to:', `${this.apiUrl}/auth/secure-signup`);
      console.log('🔍 [DEBUG] Request body (without sensitive data):', {
        email: registrationData.email,
        username: registrationData.username,
        name: registrationData.name,
        language_to_learn: registrationData.language_to_learn,
        sei_address: registrationData.sei_address,
        eth_address: registrationData.eth_address,
        isWaitlistConversion: isWaitlistConversion
      });

      // Step 6: Call secure signup endpoint (EXACT same as YAP-landing)
      // Always use /auth/secure-signup for all registration (backend handles waitlist detection)
      const endpoint = '/auth/secure-signup';

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}${endpoint}`, registrationData)
      );

      console.log('🔍 [DEBUG] Registration response:', response);

      return {
        success: true,
        userId: response.userId || response.id,
        message: response.message || 'Account created successfully',
        token: response.token,
        refreshToken: response.refreshToken,
        starting_points: response.starting_points || 0,
        isWaitlistConversion: response.isWaitlistConversion || false,
        walletAddress: response.walletAddress || walletData.seiWallet.address,
        ethWalletAddress: response.ethWalletAddress || walletData.evmWallet.address,
        encryptedMnemonic: encryptedMnemonic // Include encrypted mnemonic for IndexedDB storage
      };

    } catch (error: any) {
      console.error('🚨 [ERROR] Secure wallet creation failed:', error);
      throw new Error(`Failed to create wallet: ${error.message || error}`);
    }
  }

  /**
   * Recover wallet using secure passphrase architecture
   */
  async recoverSecureWallet(
    email: string,
    passphrase: string
  ): Promise<{
    mnemonic: string;
    walletData: any;
  }> {
    try {
      // Get user's encrypted data from profile
      const userProfile = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/profile/email/${email}`)
      );

      if (!userProfile || !userProfile.encryptedStretchedKey) {
        throw new Error('User not found or no encrypted data available');
      }

      // Recreate stretched key from passphrase
      const stretchedKey = await this.securePassphraseService.stretchPassphrase(passphrase, email);

      // Decrypt the stored stretched key to verify passphrase
      const encryptedStretchedKeyData = {
        encryptedStretchedKey: userProfile.encryptedStretchedKey.split(',').map(Number),
        encryptionSalt: userProfile.encryptionSalt.split(',').map(Number),
        nonce: userProfile.stretchedKeyNonce.split(',').map(Number)
      };

      const decryptedStretchedKey = await this.securePassphraseService.decryptStretchedPassphrase(
        encryptedStretchedKeyData,
        email
      );

      // Verify passphrase matches
      const isValid = await this.securePassphraseService.verifyPassphrase(
        passphrase,
        email,
        encryptedStretchedKeyData
      );

      if (!isValid) {
        throw new Error('Invalid passphrase');
      }

      // Decrypt mnemonic
      const encryptedMnemonic = {
        encryptedData: userProfile.encryptedMnemonic,
        salt: userProfile.mnemonicSalt,
        nonce: userProfile.mnemonicNonce
      };

      const mnemonic = await this.walletCryptoService.decryptMnemonic(
        encryptedMnemonic,
        stretchedKey
      );

      // Derive wallets from recovered mnemonic
      const walletData = await this.walletCryptoService.deriveWalletsFromMnemonic(mnemonic);

      return {
        mnemonic,
        walletData
      };

    } catch (error: any) {
      console.error('Wallet recovery failed:', error);
      throw new Error(`Recovery failed: ${error.message || error}`);
    }
  }
}
