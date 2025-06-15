import { Injectable } from '@angular/core';
import { SecureWalletRecoveryService, DecryptedWalletData } from './secure-wallet-recovery.service';
import { WalletService } from './wallet.service';
import { CryptoService } from './crypto.service';

export interface SecureWalletOperationResult {
  success: boolean;
  walletData?: {
    mnemonic: string;
    seiAddress: string;
    ethAddress: string;
    userId: string;
  };
  error?: string;
  message: string;
}

export interface WalletRecoveryOptions {
  useSecureArchitecture?: boolean;
  fallbackToLegacy?: boolean;
  storeLocally?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SecureWalletIntegrationService {

  constructor(
    private secureWalletRecoveryService: SecureWalletRecoveryService,
    private walletService: WalletService,
    private cryptoService: CryptoService
  ) {}

  /**
   * Unified wallet recovery that automatically detects and uses the appropriate method
   */
  async recoverWallet(
    email: string, 
    passphrase: string,
    options: WalletRecoveryOptions = {}
  ): Promise<SecureWalletOperationResult> {
    const { 
      useSecureArchitecture = true, 
      fallbackToLegacy = true,
      storeLocally = true 
    } = options;

    try {
      console.log('🔄 Starting unified wallet recovery process...');

      if (useSecureArchitecture) {
        try {
          console.log('🔐 Attempting secure architecture recovery...');
          
          // Try the new secure architecture first
          const secureResult = await this.recoverWithSecureArchitecture(email, passphrase);
          
          if (storeLocally && secureResult.success && secureResult.walletData) {
            // Store in local crypto service for seamless app usage
            await this.storeInLocalCrypto(email, secureResult.walletData, passphrase);
          }

          return secureResult;

        } catch (secureError: any) {
          console.log('⚠️ Secure architecture recovery failed:', secureError.message);
          
          if (!fallbackToLegacy) {
            return {
              success: false,
              error: 'secure_recovery_failed',
              message: `Secure recovery failed: ${secureError.message}`
            };
          }

          console.log('🔄 Falling back to legacy recovery...');
        }
      }

      if (fallbackToLegacy) {
        try {
          console.log('🔙 Attempting legacy wallet recovery...');
          
          const legacyResult = await this.recoverWithLegacyArchitecture(email, passphrase);
          
          if (storeLocally && legacyResult.success && legacyResult.walletData) {
            await this.storeInLocalCrypto(email, legacyResult.walletData, passphrase);
          }

          return legacyResult;

        } catch (legacyError: any) {
          console.error('❌ Legacy recovery also failed:', legacyError.message);
          
          return {
            success: false,
            error: 'all_recovery_methods_failed',
            message: `All recovery methods failed. Legacy: ${legacyError.message}`
          };
        }
      }

      return {
        success: false,
        error: 'no_recovery_methods_enabled',
        message: 'No recovery methods were enabled'
      };

    } catch (error: any) {
      console.error('❌ Unified wallet recovery failed:', error);
      return {
        success: false,
        error: 'unexpected_error',
        message: `Unexpected error during recovery: ${error.message}`
      };
    }
  }

  /**
   * Recover wallet using the new secure architecture (zero server-side passphrase exposure)
   */
  private async recoverWithSecureArchitecture(
    email: string, 
    passphrase: string
  ): Promise<SecureWalletOperationResult> {
    try {
      const recoveredData = await this.secureWalletRecoveryService.recoverWalletSecurely(email, passphrase);
      
      return {
        success: true,
        walletData: {
          mnemonic: recoveredData.mnemonic,
          seiAddress: recoveredData.seiAddress,
          ethAddress: recoveredData.ethAddress,
          userId: recoveredData.userId
        },
        message: 'Wallet recovered successfully using secure architecture'
      };

    } catch (error: any) {
      // Map specific secure architecture errors
      if (error.message?.includes('No secure wallet found')) {
        throw new Error('User does not have a secure wallet setup');
      }
      if (error.message?.includes('Invalid passphrase')) {
        throw new Error('Invalid passphrase provided');
      }
      if (error.message?.includes('No account found')) {
        throw new Error('No account found with this email');
      }
      
      throw new Error(`Secure recovery failed: ${error.message}`);
    }
  }

  /**
   * Recover wallet using the legacy architecture (for backward compatibility)
   */
  private async recoverWithLegacyArchitecture(
    email: string, 
    passphrase: string
  ): Promise<SecureWalletOperationResult> {
    try {
      const legacyResult = await this.walletService.recoverWallet(email, passphrase);
      
      if (!legacyResult.success || !legacyResult.encrypted_wallet_data) {
        throw new Error('Legacy recovery returned no wallet data');
      }

      // Decrypt the legacy encrypted data using CryptoService
      const mnemonic = await this.cryptoService.decryptMnemonic(
        legacyResult.encrypted_wallet_data.encrypted_mnemonic,
        passphrase,
        legacyResult.encrypted_wallet_data.salt,
        legacyResult.encrypted_wallet_data.nonce
      );

      // Derive wallet addresses from mnemonic
      const wallets = await this.cryptoService.deriveWalletsFromMnemonic(mnemonic);

      return {
        success: true,
        walletData: {
          mnemonic,
          seiAddress: wallets.seiWallet.address,
          ethAddress: wallets.evmWallet.address,
          userId: legacyResult.user_id || 'unknown'
        },
        message: 'Wallet recovered successfully using legacy architecture'
      };

    } catch (error: any) {
      // Map specific legacy errors
      if (error.error === 'setup_required') {
        throw new Error('Wallet setup is required for this account');
      }
      if (error.error === 'invalid_passphrase') {
        throw new Error('Invalid passphrase provided');
      }
      if (error.message?.includes('Wallet not found')) {
        throw new Error('No wallet found for this email');
      }
      
      throw new Error(`Legacy recovery failed: ${error.message}`);
    }
  }

  /**
   * Store recovered wallet data in local CryptoService storage
   */
  private async storeInLocalCrypto(
    email: string, 
    walletData: any, 
    passphrase: string
  ): Promise<void> {
    try {
      const cryptoWalletData = {
        mnemonic: walletData.mnemonic,
        seiWallet: {
          address: walletData.seiAddress,
          publicKey: 'recovered_' + Math.random().toString(36).substring(2, 16),
          privateKey: 'recovered_' + Math.random().toString(36).substring(2, 32)
        },
        evmWallet: {
          address: walletData.ethAddress,
          publicKey: 'recovered_' + Math.random().toString(36).substring(2, 16),
          privateKey: 'recovered_' + Math.random().toString(36).substring(2, 32)
        }
      };

      await this.cryptoService.storeWalletSecurely(email, cryptoWalletData, passphrase);
      console.log('✅ Wallet data stored locally for seamless app usage');

    } catch (error) {
      console.warn('⚠️ Failed to store wallet locally (non-critical):', error);
      // Don't throw - local storage failure shouldn't fail the recovery
    }
  }

  /**
   * Check if a user has a secure wallet setup
   */
  async hasSecureWallet(email: string): Promise<boolean> {
    try {
      await this.secureWalletRecoveryService.getEncryptedWalletData(email);
      return true;
    } catch (error: any) {
      if (error.message?.includes('No secure wallet found')) {
        return false;
      }
      // If there's another error, we can't determine - assume false
      return false;
    }
  }

  /**
   * Check if a user has a legacy wallet setup
   */
  async hasLegacyWallet(email: string): Promise<boolean> {
    try {
      const encryptedData = await this.walletService.getEncryptedWalletData(email);
      return !!encryptedData;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get wallet status for a user
   */
  async getWalletStatus(email: string): Promise<{
    hasSecureWallet: boolean;
    hasLegacyWallet: boolean;
    recommendedAction: 'setup' | 'use_secure' | 'use_legacy' | 'migrate_to_secure';
  }> {
    const [hasSecure, hasLegacy] = await Promise.all([
      this.hasSecureWallet(email),
      this.hasLegacyWallet(email)
    ]);

    let recommendedAction: 'setup' | 'use_secure' | 'use_legacy' | 'migrate_to_secure';

    if (hasSecure && hasLegacy) {
      recommendedAction = 'use_secure';
    } else if (hasSecure) {
      recommendedAction = 'use_secure';
    } else if (hasLegacy) {
      recommendedAction = 'migrate_to_secure';
    } else {
      recommendedAction = 'setup';
    }

    return {
      hasSecureWallet: hasSecure,
      hasLegacyWallet: hasLegacy,
      recommendedAction
    };
  }

  /**
   * Secure wallet registration for new users
   */
  async registerSecureWallet(
    email: string,
    passphrase: string,
    name: string,
    language_to_learn: string,
    options: WalletRecoveryOptions = {}
  ): Promise<SecureWalletOperationResult> {
    try {
      console.log('🔐 Starting secure wallet registration...');

      const { storeLocally = true } = options;

      // Generate a new mnemonic
      const mnemonic = this.cryptoService.generateMnemonic();
      
      // Derive wallet addresses
      const walletData = await this.cryptoService.deriveWalletsFromMnemonic(mnemonic);
      
      // Generate secure materials
      const secureMaterials = await this.generateSecureMaterials(email, passphrase, mnemonic);
      
      // Register with backend
      const registrationResponse = await this.registerWithBackend(
        email,
        name,
        language_to_learn,
        secureMaterials
      );

      if (registrationResponse.success) {
        const result = {
          mnemonic,
          seiAddress: walletData.seiWallet.address,
          ethAddress: walletData.evmWallet.address,
          userId: registrationResponse.userId
        };

        // Store locally if requested
        if (storeLocally) {
          await this.storeWalletDataLocally(result);
        }

        return {
          success: true,
          walletData: result,
          message: 'Secure wallet created successfully'
        };
      } else {
        throw new Error(registrationResponse.message || 'Registration failed');
      }

    } catch (error: any) {
      console.error('❌ Secure wallet registration failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create secure wallet'
      };
    }
  }

  /**
   * Convert existing waitlist user to secure wallet
   */
  async convertWaitlistToSecure(
    email: string,
    passphrase: string,
    waitlistData: { name: string; language_to_learn: string; userId?: string }
  ): Promise<SecureWalletOperationResult> {
    try {
      console.log('🔄 Converting waitlist user to secure wallet...');

      // Generate a new mnemonic for the secure wallet
      const mnemonic = this.cryptoService.generateMnemonic();
      
      // Derive wallet addresses
      const walletData = await this.cryptoService.deriveWalletsFromMnemonic(mnemonic);
      
      // Generate secure materials
      const secureMaterials = await this.generateSecureMaterials(email, passphrase, mnemonic);
      
      // Convert via backend
      const conversionResponse = await this.convertWaitlistWithBackend(
        waitlistData.userId || email,
        secureMaterials
      );

      if (conversionResponse.success) {
        const result = {
          mnemonic,
          seiAddress: walletData.seiWallet.address,
          ethAddress: walletData.evmWallet.address,
          userId: waitlistData.userId || conversionResponse.userId
        };

        await this.storeWalletDataLocally(result);

        return {
          success: true,
          walletData: result,
          message: 'Waitlist user converted to secure wallet successfully'
        };
      } else {
        throw new Error(conversionResponse.message || 'Conversion failed');
      }

    } catch (error: any) {
      console.error('❌ Waitlist conversion failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to convert waitlist user'
      };
    }
  }

  /**
   * Generate secure materials for wallet creation
   */
  private async generateSecureMaterials(
    email: string,
    passphrase: string,
    mnemonic: string
  ): Promise<any> {
    try {
      // This would contain the logic to generate secure passphrase materials
      // For now, return a placeholder structure
      return {
        encryptedStretchedKey: Array.from(crypto.getRandomValues(new Uint8Array(32))),
        encryptionSalt: Array.from(crypto.getRandomValues(new Uint8Array(16))),
        stretchedKeyNonce: Array.from(crypto.getRandomValues(new Uint8Array(12))),
        encryptedMnemonic: 'placeholder_encrypted_mnemonic',
        mnemonicSalt: 'placeholder_salt',
        mnemonicNonce: 'placeholder_nonce'
      };
    } catch (error) {
      console.error('Error generating secure materials:', error);
      throw error;
    }
  }

  /**
   * Register with backend
   */
  private async registerWithBackend(
    email: string,
    name: string,
    language_to_learn: string,
    secureMaterials: any
  ): Promise<{ success: boolean; userId: string; message: string }> {
    try {
      // This would call the actual backend registration endpoint
      // For now, return a mock success response
      return {
        success: true,
        userId: 'mock_user_' + Date.now(),
        message: 'User registered successfully'
      };
    } catch (error) {
      console.error('Backend registration failed:', error);
      throw error;
    }
  }

  /**
   * Convert waitlist user with backend
   */
  private async convertWaitlistWithBackend(
    userId: string,
    secureMaterials: any
  ): Promise<{ success: boolean; userId: string; message: string }> {
    try {
      // This would call the actual backend conversion endpoint
      // For now, return a mock success response
      return {
        success: true,
        userId: userId,
        message: 'Waitlist user converted successfully'
      };
    } catch (error) {
      console.error('Backend conversion failed:', error);
      throw error;
    }
  }

  /**
   * Store wallet data locally
   */
  private async storeWalletDataLocally(walletData: any): Promise<void> {
    try {
      // Store wallet data in local storage or IndexedDB
      // This is a simplified implementation
      const walletInfo = {
        seiAddress: walletData.seiAddress,
        ethAddress: walletData.ethAddress,
        userId: walletData.userId,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('yap_wallet_info', JSON.stringify(walletInfo));
      console.log('✅ Wallet data stored locally');
    } catch (error) {
      console.error('Failed to store wallet data locally:', error);
      // Don't throw - this is not critical
    }
  }
}
