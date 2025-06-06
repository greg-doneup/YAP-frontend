// This file contains extensions to the wallet service to add registration functionality

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { WalletCreationResult } from '../../../../../services/wallet.service';

/**
 * Extended wallet creation result with points field
 * Note: Standard accounts have zero starting points
 * Only waitlisted accounts receive bonus points
 */
export interface StandardWalletCreationResult extends WalletCreationResult {
  starting_points: number;
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
   * Create wallet for standard registration (non-waitlist users)
   */
  async createStandardWallet(
    email: string, 
    passphrase: string,
    name: string
  ): Promise<StandardWalletCreationResult> {
    try {
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

      // Call the mock server auth service endpoint with encrypted wallet data
      const response = await this.http.post<any>(`${this.apiUrl}/auth/wallet/signup`, {
        email: email,
        name: name,
        language_to_learn: 'spanish', // Default for now, could be parameterized
        passphrase: passphrase,
        encrypted_mnemonic: mockEncryptedData.encrypted_mnemonic,
        salt: mockEncryptedData.salt,
        nonce: mockEncryptedData.nonce,
        sei_address: mockEncryptedData.sei_address,
        sei_public_key: mockEncryptedData.sei_public_key,
        eth_address: mockEncryptedData.eth_address,
        eth_public_key: mockEncryptedData.eth_public_key
      }).toPromise();

      // Log the response for debugging
      console.log('Standard wallet creation response:', response);

      return {
        status: 'success',
        sei_address: response.walletAddress || mockEncryptedData.sei_address,
        eth_address: response.ethWalletAddress || mockEncryptedData.eth_address,
        waitlist_bonus: 0,
        message: 'Account created successfully',
        starting_points: response.starting_points || 0 // Standard accounts don't get any bonus points
      };
    } catch (error) {
      console.error('Error creating standard wallet:', error);
      // Return error status instead of fallback
      throw new Error(`Failed to create standard wallet: ${error}`);
    }
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
      const response = await this.http.post<any>(`${this.apiUrl}/wallet/waitlist-signup`, {
        email: email,
        passphrase: passphrase,
        encrypted_mnemonic: 'encrypted_' + Math.random().toString(36).substring(2, 32),
        salt: Math.random().toString(36).substring(2, 16),
        nonce: Math.random().toString(36).substring(2, 12),
        sei_address: 'sei1' + Math.random().toString(36).substring(2, 15),
        sei_public_key: 'sei_pub_' + Math.random().toString(36).substring(2, 32),
        eth_address: '0x' + Math.random().toString(36).substring(2, 40),
        eth_public_key: 'eth_pub_' + Math.random().toString(36).substring(2, 32)
      }).toPromise();

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
