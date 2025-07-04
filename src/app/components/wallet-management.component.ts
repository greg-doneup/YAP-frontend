import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { WalletService } from '../services/wallet.service';
import { TokenService } from '../services/token.service';
import { CryptoBrowserService } from '../shared/services/crypto-browser.service';
import { SecurePassphraseService } from '../services/secure-passphrase.service';
import { WalletCryptoService } from '../services/wallet-crypto.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-wallet-management',
  templateUrl: './wallet-management.component.html',
  styleUrls: ['./wallet-management.component.scss']
})
export class WalletManagementComponent implements OnInit, OnDestroy {
  walletAddress?: string;
  ethWalletAddress?: string;
  balance?: number;
  mnemonic?: string;
  showMnemonic = false;
  isLoading = false;
  private subscription?: Subscription;

  constructor(
    private walletService: WalletService,
    private tokenService: TokenService,
    private cryptoBrowserService: CryptoBrowserService,
    private securePassphraseService: SecurePassphraseService,
    private walletCryptoService: WalletCryptoService,
    private alertController: AlertController,
    private modalController: ModalController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadWalletInfo();
    
    // Subscribe to token balance updates
    this.subscription = this.tokenService.tokenBalance$.subscribe(balance => {
      this.balance = balance.totalBalance;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Public method to refresh wallet info (can be called externally)
   */
  async refreshWalletInfo() {
    await this.loadWalletInfo();
  }

  async loadWalletInfo() {
    this.isLoading = true;
    try {
      console.log('🔍 [DEBUG] WalletManagementComponent.loadWalletInfo starting...');
      
      // Get current user email for wallet lookup
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        console.log('🔍 [DEBUG] Loading wallet info for user:', currentUser.email);
        console.log('🔍 [DEBUG] Current user data:', currentUser);
        
        // Try multiple approaches to get wallet data
        let walletFound = false;
        
        // Approach 1: Use CryptoBrowserService to get wallet metadata
        console.log('🔍 [DEBUG] Attempting to get wallet metadata from CryptoBrowserService...');
        const walletMetadata = await this.cryptoBrowserService.getWalletMetadata(currentUser.email);
        if (walletMetadata) {
          console.log('✅ Found wallet metadata:', walletMetadata);
          
          // Validate wallet addresses before using them
          const validSeiAddress = this.isValidWalletAddress(walletMetadata.sei_address, 'sei');
          const validEvmAddress = this.isValidWalletAddress(walletMetadata.eth_address, 'evm');
          
          this.walletAddress = validSeiAddress ? walletMetadata.sei_address : undefined;
          this.ethWalletAddress = validEvmAddress ? walletMetadata.eth_address : undefined;
          
          console.log('Wallet addresses loaded and validated:', {
            sei: this.walletAddress,
            seiValid: validSeiAddress,
            eth: this.ethWalletAddress,
            evmValid: validEvmAddress
          });
          
          if (validSeiAddress && validEvmAddress) {
            walletFound = true;
          }
          
          // If addresses are invalid, show warning
          if (!validSeiAddress || !validEvmAddress) {
            console.warn('⚠️ Invalid wallet addresses detected. You may need to clear your data and re-register.');
            this.presentToast('Invalid wallet data detected. Please clear your data and re-register if addresses show as "Not available".', 'warning');
          }
        }
        
        // Approach 2: Check currentUser object directly (from JWT)
        if (!walletFound && (currentUser.walletAddress || currentUser.ethWalletAddress)) {
          console.log('🔍 [DEBUG] Using wallet addresses from currentUser object...');
          this.walletAddress = currentUser.walletAddress;
          this.ethWalletAddress = currentUser.ethWalletAddress;
          walletFound = true;
        }
        
        // Approach 3: Fallback to localStorage wallet_addresses
        if (!walletFound) {
          console.log('🔍 [DEBUG] Checking localStorage for wallet_addresses...');
          const walletAddressesStr = localStorage.getItem('wallet_addresses');
          if (walletAddressesStr) {
            try {
              const walletAddresses = JSON.parse(walletAddressesStr);
              if (walletAddresses.sei_address || walletAddresses.eth_address) {
                console.log('✅ Found wallet addresses in localStorage wallet_addresses');
                this.walletAddress = walletAddresses.sei_address;
                this.ethWalletAddress = walletAddresses.eth_address;
                walletFound = true;
              }
            } catch (error) {
              console.error('Error parsing wallet_addresses from localStorage:', error);
            }
          }
        }
        
        // Approach 4: Check user_wallet in localStorage
        if (!walletFound) {
          console.log('🔍 [DEBUG] Checking localStorage for user_wallet...');
          const userWalletStr = localStorage.getItem('user_wallet');
          if (userWalletStr) {
            try {
              const userWallet = JSON.parse(userWalletStr);
              if (userWallet.sei_address || userWallet.eth_address) {
                console.log('✅ Found wallet addresses in localStorage user_wallet');
                this.walletAddress = userWallet.sei_address;
                this.ethWalletAddress = userWallet.eth_address;
                walletFound = true;
              }
            } catch (error) {
              console.error('Error parsing user_wallet from localStorage:', error);
            }
          }
        }

        // Approach 5: Check individual localStorage keys
        if (!walletFound) {
          console.log('🔍 [DEBUG] Checking individual localStorage keys...');
          const storedWallet = localStorage.getItem('yap_wallet_address');
          const storedEthWallet = localStorage.getItem('yap_eth_wallet_address');
          if (storedWallet || storedEthWallet) {
            console.log('✅ Found wallet addresses in individual localStorage keys');
            this.walletAddress = storedWallet || undefined;
            this.ethWalletAddress = storedEthWallet || undefined;
            walletFound = true;
          }
        }
        
        if (walletFound) {
          console.log('✅ Wallet data loaded successfully:', {
            seiAddress: this.walletAddress,
            evmAddress: this.ethWalletAddress
          });
        } else {
          console.warn('❌ No wallet data found in any location');
        }
      } else {
        console.warn('❌ No currentUser found in localStorage');
      }
      
      // Get token balance from observable
      this.tokenService.tokenBalance$.subscribe(balance => {
        this.balance = balance.totalBalance;
      });
    } catch (error) {
      console.error('❌ Error loading wallet info:', error);
      this.presentToast('Error loading wallet information', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async showMnemonicWarning() {
    const alert = await this.alertController.create({
      header: 'Security Warning',
      message: 'Your recovery phrase (mnemonic) grants full access to your wallet. Never share it with anyone and ensure you\'re in a private location before revealing it.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'I Understand',
          handler: () => {
            this.revealMnemonic();
          }
        }
      ]
    });
    await alert.present();
  }

  async revealMnemonic() {
    try {
      // Get current user email for encrypted mnemonic lookup
      const currentUserStr = localStorage.getItem('currentUser');
      if (!currentUserStr) {
        this.presentToast('User not found - please log in again', 'danger');
        return;
      }
      
      const currentUser = JSON.parse(currentUserStr);
      console.log('🔍 Getting encrypted mnemonic for user:', currentUser.email);
      
      // Get encrypted mnemonic from secure IndexedDB storage
      const encryptedMnemonicData = await this.cryptoBrowserService.getEncryptedMnemonic(currentUser.email);
      
      if (encryptedMnemonicData && encryptedMnemonicData.encryptedData) {
        console.log('✅ Found encrypted mnemonic data');
        
        // Ask for passphrase to decrypt the mnemonic
        const alert = await this.alertController.create({
          header: 'Enter Passphrase',
          message: 'Enter your wallet passphrase to decrypt and reveal your recovery phrase.',
          inputs: [
            {
              name: 'passphrase',
              type: 'password',
              placeholder: 'Enter your wallet passphrase'
            }
          ],
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Decrypt',
              handler: async (data) => {
                if (!data.passphrase) {
                  this.presentToast('Passphrase is required', 'warning');
                  return;
                }
                
                try {
                  console.log('🔍 Attempting to decrypt mnemonic with passphrase...');
                  
                  // Step 1: Stretch the passphrase using the same method as registration
                  const stretchedKey = await this.securePassphraseService.stretchPassphrase(data.passphrase, currentUser.email);
                  console.log('✅ Passphrase stretched successfully');
                  
                  // Step 2: Decrypt the mnemonic using the stretched key
                  const decryptedMnemonic = await this.walletCryptoService.decryptMnemonic(
                    {
                      encryptedData: encryptedMnemonicData.encryptedData,
                      salt: encryptedMnemonicData.salt,
                      nonce: encryptedMnemonicData.nonce
                    },
                    stretchedKey
                  );
                  
                  console.log('✅ Mnemonic decrypted successfully');
                  
                  // Show the decrypted mnemonic
                  this.mnemonic = decryptedMnemonic;
                  this.showMnemonic = true;
                  
                  // Show success message
                  this.presentToast('Recovery phrase revealed successfully', 'success');
                  
                } catch (error) {
                  console.error('❌ Error decrypting mnemonic:', error);
                  
                  // Check if it's a passphrase error
                  if (error instanceof Error && error.message.includes('decrypt')) {
                    this.presentToast('Invalid passphrase - unable to decrypt recovery phrase', 'danger');
                  } else {
                    this.presentToast('Failed to decrypt recovery phrase', 'danger');
                  }
                }
              }
            }
          ]
        });
        await alert.present();
      } else {
        console.error('❌ No encrypted mnemonic found in IndexedDB');
        this.presentToast('No encrypted mnemonic found. Your wallet may not be properly set up.', 'warning');
        
        // Check if we have any fallback data
        const legacyEncryptedMnemonic = localStorage.getItem('yap_encrypted_mnemonic');
        if (legacyEncryptedMnemonic) {
          this.presentToast('Legacy mnemonic data found in localStorage (not secure)', 'warning');
        }
      }
    } catch (error) {
      console.error('❌ Error getting encrypted mnemonic:', error);
      this.presentToast('Error retrieving recovery phrase', 'danger');
    }
  }

  hideMnemonic() {
    this.showMnemonic = false;
    this.mnemonic = undefined;
  }

  async copyMnemonic() {
    if (this.mnemonic) {
      try {
        await navigator.clipboard.writeText(this.mnemonic);
        this.presentToast('Recovery phrase copied to clipboard', 'success');
      } catch (error) {
        console.error('Error copying mnemonic:', error);
        this.presentToast('Error copying to clipboard', 'danger');
      }
    }
  }

  async copyAddress(type: 'sei' | 'evm' = 'sei') {
    const address = type === 'sei' ? this.walletAddress : this.ethWalletAddress;
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        this.presentToast(`${type.toUpperCase()} wallet address copied to clipboard`, 'success');
      } catch (error) {
        console.error('Error copying address:', error);
        this.presentToast('Error copying to clipboard', 'danger');
      }
    }
  }

  async exportWallet() {
    const alert = await this.alertController.create({
      header: 'Export Wallet',
      message: 'Choose export format:',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Recovery Phrase',
          handler: () => {
            this.exportMnemonic();
          }
        },
        {
          text: 'Wallet Info',
          handler: () => {
            this.exportWalletInfo();
          }
        }
      ]
    });
    await alert.present();
  }

  async exportMnemonic() {
    if (this.mnemonic) {
      const dataStr = `YAP Wallet Recovery Phrase:\n\n${this.mnemonic}\n\nWallet Address: ${this.walletAddress}\n\nIMPORTANT: Keep this phrase secure and private. Anyone with access to this phrase can control your wallet.`;
      this.downloadTextFile(dataStr, 'yap-wallet-recovery.txt');
      this.presentToast('Recovery phrase exported', 'success');
    } else {
      this.presentToast('Please reveal mnemonic first', 'warning');
    }
  }

  async exportWalletInfo() {
    try {
      const dataStr = `YAP Wallet Information:\n\nWallet Address: ${this.walletAddress}\nToken Balance: ${this.balance}\nExported: ${new Date().toISOString()}\n\nNote: This export does not include your recovery phrase.`;
      this.downloadTextFile(dataStr, 'yap-wallet-info.txt');
      this.presentToast('Wallet info exported', 'success');
    } catch (error) {
      console.error('Error exporting wallet info:', error);
      this.presentToast('Error exporting wallet info', 'danger');
    }
  }

  private downloadTextFile(text: string, filename: string) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  async refreshBalance() {
    this.isLoading = true;
    try {
      // Trigger a refresh of all token data
      this.tokenService.refreshAllData();
      this.presentToast('Balance refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing balance:', error);
      this.presentToast('Error refreshing balance', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  close() {
    this.modalController.dismiss();
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Validate wallet address format and length
   */
  private isValidWalletAddress(address: string | undefined, type: 'sei' | 'evm'): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    if (type === 'sei') {
      // SEI addresses should start with 'sei1' and be approximately 42 characters
      return address.startsWith('sei1') && address.length >= 40 && address.length <= 45;
    } else if (type === 'evm') {
      // EVM addresses should start with '0x' and be exactly 42 characters
      return address.startsWith('0x') && address.length === 42 && /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    return false;
  }

  /**
   * Clear invalid wallet data and guide user to re-register
   */
  async clearInvalidWalletData() {
    const alert = await this.alertController.create({
      header: 'Clear Wallet Data',
      message: 'This will clear your stored wallet data. You will need to re-register to generate new wallet addresses. Your account data will remain intact.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear Data',
          handler: async () => {
            try {
              // Clear IndexedDB data
              await this.cryptoBrowserService.clearWalletData();
              
              // Clear localStorage data
              localStorage.removeItem('yap_wallet_address');
              localStorage.removeItem('yap_eth_wallet_address');
              localStorage.removeItem('wallet_addresses');
              localStorage.removeItem('walletMetadata');
              
              this.walletAddress = undefined;
              this.ethWalletAddress = undefined;
              
              this.presentToast('Wallet data cleared. Please go to registration to create new wallet addresses.', 'success');
            } catch (error) {
              console.error('Error clearing wallet data:', error);
              this.presentToast('Error clearing wallet data', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
}
