import { Injectable } from '@angular/core';

export interface WalletStorageData {
  userId: string;
  rawMnemonic: string; // Store raw mnemonic in IndexedDB (client-side secure)
  salt: string;
  nonce: string;
  seiWalletAddress: string;
  evmWalletAddress: string;
  createdAt: Date;
  lastAccessed: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WalletStorageService {
  private readonly DB_NAME = 'YAP-SecureWallets'; // Use same DB as registration service
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'wallets';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  /**
   * Initialize IndexedDB for secure wallet storage
   */
  private async initDB(): Promise<void> {
    console.log('🔍 [DEBUG] WalletStorageService.initDB starting...');
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB in WalletStorageService:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ WalletStorageService IndexedDB opened successfully');
        console.log('🔍 [DEBUG] Available object stores:', Array.from(this.db.objectStoreNames));
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('🔍 [DEBUG] WalletStorageService IndexedDB upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          console.log('🔍 [DEBUG] Creating wallets store in WalletStorageService');
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'userId' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          console.log('✅ Created wallets store with userId keyPath in WalletStorageService');
        }
      };
    });
  }

  /**
   * Store encrypted wallet data securely in IndexedDB
   */
  async storeWalletData(walletData: WalletStorageData): Promise<boolean> {
    try {
      console.log('🔍 [DEBUG] WalletStorageService.storeWalletData called with:', walletData);
      
      if (!this.db) {
        console.log('🔍 [DEBUG] Database not initialized, initializing...');
        await this.initDB();
      }

      console.log('🔍 [DEBUG] Database initialized, storing data...');

      return new Promise((resolve, reject) => {
        if (!this.db) {
          console.error('❌ Database still not available after initialization');
          resolve(false);
          return;
        }

        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const dataToStore = {
          ...walletData,
          lastAccessed: new Date()
        };
        
        console.log('🔍 [DEBUG] Storing data to IndexedDB:', dataToStore);
        
        const request = store.put(dataToStore);

        request.onsuccess = () => {
          console.log('✅ Wallet data stored securely in WalletStorageService');
          resolve(true);
        };

        request.onerror = () => {
          console.error('❌ Failed to store wallet data in WalletStorageService:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ Error in WalletStorageService.storeWalletData:', error);
      return false;
    }
  }

  /**
   * Retrieve encrypted wallet data from IndexedDB
   */
  async getWalletData(userId: string): Promise<WalletStorageData | null> {
    try {
      if (!this.db) {
        await this.initDB();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(userId);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            // Update last accessed time
            this.updateLastAccessed(userId);
          }
          resolve(result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error retrieving wallet data:', error);
      return null;
    }
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(userId: string): Promise<void> {
    try {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const getRequest = store.get(userId);
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.lastAccessed = new Date();
          store.put(data);
        }
      };
    } catch (error) {
      console.error('Error updating last accessed:', error);
    }
  }

  /**
   * Delete wallet data from IndexedDB
   */
  async deleteWalletData(userId: string): Promise<boolean> {
    try {
      if (!this.db) {
        await this.initDB();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.delete(userId);

        request.onsuccess = () => {
          console.log('✅ Wallet data deleted securely');
          resolve(true);
        };

        request.onerror = () => {
          console.error('❌ Failed to delete wallet data');
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error deleting wallet data:', error);
      return false;
    }
  }

  /**
   * Check if wallet data exists for user
   */
  async hasWalletData(userId: string): Promise<boolean> {
    const data = await this.getWalletData(userId);
    return data !== null;
  }

  /**
   * Clear all wallet data (for logout/reset)
   */
  async clearAllWalletData(): Promise<boolean> {
    try {
      if (!this.db) {
        await this.initDB();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('✅ All wallet data cleared');
          resolve(true);
        };

        request.onerror = () => {
          console.error('❌ Failed to clear wallet data');
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error clearing wallet data:', error);
      return false;
    }
  }
}
