import { Injectable } from '@angular/core';

// Simplified crypto service for development
// In production, this will use proper crypto libraries

interface WalletData {
  mnemonic: string;
  seiWallet: {
    address: string;
    publicKey: string;
    privateKey: string;
  };
  evmWallet: {
    address: string;
    publicKey: string;
    privateKey: string;
  };
}

interface EncryptedData {
  encryptedMnemonic: string;
  salt: string;
  nonce: string;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private dbPromise: Promise<any>;

  constructor() {
    this.dbPromise = this.openDB();
  }

  private async openDB(): Promise<any> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('YAPSecureWallet', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for encrypted wallet data
        if (!db.objectStoreNames.contains('encryptedWallets')) {
          const store = db.createObjectStore('encryptedWallets', { keyPath: 'id' });
          store.createIndex('email', 'email', { unique: true });
        }
        
        // Create object store for user preferences (non-sensitive)
        if (!db.objectStoreNames.contains('userPreferences')) {
          db.createObjectStore('userPreferences', { keyPath: 'id' });
        }
      };
    }).then(db => ({
      put: async (storeName: string, data: any, key: string) => {
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          const request = store.put({ id: key, ...data });
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      },
      get: async (storeName: string, key: string) => {
        return new Promise<any>((resolve, reject) => {
          const tx = db.transaction([storeName], 'readonly');
          const store = tx.objectStore(storeName);
          const request = store.get(key);
          
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      delete: async (storeName: string, key: string) => {
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          const request = store.delete(key);
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      },
      clear: async (storeName: string) => {
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          const request = store.clear();
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    }));
  }

  /**
   * Generate a new 12-word mnemonic phrase
   */
  async generateMnemonic(): Promise<string> {
    // For development, generate a simple mnemonic
    // In production, this should use the bip39 library
    const words = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'];
    return words.join(' ');
  }

  /**
   * Derive Sei and EVM wallets from a mnemonic
   */
  async deriveWalletsFromMnemonic(mnemonic: string): Promise<{
    seiWallet: { address: string; publicKey: string; privateKey: string };
    evmWallet: { address: string; publicKey: string; privateKey: string };
  }> {
    // For now, return mock wallets - this will be implemented with actual crypto libraries
    // when the full integration is tested
    return {
      seiWallet: {
        address: 'sei1mock' + Math.random().toString(36).substring(2, 15),
        publicKey: '0x' + Math.random().toString(36).substring(2, 15),
        privateKey: '0x' + Math.random().toString(36).substring(2, 15)
      },
      evmWallet: {
        address: '0x' + Math.random().toString(36).substring(2, 15),
        publicKey: '0x' + Math.random().toString(36).substring(2, 15),
        privateKey: '0x' + Math.random().toString(36).substring(2, 15)
      }
    };
  }

  /**
   * Encrypt mnemonic with user passphrase using Web Crypto API
   */
  async encryptMnemonic(mnemonic: string, passphrase: string): Promise<EncryptedData> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    
    const key = await this.deriveKey(passphrase, salt);
    
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      new TextEncoder().encode(mnemonic)
    );

    return {
      encryptedMnemonic: Array.from(new Uint8Array(cipher)).join(','),
      salt: Array.from(salt).join(','),
      nonce: Array.from(nonce).join(',')
    };
  }

  /**
   * Decrypt mnemonic with user passphrase
   */
  async decryptMnemonic(
    encryptedMnemonic: string, 
    passphrase: string, 
    salt: string, 
    nonce: string
  ): Promise<string> {
    const saltArray = new Uint8Array(salt.split(',').map(Number));
    const nonceArray = new Uint8Array(nonce.split(',').map(Number));
    const cipherArray = new Uint8Array(encryptedMnemonic.split(',').map(Number));
    
    const key = await this.deriveKey(passphrase, saltArray);
    
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonceArray },
        key,
        cipherArray
      );
      
      return new TextDecoder().decode(plain);
    } catch (error) {
      throw new Error('Invalid passphrase or corrupted data');
    }
  }

  /**
   * Derive encryption key from passphrase using PBKDF2
   */
  private async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const pwKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 300_000, hash: 'SHA-256' },
      pwKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Store wallet data securely with GDPR-compliant encryption
   * Follows the secure storage principles: encrypt before store, user-controlled keys
   */
  async storeWalletSecurely(email: string, walletData: WalletData, passphrase: string): Promise<void> {
    const encryptedData = await this.encryptMnemonic(walletData.mnemonic, passphrase);
    
    const payload = {
      email: email,
      encrypted_mnemonic: encryptedData.encryptedMnemonic,
      salt: encryptedData.salt,
      nonce: encryptedData.nonce,
      sei_address: walletData.seiWallet.address,
      sei_public_key: walletData.seiWallet.publicKey,
      eth_address: walletData.evmWallet.address,
      eth_public_key: walletData.evmWallet.publicKey,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString()
    };

    const db = await this.dbPromise;
    await db.put('encryptedWallets', payload, email);
    
    console.log('✅ Wallet data encrypted and stored securely in IndexedDB');
  }

  /**
   * Load and decrypt wallet data from secure storage
   * Returns null if no wallet found or decryption fails
   */
  async loadWalletSecurely(email: string, passphrase: string): Promise<WalletData | null> {
    try {
      const db = await this.dbPromise;
      const data = await db.get('encryptedWallets', email);
      
      if (!data) {
        console.log('No encrypted wallet found for email:', email);
        return null;
      }

      // Update last accessed timestamp
      data.last_accessed = new Date().toISOString();
      await db.put('encryptedWallets', data, email);

      const decryptedMnemonic = await this.decryptMnemonic(
        data.encrypted_mnemonic,
        passphrase,
        data.salt,
        data.nonce
      );

      const wallets = await this.deriveWalletsFromMnemonic(decryptedMnemonic);
      
      return {
        mnemonic: decryptedMnemonic,
        seiWallet: wallets.seiWallet,
        evmWallet: wallets.evmWallet
      };
    } catch (error) {
      console.error('Failed to load wallet securely:', error);
      throw new Error('Invalid passphrase or corrupted wallet data');
    }
  }

  /**
   * Check if encrypted wallet exists for email
   */
  async hasStoredWallet(email: string): Promise<boolean> {
    try {
      const db = await this.dbPromise;
      const data = await db.get('encryptedWallets', email);
      return !!data && !!data.encrypted_mnemonic;
    } catch (error) {
      console.error('Error checking stored wallet:', error);
      return false;
    }
  }

  /**
   * Get encrypted wallet metadata (non-sensitive info)
   */
  async getWalletMetadata(email: string): Promise<{
    sei_address: string;
    eth_address: string;
    created_at: string;
    last_accessed: string;
  } | null> {
    try {
      const db = await this.dbPromise;
      const data = await db.get('encryptedWallets', email);
      
      if (!data) return null;
      
      return {
        sei_address: data.sei_address,
        eth_address: data.eth_address,
        created_at: data.created_at,
        last_accessed: data.last_accessed
      };
    } catch (error) {
      console.error('Error getting wallet metadata:', error);
      return null;
    }
  }

  /**
   * GDPR Right to Erasure: Securely delete all wallet data
   */
  async deleteWalletData(email: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete('encryptedWallets', email);
      
      // Also clear any related localStorage entries
      const addressData = localStorage.getItem('wallet_addresses');
      if (addressData) {
        try {
          const parsed = JSON.parse(addressData);
          const walletMeta = await this.getWalletMetadata(email);
          
          // Only remove if it matches this user's wallet
          if (walletMeta && 
              (parsed.sei_address === walletMeta.sei_address || 
               parsed.eth_address === walletMeta.eth_address)) {
            localStorage.removeItem('wallet_addresses');
          }
        } catch (e) {
          // If parsing fails, just remove the item to be safe
          localStorage.removeItem('wallet_addresses');
        }
      }
      
      console.log('✅ Wallet data securely deleted (GDPR compliance)');
    } catch (error) {
      console.error('Error deleting wallet data:', error);
      throw new Error('Failed to delete wallet data');
    }
  }

  /**
   * Change wallet passphrase (re-encrypt with new key)
   */
  async changePassphrase(email: string, oldPassphrase: string, newPassphrase: string): Promise<void> {
    // First decrypt with old passphrase
    const walletData = await this.loadWalletSecurely(email, oldPassphrase);
    if (!walletData) {
      throw new Error('Invalid old passphrase or wallet not found');
    }
    
    // Re-encrypt with new passphrase
    await this.storeWalletSecurely(email, walletData, newPassphrase);
    
    console.log('✅ Wallet passphrase changed successfully');
  }

  /**
   * Export encrypted wallet data for backup (user can save this)
   */
  async exportEncryptedWallet(email: string): Promise<{
    encrypted_mnemonic: string;
    salt: string;
    nonce: string;
    sei_address: string;
    eth_address: string;
    created_at: string;
  } | null> {
    try {
      const db = await this.dbPromise;
      const data = await db.get('encryptedWallets', email);
      
      if (!data) return null;
      
      // Return only the encrypted data (safe to export)
      return {
        encrypted_mnemonic: data.encrypted_mnemonic,
        salt: data.salt,
        nonce: data.nonce,
        sei_address: data.sei_address,
        eth_address: data.eth_address,
        created_at: data.created_at
      };
    } catch (error) {
      console.error('Error exporting encrypted wallet:', error);
      return null;
    }
  }

  /**
   * Import encrypted wallet data from backup
   */
  async importEncryptedWallet(email: string, encryptedBackup: {
    encrypted_mnemonic: string;
    salt: string;
    nonce: string;
    sei_address: string;
    eth_address: string;
    created_at: string;
  }): Promise<void> {
    const payload = {
      email: email,
      ...encryptedBackup,
      last_accessed: new Date().toISOString()
    };

    const db = await this.dbPromise;
    await db.put('encryptedWallets', payload, email);
    
    console.log('✅ Encrypted wallet imported successfully');
  }

  /**
   * Validate passphrase strength according to security guidelines
   */
  validatePassphraseStrength(passphrase: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (passphrase.length < 8) {
      feedback.push('Passphrase must be at least 8 characters long');
    } else if (passphrase.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }

    if (/[a-z]/.test(passphrase)) score += 1;
    if (/[A-Z]/.test(passphrase)) score += 1;
    if (/[0-9]/.test(passphrase)) score += 1;
    if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;

    if (score < 3) {
      feedback.push('Use a mix of uppercase, lowercase, numbers, and symbols');
    }

    // Check for common weak patterns
    const commonPatterns = ['123456', 'password', 'qwerty', 'abc123'];
    if (commonPatterns.some(pattern => passphrase.toLowerCase().includes(pattern))) {
      feedback.push('Avoid common words and patterns');
      score = Math.max(0, score - 2);
    }

    return {
      isValid: score >= 3 && passphrase.length >= 8,
      score: Math.min(5, score),
      feedback
    };
  }

  /**
   * Security audit: Check for potential vulnerabilities
   */
  async performSecurityAudit(): Promise<{
    isSecure: boolean;
    warnings: string[];
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check if running in secure context
    if (!window.isSecureContext) {
      warnings.push('App is not running in a secure context (HTTPS required for production)');
      recommendations.push('Deploy the app over HTTPS to ensure Web Crypto API security');
    }

    // Check IndexedDB availability
    if (!window.indexedDB) {
      warnings.push('IndexedDB is not available - falling back to less secure storage');
      recommendations.push('Use a modern browser that supports IndexedDB');
    }

    // Check Web Crypto API availability
    if (!window.crypto || !window.crypto.subtle) {
      warnings.push('Web Crypto API is not available - encryption may be compromised');
      recommendations.push('Use a modern browser that supports Web Crypto API');
    }

    // Check for development/debug mode indicators
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      recommendations.push('This is a development environment - ensure production uses HTTPS and secure domains');
    }

    return {
      isSecure: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Clear sensitive data from memory (best effort)
   * Note: JavaScript doesn't provide guaranteed memory clearing, but this helps
   */
  clearSensitiveMemory(sensitiveString: string): void {
    if (typeof sensitiveString === 'string') {
      // Overwrite the string content (best effort in JavaScript)
      try {
        (sensitiveString as any) = '*'.repeat(sensitiveString.length);
      } catch (e) {
        // Strings are immutable in JS, this is just a best effort
      }
    }
  }

  /**
   * Generate a secure random passphrase for users who want one generated
   */
  generateSecurePassphrase(wordCount: number = 4): string {
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
      'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
      'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'against', 'agent',
      'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album'
    ];

    const selectedWords: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % words.length;
      selectedWords.push(words[randomIndex]);
    }

    // Add some random numbers for entropy
    const randomNum = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
    
    return selectedWords.join(' ') + ' ' + randomNum.toString().padStart(4, '0');
  }
}
