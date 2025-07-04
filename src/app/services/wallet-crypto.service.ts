// Enhanced Wallet Crypto Service for YAP-Frontend
// Uses stretched passphrases for all encryption operations

import { Injectable } from '@angular/core';
import * as bip39 from 'bip39';
import { Wallet, isAddress } from 'ethers';
// import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
// import { toBech32 } from '@cosmjs/encoding';
import * as CryptoJS from 'crypto-js';

export interface WalletData {
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

export interface EncryptedMnemonic {
  encryptedData: string;
  salt: string;
  nonce: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletCryptoService {

  /**
   * Generate a new BIP39 mnemonic (12 words)
   */
  generateMnemonic(): string {
    return bip39.generateMnemonic(128); // 12 words
  }

  /**
   * Validate BIP39 mnemonic
   */
  validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Derive SEI and EVM wallets from mnemonic
   */
  async deriveWalletsFromMnemonic(mnemonic: string): Promise<WalletData> {
    if (!this.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Derive SEI wallet (Cosmos-based)
    const seiWallet = await this.deriveSeiWallet(mnemonic);
    
    // Derive EVM wallet
    const evmWallet = await this.deriveEvmWallet(mnemonic);

    return {
      mnemonic,
      seiWallet,
      evmWallet
    };
  }

  /**
   * Derive SEI wallet from mnemonic
   * Temporarily using mock data until CosmJS compatibility is resolved
   */
  private async deriveSeiWallet(mnemonic: string): Promise<{
    address: string;
    publicKey: string;
    privateKey: string;
  }> {
    try {
      // For now, generate a mock SEI address based on mnemonic hash
      // This will be replaced with proper CosmJS implementation once compatibility is resolved
      const encoder = new TextEncoder();
      const data = encoder.encode(mnemonic);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return {
        address: 'sei1' + hashHex.substring(0, 38), // SEI bech32 address format
        publicKey: 'sei_pub_' + hashHex.substring(0, 32),
        privateKey: hashHex.substring(0, 64)
      };
    } catch (error) {
      console.error('Error deriving SEI wallet:', error);
      throw new Error('Failed to derive SEI wallet from mnemonic');
    }
  }

  /**
   * Derive EVM wallet from mnemonic
   */
  private async deriveEvmWallet(mnemonic: string): Promise<{
    address: string;
    publicKey: string;
    privateKey: string;
  }> {
    try {
      // Create HD wallet from mnemonic using ethers v6 API
      const wallet = Wallet.fromPhrase(mnemonic);

      return {
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKey: (wallet as any).privateKey || ''
      };
    } catch (error) {
      console.error('Error deriving EVM wallet:', error);
      throw new Error('Failed to derive EVM wallet from mnemonic');
    }
  }

  /**
   * Encrypt mnemonic with stretched key using Web Crypto API
   */
  async encryptMnemonic(mnemonic: string, stretchedKey: Uint8Array): Promise<EncryptedMnemonic> {
    try {
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
    } catch (error) {
      console.error('Error encrypting mnemonic:', error);
      throw new Error('Failed to encrypt mnemonic');
    }
  }

  /**
   * Decrypt mnemonic with stretched key using Web Crypto API
   */
  async decryptMnemonic(
    encryptedMnemonic: EncryptedMnemonic,
    stretchedKey: Uint8Array
  ): Promise<string> {
    try {
      // Parse encrypted data
      const encryptedData = new Uint8Array(
        encryptedMnemonic.encryptedData.split(',').map(Number)
      );
      const nonce = new Uint8Array(
        encryptedMnemonic.nonce.split(',').map(Number)
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
        { name: 'AES-GCM', iv: nonce },
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
   * Fallback encryption using crypto-js (for compatibility)
   */
  encryptMnemonicFallback(mnemonic: string, passphrase: string): EncryptedMnemonic {
    try {
      const salt = CryptoJS.lib.WordArray.random(16);
      const nonce = CryptoJS.lib.WordArray.random(12);
      
      const key = CryptoJS.PBKDF2(passphrase, salt, {
        keySize: 256/32,
        iterations: 100000
      });
      
      const encrypted = CryptoJS.AES.encrypt(mnemonic, key, {
        iv: nonce,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding
      });
      
      return {
        encryptedData: encrypted.toString(),
        salt: salt.toString(CryptoJS.enc.Base64),
        nonce: nonce.toString(CryptoJS.enc.Base64)
      };
    } catch (error) {
      console.error('Error in fallback encryption:', error);
      throw new Error('Failed to encrypt mnemonic');
    }
  }

  /**
   * Fallback decryption using crypto-js (for compatibility)
   */
  decryptMnemonicFallback(
    encryptedMnemonic: EncryptedMnemonic,
    passphrase: string
  ): string {
    try {
      const salt = CryptoJS.enc.Base64.parse(encryptedMnemonic.salt);
      const nonce = CryptoJS.enc.Base64.parse(encryptedMnemonic.nonce);
      
      const key = CryptoJS.PBKDF2(passphrase, salt, {
        keySize: 256/32,
        iterations: 100000
      });
      
      const decrypted = CryptoJS.AES.decrypt(encryptedMnemonic.encryptedData, key, {
        iv: nonce,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding
      });
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Error in fallback decryption:', error);
      throw new Error('Failed to decrypt mnemonic');
    }
  }

  /**
   * Validate wallet addresses
   */
  validateSeiAddress(address: string): boolean {
    return address.startsWith('sei1') && address.length >= 40;
  }

  validateEvmAddress(address: string): boolean {
    return isAddress(address);
  }

  /**
   * Test mnemonic recovery by deriving addresses
   */
  async testMnemonicRecovery(mnemonic: string): Promise<{
    isValid: boolean;
    seiAddress?: string;
    evmAddress?: string;
    error?: string;
  }> {
    try {
      if (!this.validateMnemonic(mnemonic)) {
        return { isValid: false, error: 'Invalid mnemonic phrase' };
      }

      const wallets = await this.deriveWalletsFromMnemonic(mnemonic);
      
      return {
        isValid: true,
        seiAddress: wallets.seiWallet.address,
        evmAddress: wallets.evmWallet.address
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Failed to derive wallets'
      };
    }
  }
}
