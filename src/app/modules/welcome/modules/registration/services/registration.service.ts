// This file contains extensions to the wallet service to add registration functionality

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { WalletCreationResult } from '../../../../../services/wallet.service';
import { CryptoBrowserService } from '../../../../../shared/services/crypto-browser.service';
import { AuthService } from '../../../../../core/auth/auth.service';

/**
 * Extended wallet creation result with points field and auth tokens
 * Note: Standard accounts have zero starting points
 * Only waitlisted accounts receive bonus points
 */
export interface StandardWalletCreationResult extends WalletCreationResult {
  starting_points: number;
  token?: string;
  refreshToken?: string;
  userId?: string;
  isWaitlistConversion?: boolean;
  name?: string;
  language_to_learn?: string;
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

  constructor(private http: HttpClient) {}

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
   * Hash passphrase using PBKDF2 + SHA256 (matching backend expectations)
   * This should be done on the frontend for security - backend never sees raw passphrase
   */
  private async hashPassphrase(passphrase: string): Promise<string> {
    // Use Web Crypto API for proper PBKDF2 implementation
    const encoder = new TextEncoder();
    const passphraseData = encoder.encode(passphrase);
    const saltData = encoder.encode('x0xmbtbles0x' + passphrase); // Same salt pattern as backend expects
    
    try {
      // Import passphrase as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passphraseData,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      // Derive key using PBKDF2
      const derivedKeyBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltData,
          iterations: 390000, // Same iterations as backend
          hash: 'SHA-256'
        },
        keyMaterial,
        256 // 32 bytes * 8 bits
      );

      // Convert to base64
      const derivedKeyArray = new Uint8Array(derivedKeyBuffer);
      const keyBase64 = btoa(String.fromCharCode(...derivedKeyArray));

      // Hash the derived key with SHA256
      const keyData = encoder.encode(keyBase64);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      const hashArray = new Uint8Array(hashBuffer);
      
      // Convert to hex
      return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
    } catch (error) {
      console.error('Error hashing passphrase:', error);
      // Fallback to simple hash for development (not secure for production)
      console.warn('Using fallback hash method - not secure for production!');
      const simpleHash = await crypto.subtle.digest('SHA-256', passphraseData);
      const hashArray = new Uint8Array(simpleHash);
      return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
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
}
