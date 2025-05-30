import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { WalletService } from '../../../shared/services/wallet.service';
import { CryptoService } from '../../../shared/services/crypto.service';

@Component({
  selector: 'app-waitlist-recovery',
  templateUrl: './waitlist-recovery.page.html',
  styleUrls: ['./waitlist-recovery.page.scss'],
})
export class WaitlistRecoveryPage implements OnInit {
  recoveryForm: FormGroup;
  isLoading = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private walletService: WalletService,
    private cryptoService: CryptoService
  ) {
    this.recoveryForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      passphrase: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit() {}

  async onSubmit() {
    if (this.recoveryForm.valid) {
      await this.recoverWallet();
    }
  }

  private async recoverWallet() {
    const loading = await this.loadingCtrl.create({
      message: 'Recovering your wallet...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      this.isLoading = true;
      const { email, passphrase } = this.recoveryForm.value;

      // Step 1: Validate passphrase strength
      const validation = this.cryptoService.validatePassphraseStrength(passphrase);
      if (!validation.isValid) {
        await loading.dismiss();
        await this.showAlert('Weak Passphrase', 
          'Please use a stronger passphrase:\n' + validation.feedback.join('\n'));
        return;
      }

      // Step 2: Check if we have locally stored encrypted wallet (offline-first)
      const hasLocalWallet = await this.cryptoService.hasStoredWallet(email);
      
      if (hasLocalWallet) {
        // Try to decrypt local wallet first
        try {
          const walletData = await this.cryptoService.loadWalletSecurely(email, passphrase);
          if (walletData) {
            await loading.dismiss();
            await this.showSuccessToast('Wallet recovered from secure local storage!');
            
            // Navigate to main app
            this.router.navigate(['/dashboard']);
            return;
          }
        } catch (error) {
          console.warn('Local wallet decryption failed, trying server recovery:', error);
        }
      }

      // Step 3: Check if user exists on server
      const userProfile = await this.walletService.getUserProfile(email);
      if (!userProfile) {
        await loading.dismiss();
        await this.showAlert('User Not Found', 
          'No account found with this email address. Please check your email or sign up first.');
        return;
      }

      // Step 4: Check if user has wallet data on server
      if (!userProfile.encrypted_mnemonic) {
        // User exists but hasn't set up wallet yet
        await loading.dismiss();
        await this.createWalletForWaitlistUser(email, passphrase);
        return;
      }

      // Step 5: Try server-based recovery using the new two-layer security model
      try {
        const recoveryResult = await this.walletService.recoverWallet(email, passphrase);
        
        if (recoveryResult && recoveryResult.success) {
          // Server authenticated the passphrase and returned encrypted wallet data
          // Now decrypt it client-side using the same passphrase
          const encryptedWalletData = recoveryResult.encrypted_wallet_data;
          
          if (encryptedWalletData && encryptedWalletData.encrypted_mnemonic) {
            const decryptedMnemonic = await this.cryptoService.decryptMnemonic(
              encryptedWalletData.encrypted_mnemonic,
              passphrase,
              encryptedWalletData.salt,
              encryptedWalletData.nonce
            );

            const wallets = await this.cryptoService.deriveWalletsFromMnemonic(decryptedMnemonic);
            
            const walletData = {
              mnemonic: decryptedMnemonic,
              seiWallet: wallets.seiWallet,
              evmWallet: wallets.evmWallet
            };

            // Store the recovered wallet securely in local IndexedDB
            await this.cryptoService.storeWalletSecurely(email, walletData, passphrase);

            await loading.dismiss();
            await this.showSuccessToast('Wallet recovered successfully!');
            
            // Navigate to main app
            this.router.navigate(['/dashboard']);
            return;
          } else {
            throw new Error('No encrypted wallet data returned from server');
          }
        } else {
          throw new Error('Server authentication failed');
        }

      } catch (serverError: any) {
        // Handle specific error cases from the two-layer security model
        if (serverError.error === 'setup_required' || serverError.setup_required) {
          // User needs to setup secure account first
          await loading.dismiss();
          await this.setupSecureAccount(email, passphrase);
          return;
        }
        
        if (serverError.error === 'invalid_passphrase') {
          await loading.dismiss();
          await this.showAlert('Invalid Passphrase', 
            'The passphrase you entered is incorrect. Please try again.');
          return;
        }
        
        // If server recovery fails, try client-side decryption as fallback
        console.warn('Server recovery failed, trying client-side decryption:', serverError);
        
        try {
          if (userProfile.encrypted_mnemonic && userProfile.salt && userProfile.nonce) {
            const decryptedMnemonic = await this.cryptoService.decryptMnemonic(
              userProfile.encrypted_mnemonic,
              passphrase,
              userProfile.salt,
              userProfile.nonce
            );

            const wallets = await this.cryptoService.deriveWalletsFromMnemonic(decryptedMnemonic);
            
            const walletData = {
              mnemonic: decryptedMnemonic,
              seiWallet: wallets.seiWallet,
              evmWallet: wallets.evmWallet
            };

            await this.cryptoService.storeWalletSecurely(email, walletData, passphrase);

            await loading.dismiss();
            await this.showSuccessToast('Wallet recovered successfully!');
            
            this.router.navigate(['/dashboard']);
          } else {
            throw new Error('Incomplete wallet data on server');
          }
        } catch (clientError) {
          await loading.dismiss();
          await this.showAlert('Invalid Passphrase', 
            'The passphrase you entered is incorrect. Please try again.');
        }
      }

    } catch (error: any) {
      await loading.dismiss();
      console.error('Recovery error:', error);
      
      await this.showAlert('Recovery Failed', 
        error.message || 'An unexpected error occurred during wallet recovery. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  private async setupSecureAccount(email: string, passphrase: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Setting up your secure account...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Step 1: Generate new mnemonic and derive wallets
      const mnemonic = await this.cryptoService.generateMnemonic();
      const wallets = await this.cryptoService.deriveWalletsFromMnemonic(mnemonic);

      const walletData = {
        mnemonic,
        seiWallet: wallets.seiWallet,
        evmWallet: wallets.evmWallet
      };

      // Step 2: Encrypt the wallet data using the passphrase (client-side encryption)
      const encryptedData = await this.cryptoService.encryptMnemonic(mnemonic, passphrase);

      // Step 3: Setup secure account on server using two-layer security
      await this.walletService.setupSecureAccount(email, passphrase, {
        encrypted_mnemonic: encryptedData.encryptedMnemonic,
        salt: encryptedData.salt,
        nonce: encryptedData.nonce
      });

      // Step 4: Store wallet data securely in local IndexedDB
      await this.cryptoService.storeWalletSecurely(email, walletData, passphrase);

      await loading.dismiss();
      await this.showSuccessToast('Secure account setup completed! Welcome to YAP!');
      
      // Navigate to main app
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      await loading.dismiss();
      console.error('Secure account setup error:', error);
      
      if (error.error === 'already_secured') {
        await this.showAlert('Account Already Secured', 
          'Your account is already set up. Please use the recovery option.');
      } else {
        await this.showAlert('Setup Failed', 
          error.message || 'Failed to set up your secure account. Please try again.');
      }
    }
  }

  private async createWalletForWaitlistUser(email: string, passphrase: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Setting up your wallet...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Step 1: Generate new mnemonic and derive wallets
      const mnemonic = await this.cryptoService.generateMnemonic();
      const wallets = await this.cryptoService.deriveWalletsFromMnemonic(mnemonic);

      const walletData = {
        mnemonic,
        seiWallet: wallets.seiWallet,
        evmWallet: wallets.evmWallet
      };

      // Step 2: Encrypt the mnemonic for server storage
      const encryptedData = await this.cryptoService.encryptMnemonic(mnemonic, passphrase);

      // Step 3: Register wallet on server using the correct method signature
      await this.walletService.registerWallet(
        email,
        passphrase,
        encryptedData.encryptedMnemonic,
        encryptedData.salt,
        encryptedData.nonce
      );

      // Step 4: Store wallet data securely in local IndexedDB
      await this.cryptoService.storeWalletSecurely(email, walletData, passphrase);

      await loading.dismiss();
      await this.showSuccessToast('Wallet created successfully! Welcome to YAP!');
      
      // Navigate to main app
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      await loading.dismiss();
      console.error('Wallet creation error:', error);
      await this.showAlert('Setup Failed', 
        error.message || 'Failed to set up your wallet. Please try again.');
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showSuccessToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
  }

  goBack() {
    this.router.navigate(['/welcome/intro']);
  }
}
