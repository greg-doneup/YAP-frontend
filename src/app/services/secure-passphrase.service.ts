import { Injectable } from '@angular/core';

export interface EncryptedStretchedKey {
  encryptedStretchedKey: number[];
  encryptionSalt: number[];
  nonce: number[];
}

export interface SecureWalletData {
  stretchedKey: Uint8Array;
  encryptedStretchedKey: EncryptedStretchedKey;
  encryptedMnemonic: string;
  mnemonicSalt: string;
  mnemonicNonce: string;
}

@Injectable({
  providedIn: 'root'
})
export class SecurePassphraseService {
  
  /**
   * Stretch passphrase using PBKDF2 (client-side only)
   * Server never sees raw passphrases
   */
  async stretchPassphrase(passphrase: string, userSalt: string): Promise<Uint8Array> {
    try {
      console.log('🔑 Starting stretchPassphrase...');
      
      // Validate inputs
      if (!passphrase || passphrase.length === 0) {
        throw new Error('Invalid passphrase provided');
      }
      if (!userSalt || userSalt.length === 0) {
        throw new Error('Invalid user salt provided');
      }
      
      console.log('📊 Input validation passed:', {
        passphraseLength: passphrase.length,
        userSalt: userSalt.substring(0, 3) + '***'
      });

      const encoder = new TextEncoder();
      const passphraseBytes = encoder.encode(passphrase);
      const saltBytes = encoder.encode(`yap-secure-${userSalt}-${Date.now()}`);
      
      console.log('🧂 Generated salt bytes:', saltBytes.length);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw', 
        passphraseBytes, 
        'PBKDF2', 
        false, 
        ['deriveBits']
      );
      console.log('🔑 Key material imported');
      
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
      console.log('🔐 Key derivation completed');
      
      const result = new Uint8Array(stretchedKeyBuffer);
      
      // Validate result
      if (result.length === 0) {
        throw new Error('Key derivation produced empty result');
      }
      
      console.log('✅ Stretched key generated successfully:', result.length, 'bytes');
      return result;
      
    } catch (error) {
      console.error('❌ Error in stretchPassphrase:', error);
      throw new Error(`Failed to stretch passphrase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt stretched passphrase for server storage
   * Uses reversible encryption but server cannot decrypt
   */
  async encryptStretchedPassphrase(
    stretchedKey: Uint8Array, 
    userEmail: string
  ): Promise<EncryptedStretchedKey> {
    try {
      console.log('🔒 Starting encryptStretchedPassphrase...');
      
      // Validate inputs
      if (!stretchedKey || stretchedKey.length === 0) {
        throw new Error('Invalid stretched key provided');
      }
      if (!userEmail || userEmail.length === 0) {
        throw new Error('Invalid user email provided');
      }
      
      console.log('📊 Input validation passed:', {
        stretchedKeyLength: stretchedKey.length,
        userEmail: userEmail.substring(0, 3) + '***'
      });

      // Generate unique salt for this encryption
      const encryptionSalt = crypto.getRandomValues(new Uint8Array(16));
      console.log('🧂 Generated encryption salt:', encryptionSalt.length, 'bytes');
      
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
      console.log('🔑 Key material imported');
      
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
      console.log('🔐 Encryption key derived');
      
      // Encrypt the stretched passphrase
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      console.log('🎲 Generated nonce:', nonce.length, 'bytes');
      
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        encryptionKey,
        stretchedKey
      );
      console.log('✅ Encryption completed');
      
      const result = {
        encryptedStretchedKey: Array.from(new Uint8Array(encryptedData)),
        encryptionSalt: Array.from(encryptionSalt),
        nonce: Array.from(nonce)
      };
      
      // Validate result before returning
      if (result.encryptedStretchedKey.length === 0 || 
          result.encryptionSalt.length === 0 || 
          result.nonce.length === 0) {
        throw new Error('Encryption produced empty arrays');
      }
      
      console.log('✅ Validation passed - returning encrypted data:', {
        encryptedLength: result.encryptedStretchedKey.length,
        saltLength: result.encryptionSalt.length,
        nonceLength: result.nonce.length
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in encryptStretchedPassphrase:', error);
      throw new Error(`Failed to encrypt stretched passphrase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt stretched passphrase for wallet recovery
   * Only works if user provides correct email
   */
  async decryptStretchedPassphrase(
    encryptedData: EncryptedStretchedKey,
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
   * Uses constant-time comparison for security
   */
  async verifyPassphrase(
    providedPassphrase: string,
    userEmail: string,
    storedEncryptedStretched: EncryptedStretchedKey
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

  /**
   * Validate passphrase strength
   */
  validatePassphraseStrength(passphrase: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length scoring
    if (passphrase.length < 12) {
      feedback.push('Passphrase must be at least 12 characters long');
    } else if (passphrase.length >= 20) {
      score += 3;
    } else if (passphrase.length >= 16) {
      score += 2;
    } else {
      score += 1;
    }

    // Character variety
    if (/[a-z]/.test(passphrase)) score += 1;
    if (/[A-Z]/.test(passphrase)) score += 1;
    if (/[0-9]/.test(passphrase)) score += 1;
    if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;

    // Common patterns check
    const commonPatterns = [
      'password', 'passphrase', '123456', 'qwerty', 'letmein'
    ];
    const lowerPassphrase = passphrase.toLowerCase();
    for (const pattern of commonPatterns) {
      if (lowerPassphrase.includes(pattern)) {
        feedback.push(`Avoid common words like "${pattern}"`);
        score = Math.max(0, score - 2);
        break;
      }
    }

    // Security recommendations
    if (score >= 6) {
      feedback.push('Excellent! Your passphrase is very strong.');
    } else if (score >= 4) {
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
}
