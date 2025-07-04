import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SecureWalletRecoveryService, DecryptedWalletData } from './secure-wallet-recovery.service';

interface WaitlistSignupRequest {
  email: string;
  passphrase: string;
  encrypted_mnemonic: string;
  salt: string;
  nonce: string;
  sei_address: string;
  sei_public_key: string;
  eth_address: string;
  eth_public_key: string;
}

interface UserProfile {
  email: string;
  encrypted_mnemonic?: string;
  salt?: string;
  nonce?: string;
  sei_wallet?: {
    address: string;
    public_key: string;
  };
  eth_wallet?: {
    address: string;
    public_key: string;
  };
  wlw?: boolean;
  waitlist_bonus?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private baseUrl = environment.apiUrl || 'http://localhost:8000';

  constructor(
    private http: HttpClient,
    private secureWalletRecoveryService: SecureWalletRecoveryService
  ) {}

  /**
   * Check if user exists by email
   */
  async checkUserExists(email: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.http.get<UserProfile>(`${this.baseUrl}/profile/email/${email}`));
      return !!response;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get encrypted wallet data for a user
   */
  async getEncryptedWalletData(email: string): Promise<{
    encrypted_mnemonic: string;
    salt: string;
    nonce: string;
  } | null> {
    try {
      const response = await firstValueFrom(this.http.get<UserProfile>(`${this.baseUrl}/profile/email/${email}`));
      
      if (response && response.encrypted_mnemonic && response.salt && response.nonce) {
        return {
          encrypted_mnemonic: response.encrypted_mnemonic,
          salt: response.salt,
          nonce: response.nonce
        };
      }
      
      return null;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Store wallet data for waitlist signup
   */
  async storeWalletData(request: WaitlistSignupRequest): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.post(`${this.baseUrl}/wallet/waitlist-signup`, request));
      return response;
    } catch (error) {
      console.error('Failed to store wallet data:', error);
      throw error;
    }
  }

  /**
   * Recover wallet with email and passphrase using two-layer security
   */
  async recoverWallet(email: string, passphrase: string): Promise<{
    success: boolean;
    encrypted_wallet_data?: {
      encrypted_mnemonic: string;
      salt: string;
      nonce: string;
      sei_address?: string;
      eth_address?: string;
    };
    user_id?: string;
    waitlist_bonus?: number;
  }> {
    try {
      const response = await firstValueFrom(this.http.post<{
        success: boolean;
        encrypted_wallet_data: {
          encrypted_mnemonic: string;
          salt: string;
          nonce: string;
          sei_address?: string;
          eth_address?: string;
        };
        user_id: string;
        waitlist_bonus: number;
      }>(`${this.baseUrl}/wallet/recover`, {
        email,
        passphrase
      }));
      
      return response!;
    } catch (error: any) {
      // Handle specific error responses from the two-layer security model
      if (error.error?.error === 'setup_required' || error.error?.setup_required) {
        throw { error: 'setup_required', setup_required: true, message: error.error.message };
      }
      if (error.error?.error === 'invalid_passphrase') {
        throw { error: 'invalid_passphrase', message: error.error.message };
      }
      if (error.status === 401) {
        throw new Error('Invalid passphrase');
      } else if (error.status === 404) {
        throw new Error('Wallet not found');
      }
      throw error;
    }
  }

  /**
   * Setup secure account for first-time users (two-layer security)
   */
  async setupSecureAccount(email: string, passphrase: string, encrypted_wallet_data: {
    encrypted_mnemonic: string;
    salt: string;
    nonce: string;
  }): Promise<{
    success: boolean;
    message: string;
    user_id: string;
  }> {
    try {
      const response = await firstValueFrom(this.http.post<{
        success: boolean;
        message: string;
        user_id: string;
      }>(`${this.baseUrl}/wallet/secure-account`, {
        email,
        passphrase,
        encrypted_wallet_data
      }));
      
      return response!;
    } catch (error: any) {
      if (error.error?.error === 'already_secured') {
        throw { error: 'already_secured', message: error.error.message };
      }
      throw error;
    }
  }

  /**
   * Register wallet for existing user
   */
  async registerWallet(email: string, passphrase: string, encrypted_mnemonic: string, salt: string, nonce: string): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.post(`${this.baseUrl}/wallet/register`, {
        email,
        passphrase,
        encrypted_mnemonic,
        salt,
        nonce
      }));
      
      return response;
    } catch (error) {
      console.error('Failed to register wallet:', error);
      throw error;
    }
  }

  /**
   * Get user profile by email
   */
  async getUserProfile(email: string): Promise<UserProfile | null> {
    try {
      const response = await firstValueFrom(this.http.get<UserProfile>(`${this.baseUrl}/profile/email/${email}`));
      return response!;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string }> {
    try {
      const response = await firstValueFrom(this.http.get<{ status: string }>(`${this.baseUrl}/health`));
      return response!;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Secure wallet recovery using new architecture (zero server-side passphrase exposure)
   */
  async recoverWalletSecurely(email: string, passphrase: string): Promise<{
    success: boolean;
    mnemonic: string;
    seiAddress: string;
    ethAddress: string;
    userId: string;
  }> {
    try {
      console.log('🔐 Starting secure wallet recovery...');
      
      // Use the new secure recovery service
      const recoveredData = await this.secureWalletRecoveryService.recoverWalletSecurely(email, passphrase);
      
      return {
        success: true,
        mnemonic: recoveredData.mnemonic,
        seiAddress: recoveredData.seiAddress,
        ethAddress: recoveredData.ethAddress,
        userId: recoveredData.userId
      };
    } catch (error: any) {
      console.error('❌ Secure wallet recovery failed:', error);
      
      // Map specific errors for frontend handling
      if (error.message?.includes('Invalid passphrase')) {
        throw { error: 'invalid_passphrase', message: 'Invalid passphrase provided' };
      }
      if (error.message?.includes('No secure wallet found')) {
        throw { error: 'no_secure_wallet', message: 'No secure wallet found for this account' };
      }
      if (error.message?.includes('No account found')) {
        throw { error: 'user_not_found', message: 'No account found with this email' };
      }
      
      throw error;
    }
  }
}
