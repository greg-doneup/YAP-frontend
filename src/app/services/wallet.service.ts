import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from 'bip39';
import { ethers } from 'ethers';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

export interface WalletCreationResult {
  status: string;
  sei_address: string;
  eth_address: string;
  waitlist_bonus: number;
  message: string;
}

export interface EncryptedMnemonic {
  encrypted_mnemonic: string;
  salt: string;
  nonce: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private apiUrl = environment.apiUrl; // Use environment configuration

  constructor(private http: HttpClient) {}

  /**
   * Generate a new 12-word BIP39 mnemonic
   */
  generateMnemonic(): string {
    return generateMnemonic(128); // 128 bits = 12 words
  }

  /**
   * Validate a BIP39 mnemonic
   */
  validateMnemonic(mnemonic: string): boolean {
    return validateMnemonic(mnemonic);
  }

  /**
   * Create SEI wallet from mnemonic
   */
  createSeiWallet(mnemonic: string): { address: string; publicKey: string } {
    // For SEI, we'll use a simplified approach
    // In production, use proper SEI SDK
    const seed = mnemonicToSeedSync(mnemonic);
    const wallet = ethers.HDNodeWallet.fromSeed(seed);
    
    // SEI derivation path: m/44'/118'/0'/0/0
    const seiWallet = wallet.derivePath("m/44'/118'/0'/0/0");
    
    return {
      address: this.generateSeiAddress(seiWallet.publicKey),
      publicKey: seiWallet.publicKey
    };
  }

  /**
   * Create ETH wallet from mnemonic
   */
  createEthWallet(mnemonic: string): { address: string; publicKey: string } {
    const seed = mnemonicToSeedSync(mnemonic);
    const wallet = ethers.HDNodeWallet.fromSeed(seed);
    
    // Ethereum derivation path: m/44'/60'/0'/0/0
    const ethWallet = wallet.derivePath("m/44'/60'/0'/0/0");
    
    return {
      address: ethWallet.address,
      publicKey: ethWallet.publicKey
    };
  }

  /**
   * Generate SEI address from public key (simplified)
   */
  private generateSeiAddress(publicKey: string): string {
    // This is a simplified implementation
    // In production, use proper bech32 encoding with 'sei' prefix
    const hash = CryptoJS.SHA256(publicKey).toString();
    return `sei${hash.substring(0, 32)}`;
  }

  /**
   * Encrypt mnemonic with passphrase using AES-GCM
   */
  encryptMnemonic(mnemonic: string, passphrase: string): EncryptedMnemonic {
    // Generate random salt and IV
    const salt = CryptoJS.lib.WordArray.random(16);
    const iv = CryptoJS.lib.WordArray.random(12);
    
    // Derive key using PBKDF2
    const key = CryptoJS.PBKDF2(passphrase, salt, {
      keySize: 256/32,
      iterations: 100000
    });
    
    // Encrypt with AES-GCM (using CTR mode as fallback since crypto-js doesn't have GCM)
    const encrypted = CryptoJS.AES.encrypt(mnemonic, key, {
      iv: iv,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding
    });
    
    return {
      encrypted_mnemonic: encrypted.toString(),
      salt: salt.toString(CryptoJS.enc.Base64),
      nonce: iv.toString(CryptoJS.enc.Base64)
    };
  }

  /**
   * Decrypt mnemonic with passphrase
   */
  decryptMnemonic(
    encryptedMnemonic: string, 
    passphrase: string, 
    salt: string, 
    nonce: string
  ): string {
    try {
      const saltWords = CryptoJS.enc.Base64.parse(salt);
      const ivWords = CryptoJS.enc.Base64.parse(nonce);
      
      // Derive key using PBKDF2
      const key = CryptoJS.PBKDF2(passphrase, saltWords, {
        keySize: 256/32,
        iterations: 100000
      });
      
      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(encryptedMnemonic, key, {
        iv: ivWords,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding
      });
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new Error('Invalid passphrase or corrupted data');
    }
  }

  /**
   * Create wallets for waitlist signup
   */
  async createWaitlistWallet(email: string, passphrase: string): Promise<WalletCreationResult> {
    const payload = {
      email: email,
      passphrase: passphrase
    };

    return await firstValueFrom(this.http.post<WalletCreationResult>(
      `${this.apiUrl}/wallet/waitlist-signup`, 
      payload
    ));
  }

  /**
   * Register wallet with encrypted mnemonic
   */
  async registerWallet(
    email: string, 
    passphrase: string,
    encryptedData: EncryptedMnemonic
  ): Promise<any> {
    const payload = {
      email: email,
      passphrase: passphrase,
      encrypted_mnemonic: encryptedData.encrypted_mnemonic,
      salt: encryptedData.salt,
      nonce: encryptedData.nonce
    };

    return firstValueFrom(this.http.post(`${this.apiUrl}/wallet/register`, payload));
  }

  /**
   * Recover wallet using email and passphrase
   */
  async recoverWallet(email: string, passphrase: string): Promise<{mnemonic: string}> {
    const payload = {
      email: email,
      passphrase: passphrase
    };

    return await firstValueFrom(this.http.post<{mnemonic: string}>(
      `${this.apiUrl}/wallet/recover`, 
      payload
    ));
  }
}
