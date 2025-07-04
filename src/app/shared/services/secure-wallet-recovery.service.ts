import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface SecureWalletRecoveryRequest {
  email: string;
}

export interface SecureWalletRecoveryResponse {
  success: boolean;
  encrypted_wallet_data: {
    // Encrypted stretched key data (for passphrase verification)
    encryptedStretchedKey: number[];
    encryptionSalt: number[];
    stretchedKeyNonce: number[];
    
    // Encrypted mnemonic data
    encrypted_mnemonic: string;
    mnemonic_salt: string;
    mnemonic_nonce: string;
    
    // Public wallet addresses
    wallet_addresses: {
      sei_address: string;
      eth_address: string;
    };
  };
  user_id: string;
}

export interface DecryptedWalletData {
  mnemonic: string;
  seiAddress: string;
  ethAddress: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SecureWalletRecoveryService {
  private readonly authServiceUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  /**
   * Retrieve encrypted wallet data from secure storage
   */
  async getEncryptedWalletData(email: string): Promise<SecureWalletRecoveryResponse> {
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'X-Security-Version': '2.0'
      });

      const request: SecureWalletRecoveryRequest = { email };

      const response = await firstValueFrom(
        this.http.post<SecureWalletRecoveryResponse>(
          `${this.authServiceUrl}/secure-wallet-recovery`,
          request,
          { headers }
        ).pipe(
          catchError(this.handleError)
        )
      );

      return response;
    } catch (error) {
      console.error('Failed to retrieve encrypted wallet data:', error);
      throw error;
    }
  }

  /**
   * Stretch passphrase using PBKDF2 (matches YAP-landing implementation)
   */
  async stretchPassphrase(passphrase: string, userSalt: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);
    const saltBytes = encoder.encode(`yap-secure-${userSalt}-${Date.now()}`);
    
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
   * Decrypt stretched passphrase for wallet recovery
   */
  async decryptStretchedPassphrase(
    encryptedData: { encryptedStretchedKey: number[]; encryptionSalt: number[]; nonce: number[] },
    userEmail: string
  ): Promise<Uint8Array> {
    // Recreate encryption key from email + salt
    const emailBytes = new TextEncoder().encode(userEmail);
    const encryptionSalt = new Uint8Array(encryptedData.encryptionSalt);
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
      ['decrypt']
    );
    
    // Decrypt the stretched passphrase
    const decryptedData = await crypto.subtle.decrypt(
      { 
        name: 'AES-GCM', 
        iv: new Uint8Array(encryptedData.nonce) 
      },
      encryptionKey,
      new Uint8Array(encryptedData.encryptedStretchedKey)
    );
    
    return new Uint8Array(decryptedData);
  }

  /**
   * Verify passphrase without server involvement
   */
  async verifyPassphrase(
    providedPassphrase: string,
    userEmail: string,
    storedEncryptedStretched: { encryptedStretchedKey: number[]; encryptionSalt: number[]; nonce: number[] }
  ): Promise<boolean> {
    try {
      // Stretch the provided passphrase
      const providedStretched = await this.stretchPassphrase(providedPassphrase, userEmail);
      
      // Decrypt stored stretched passphrase
      const storedStretched = await this.decryptStretchedPassphrase(
        storedEncryptedStretched, 
        userEmail
      );
      
      // Constant-time comparison
      return this.constantTimeEqual(providedStretched, storedStretched);
      
    } catch (error) {
      console.error('Passphrase verification failed:', error);
      return false;
    }
  }

  /**
   * Decrypt mnemonic with stretched key using Web Crypto API
   */
  async decryptMnemonic(
    encryptedMnemonic: string,
    stretchedKey: Uint8Array,
    salt: string,
    nonce: string
  ): Promise<string> {
    try {
      // Parse encrypted data
      const encryptedData = new Uint8Array(
        encryptedMnemonic.split(',').map(Number)
      );
      const nonceArray = new Uint8Array(
        nonce.split(',').map(Number)
      );

      // Import stretched key for decryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        stretchedKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Decrypt mnemonic
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonceArray },
        cryptoKey,
        encryptedData
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Error decrypting mnemonic:', error);
      throw new Error('Failed to decrypt mnemonic - invalid passphrase or corrupted data');
    }
  }

  /**
   * Complete secure wallet recovery process
   */
  async recoverWalletSecurely(email: string, passphrase: string): Promise<DecryptedWalletData> {
    try {
      console.log('🔑 Starting secure wallet recovery for:', email);

      // Step 1: Get encrypted wallet data from server
      const encryptedData = await this.getEncryptedWalletData(email);
      
      if (!encryptedData.success) {
        throw new Error('Failed to retrieve wallet data');
      }

      const walletData = encryptedData.encrypted_wallet_data;

      // Step 2: Verify the user's passphrase by decrypting the stretched key
      const isValidPassphrase = await this.verifyPassphrase(
        passphrase,
        email,
        {
          encryptedStretchedKey: walletData.encryptedStretchedKey,
          encryptionSalt: walletData.encryptionSalt,
          nonce: walletData.stretchedKeyNonce
        }
      );

      if (!isValidPassphrase) {
        throw new Error('Invalid passphrase');
      }

      // Step 3: Decrypt the stored stretched key
      const stretchedKey = await this.decryptStretchedPassphrase(
        {
          encryptedStretchedKey: walletData.encryptedStretchedKey,
          encryptionSalt: walletData.encryptionSalt,
          nonce: walletData.stretchedKeyNonce
        },
        email
      );

      // Step 4: Use stretched key to decrypt the mnemonic
      const mnemonic = await this.decryptMnemonic(
        walletData.encrypted_mnemonic,
        stretchedKey,
        walletData.mnemonic_salt,
        walletData.mnemonic_nonce
      );

      console.log('✅ Secure wallet recovery successful');

      return {
        mnemonic,
        seiAddress: walletData.wallet_addresses.sei_address,
        ethAddress: walletData.wallet_addresses.eth_address,
        userId: encryptedData.user_id
      };

    } catch (error) {
      console.error('❌ Secure wallet recovery failed:', error);
      throw error;
    }
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  private constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }

  private handleError(error: any): Observable<never> {
    console.error('SecureWalletRecoveryService error:', error);
    
    let errorMessage = 'An unexpected error occurred';
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
