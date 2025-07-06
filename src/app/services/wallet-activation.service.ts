import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WalletActivationRequest {
  userId: string;
  email: string;
  seiAddress: string;
  evmAddress: string;
  registrationType: 'new_user' | 'waitlist_conversion';
}

export interface WalletActivationResponse {
  success: boolean;
  transactionHash?: string;
  blockchainRegistered: boolean;
  message: string;
  activationTimestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletActivationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Activate user wallet on blockchain during registration
   * This ensures user wallets are propagated to the blockchain system
   */
  async activateWalletOnBlockchain(request: WalletActivationRequest): Promise<WalletActivationResponse> {
    try {
      console.log('🔗 Activating wallet on blockchain:', {
        userId: request.userId,
        seiAddress: request.seiAddress,
        evmAddress: request.evmAddress,
        type: request.registrationType
      });

      // Submit wallet activation request to blockchain progress service
      const response = await firstValueFrom(
        this.http.post<WalletActivationResponse>(`${this.apiUrl}/blockchain/activate-wallet`, {
          userId: request.userId,
          email: request.email,
          seiAddress: request.seiAddress,
          evmAddress: request.evmAddress,
          registrationType: request.registrationType,
          timestamp: new Date().toISOString(),
          metadata: {
            source: 'registration',
            userAgent: navigator.userAgent,
            activationRequested: true
          }
        })
      );

      if (response.success) {
        console.log('✅ Wallet activated on blockchain:', {
          transactionHash: response.transactionHash,
          registered: response.blockchainRegistered,
          timestamp: response.activationTimestamp
        });

        // Store activation status locally for reference
        this.storeActivationStatus(request.userId, response);
      } else {
        console.error('❌ Wallet activation failed:', response.message);
      }

      return response;

    } catch (error) {
      console.error('🚨 Error activating wallet on blockchain:', error);
      
      // Return fallback response indicating activation will be attempted later
      return {
        success: false,
        blockchainRegistered: false,
        message: 'Wallet activation will be retried automatically. Your wallet is created and functional.',
        activationTimestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if a wallet is already activated on blockchain
   */
  async checkWalletActivationStatus(userId: string, evmAddress: string): Promise<{
    isActivated: boolean;
    registrationHash?: string;
    activatedAt?: string;
  }> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/blockchain/wallet-status/${userId}`)
      );

      return {
        isActivated: response.isActivated || false,
        registrationHash: response.registrationHash,
        activatedAt: response.activatedAt
      };
    } catch (error) {
      console.error('Error checking wallet activation status:', error);
      return { isActivated: false };
    }
  }

  /**
   * Batch activate multiple wallets (for admin use)
   */
  async batchActivateWallets(wallets: WalletActivationRequest[]): Promise<{
    successful: number;
    failed: number;
    results: WalletActivationResponse[];
  }> {
    const results: WalletActivationResponse[] = [];
    let successful = 0;
    let failed = 0;

    for (const wallet of wallets) {
      try {
        const result = await this.activateWalletOnBlockchain(wallet);
        results.push(result);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        results.push({
          success: false,
          blockchainRegistered: false,
          message: `Failed to activate wallet: ${error}`
        });
      }
    }

    return { successful, failed, results };
  }

  /**
   * Store activation status locally for quick reference
   */
  private storeActivationStatus(userId: string, response: WalletActivationResponse): void {
    try {
      const activationData = {
        userId,
        activated: response.success,
        transactionHash: response.transactionHash,
        timestamp: response.activationTimestamp || new Date().toISOString(),
        blockchainRegistered: response.blockchainRegistered
      };

      localStorage.setItem(`wallet_activation_${userId}`, JSON.stringify(activationData));
      console.log('💾 Wallet activation status stored locally');
    } catch (error) {
      console.warn('Failed to store activation status locally:', error);
    }
  }

  /**
   * Get stored activation status
   */
  getStoredActivationStatus(userId: string): {
    activated: boolean;
    transactionHash?: string;
    timestamp?: string;
  } | null {
    try {
      const stored = localStorage.getItem(`wallet_activation_${userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to retrieve stored activation status:', error);
      return null;
    }
  }

  /**
   * Register wallet for individual user transactions (future enhancement)
   * This would enable user wallets to sign their own progress transactions
   */
  async enableUserTransactions(userId: string, evmAddress: string): Promise<{
    enabled: boolean;
    contractAddress?: string;
    message: string;
  }> {
    try {
      // This would register the user wallet with smart contracts
      // so they can sign their own progress transactions
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/blockchain/enable-user-transactions`, {
          userId,
          evmAddress,
          permissions: ['lesson_completion', 'daily_completion', 'quiz_completion'],
          timestamp: new Date().toISOString()
        })
      );

      return {
        enabled: response.success,
        contractAddress: response.contractAddress,
        message: response.message || 'User transactions enabled successfully'
      };
    } catch (error) {
      console.error('Error enabling user transactions:', error);
      return {
        enabled: false,
        message: 'Failed to enable user transactions. Using company wallet for now.'
      };
    }
  }
}
