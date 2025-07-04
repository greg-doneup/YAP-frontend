import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Location } from '@angular/common';

import { RegistrationService } from '../services/registration.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { SecureWalletIntegrationService } from '../../../../../shared/services/secure-wallet-integration.service';
import { CryptoService } from '../../../../../shared/services/crypto.service';

@Component({
  selector: 'app-wallet-recovery',
  templateUrl: './wallet-recovery.page.html',
  styleUrls: ['./wallet-recovery.page.scss'],
})
export class WalletRecoveryPage implements OnInit {
  // Recovery method selection
  recoveryMethod: 'passphrase' | 'phrase' = 'passphrase';

  // Email + Passphrase recovery
  email: string = '';
  passphrase: string = '';
  showPassphrase: boolean = false;

  // Recovery phrase method
  recoveryPhrase: string = '';
  newPassphrase: string = '';
  confirmPassphrase: string = '';
  showNewPassphrase: boolean = false;
  showConfirmPassphrase: boolean = false;

  // UI state
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private location: Location,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private registrationService: RegistrationService,
    private authService: AuthService,
    private secureWalletIntegrationService: SecureWalletIntegrationService,
    private cryptoService: CryptoService
  ) {}

  ngOnInit() {
    console.log('WalletRecoveryPage initialized');
  }

  /** Navigate back to intro */
  goBack() {
    this.location.back();
  }

  /** Navigate to registration options */
  goToRegistration() {
    this.router.navigate(['/welcome/intro']);
  }

  /** Handle recovery method change */
  onRecoveryMethodChange() {
    // Reset form fields when switching methods
    this.resetFormFields();
  }

  /** Reset all form fields */
  private resetFormFields() {
    this.email = '';
    this.passphrase = '';
    this.recoveryPhrase = '';
    this.newPassphrase = '';
    this.confirmPassphrase = '';
    this.showPassphrase = false;
    this.showNewPassphrase = false;
    this.showConfirmPassphrase = false;
  }

  /** Toggle passphrase visibility */
  togglePassphraseVisibility() {
    this.showPassphrase = !this.showPassphrase;
  }

  /** Toggle new passphrase visibility */
  toggleNewPassphraseVisibility() {
    this.showNewPassphrase = !this.showNewPassphrase;
  }

  /** Toggle confirm passphrase visibility */
  toggleConfirmPassphraseVisibility() {
    this.showConfirmPassphrase = !this.showConfirmPassphrase;
  }

  /** Check if passphrase form is valid */
  isPassphraseFormValid(): boolean {
    return this.email.trim().length > 0 && 
           this.isValidEmail(this.email) && 
           this.passphrase.trim().length >= 8;
  }

  /** Check if recovery phrase form is valid */
  isPhraseFormValid(): boolean {
    const words = this.recoveryPhrase.trim().split(/\s+/).filter(word => word.length > 0);
    const hasValidPhrase = words.length === 12 || words.length === 24;
    const hasValidNewPassphrase = this.newPassphrase.length >= 8;
    const passphrasesMatch = this.newPassphrase === this.confirmPassphrase;
    
    return hasValidPhrase && hasValidNewPassphrase && passphrasesMatch;
  }

  /** Validate email format */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /** Handle email blur event */
  async onEmailBlur() {
    if (this.email && this.isValidEmail(this.email)) {
      console.log('Valid email entered:', this.email);
    }
  }

  /** Get loading text based on recovery method */
  getLoadingText(): string {
    if (this.recoveryMethod === 'passphrase') {
      return 'Recovering Wallet...';
    } else {
      return 'Restoring Wallet...';
    }
  }

  /** Recover wallet using email and passphrase */
  async recoverWithPassphrase() {
    if (!this.isPassphraseFormValid()) {
      await this.showAlert('Form Invalid', 'Please enter a valid email and passphrase (minimum 8 characters)');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Recovering your wallet...',
    });
    await loading.present();

    this.isLoading = true;

    try {
      console.log('🔑 Starting wallet recovery with passphrase for:', this.email);

      // Use the secure wallet integration service for unified recovery
      const result = await this.secureWalletIntegrationService.recoverWallet(
        this.email,
        this.passphrase,
        {
          useSecureArchitecture: true,
          fallbackToLegacy: true,
          storeLocally: true
        }
      );

      if (result.success && result.walletData) {
        console.log('✅ Wallet recovery successful');

        // Show success message
        await this.showSuccessToast('Wallet recovered successfully!');

        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
      } else {
        await this.showAlert('Recovery Failed', result.message || 'Failed to recover wallet. Please check your credentials.');
      }
    } catch (error: any) {
      console.error('❌ Wallet recovery failed:', error);
      
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error.message) {
        if (error.message.includes('Invalid passphrase')) {
          errorMessage = 'Invalid passphrase. Please check your credentials and try again.';
        } else if (error.message.includes('No account found')) {
          errorMessage = 'No account found with this email address.';
        } else if (error.message.includes('No secure wallet')) {
          errorMessage = 'No wallet found for this account. You may need to create a new wallet.';
        } else {
          errorMessage = error.message;
        }
      }
      
      await this.showAlert('Recovery Error', errorMessage);
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  /** Recover wallet using recovery phrase */
  async recoverWithPhrase() {
    if (!this.isPhraseFormValid()) {
      await this.showAlert('Form Invalid', 'Please enter a valid 12 or 24-word recovery phrase and matching passphrases.');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Restoring your wallet...',
    });
    await loading.present();

    this.isLoading = true;

    try {
      console.log('🔑 Starting emergency wallet recovery with recovery phrase');

      // Use email if provided, otherwise use a default for emergency recovery
      const recoveryEmail = this.email || 'emergency-recovery@yap.local';

      // Use the crypto service for emergency recovery
      const result = await this.cryptoService.emergencyRecovery(
        recoveryEmail,
        this.recoveryPhrase.trim(),
        this.newPassphrase
      );

      if (result.success) {
        console.log('✅ Emergency wallet recovery successful');

        // Show success message
        await this.showSuccessToast('Wallet restored successfully with new passphrase!');

        // Navigate to registration to complete account setup
        this.router.navigate(['/welcome/registration/standard'], {
          queryParams: {
            recovery: 'true',
            seiAddress: result.addresses.sei_address,
            ethAddress: result.addresses.eth_address
          }
        });
      } else {
        await this.showAlert('Recovery Failed', result.message || 'Failed to restore wallet from recovery phrase.');
      }
    } catch (error: any) {
      console.error('❌ Emergency wallet recovery failed:', error);
      
      let errorMessage = 'Failed to restore wallet from recovery phrase.';
      
      if (error.message) {
        if (error.message.includes('Invalid recovery phrase')) {
          errorMessage = 'Invalid recovery phrase. Please check the words and try again.';
        } else if (error.message.includes('Weak passphrase')) {
          errorMessage = 'Please choose a stronger passphrase (at least 8 characters with mixed case, numbers, and symbols).';
        } else {
          errorMessage = error.message;
        }
      }
      
      await this.showAlert('Recovery Error', errorMessage);
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  /** Show recovery help modal */
  async showRecoveryHelp() {
    const alert = await this.alertController.create({
      header: 'Wallet Recovery Help',
      message: `
        <div style="text-align: left;">
          <p><strong>Email + Passphrase Recovery:</strong></p>
          <ul>
            <li>Use the email and passphrase you created when setting up your wallet</li>
            <li>This is the most secure method if you remember your credentials</li>
          </ul>
          
          <p><strong>Recovery Phrase Method:</strong></p>
          <ul>
            <li>Use your 12 or 24-word recovery phrase (seed phrase)</li>
            <li>This will restore your wallet but require setting a new passphrase</li>
            <li>Enter each word separated by spaces</li>
          </ul>
          
          <p><strong>Need more help?</strong></p>
          <p>Contact our support team at <a href="mailto:support@yap.com">support@yap.com</a></p>
        </div>
      `,
      buttons: ['Got it']
    });

    await alert.present();
  }

  /** Show alert dialog */
  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  /** Show success toast */
  private async showSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();
  }
}
