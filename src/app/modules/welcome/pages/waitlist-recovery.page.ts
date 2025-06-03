import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { WalletService } from '../../../shared/services/wallet.service';
import { CryptoService } from '../../../shared/services/crypto.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-waitlist-recovery',
  templateUrl: './waitlist-recovery.page.html',
  styleUrls: ['./waitlist-recovery.page.scss'],
})
export class WaitlistRecoveryPage implements OnInit {
  setupForm: FormGroup;
  isLoading = false;
  hidePassphrase = true;
  passphraseValidation: any = null;
  securityAudit: any = null;
  showRecoveryOptions = false;
  isPerformingAudit = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private walletService: WalletService,
    private cryptoService: CryptoService,
    private authService: AuthService
  ) {
    this.setupForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      passphrase: ['', [Validators.required, Validators.minLength(12)]], // Updated to 12 chars minimum
      recoveryPhrase: [''] // For emergency recovery
    });
  }

  ngOnInit() {
    // Listen for passphrase changes to provide real-time validation
    this.setupForm.get('passphrase')?.valueChanges.subscribe(passphrase => {
      if (passphrase && passphrase.length > 0) {
        this.passphraseValidation = this.cryptoService.validatePassphraseStrength(passphrase);
      } else {
        this.passphraseValidation = null;
      }
    });

    // Perform security audit when component loads
    this.performSecurityAuditCheck();
  }

  async performSecurityAuditCheck() {
    try {
      this.isPerformingAudit = true;
      this.securityAudit = await this.cryptoService.performSecurityAudit();
    } catch (error) {
      console.warn('Security audit failed:', error);
    } finally {
      this.isPerformingAudit = false;
    }
  }

  onPassphraseInput() {
    const passphrase = this.setupForm.get('passphrase')?.value;
    if (passphrase) {
      this.passphraseValidation = this.cryptoService.validatePassphraseStrength(passphrase);
    }
  }

  toggleRecoveryOptions() {
    this.showRecoveryOptions = !this.showRecoveryOptions;
  }

  async performEmergencyRecovery() {
    const email = this.setupForm.get('email')?.value;
    const recoveryPhrase = this.setupForm.get('recoveryPhrase')?.value;
    const newPassphrase = this.setupForm.get('passphrase')?.value;

    if (!email || !recoveryPhrase || !newPassphrase) {
      await this.showAlert('Missing Information', 'Please fill in all required fields for emergency recovery.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Performing emergency recovery...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const result = await this.cryptoService.emergencyRecovery(email, recoveryPhrase, newPassphrase);
      
      if (result.success) {
        await loading.dismiss();
        await this.showSuccessToast('Emergency recovery completed successfully!');
        this.router.navigate(['/dashboard']);
      } else {
        await loading.dismiss();
        await this.showAlert('Recovery Failed', result.message || 'Emergency recovery failed. Please verify your recovery phrase.');
      }
    } catch (error: any) {
      await loading.dismiss();
      await this.showAlert('Recovery Error', 'An error occurred during emergency recovery. Please try again.');
    }
  }

  async onSubmit() {
    if (this.setupForm.valid) {
      await this.completeSetup();
    }
  }

  private async completeSetup() {
    const loading = await this.loadingCtrl.create({
      message: 'Setting up your account...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      this.isLoading = true;
      const { email, passphrase } = this.setupForm.value;

      // Step 1: Enhanced passphrase validation
      const validation = this.cryptoService.validatePassphraseStrength(passphrase);
      if (!validation.isValid || validation.score < 4) { // Require minimum score of 4/7
        await loading.dismiss();
        await this.showAlert('Passphrase Too Weak', 
          `Please use a stronger passphrase (Score: ${validation.score}/7):\n` + validation.feedback.join('\n'));
        return;
      }

      // Step 2: Check if user exists on waitlist
      const userProfile = await this.walletService.getUserProfile(email);
      if (!userProfile) {
        await loading.dismiss();
        await this.showAlert('Email Not Found', 
          'This email was not found in our waitlist. Please check your email address or contact support.');
        return;
      }

      // Step 3: Check if user already completed setup
      if (userProfile.encrypted_mnemonic) {
        await loading.dismiss();
        await this.showAlert('Account Already Setup', 
          'Your account has already been set up. Please use the login option instead.');
        return;
      }

      // Step 4: Generate new mnemonic and derive wallets for first-time setup
      const mnemonic = await this.cryptoService.generateMnemonic();
      const wallets = await this.cryptoService.deriveWalletsFromMnemonic(mnemonic);

      const walletData = {
        mnemonic,
        seiWallet: wallets.seiWallet,
        evmWallet: wallets.evmWallet
      };

      // Step 5: Encrypt the mnemonic for server storage
      const encryptedData = await this.cryptoService.encryptMnemonic(mnemonic, passphrase);

      // Step 6: Complete setup on server with encrypted wallet data
      await this.walletService.storeWalletData({
        email,
        passphrase,
        encrypted_mnemonic: encryptedData.encryptedMnemonic,
        salt: encryptedData.salt,
        nonce: encryptedData.nonce,
        sei_address: wallets.seiWallet.address,
        sei_public_key: wallets.seiWallet.publicKey,
        eth_address: wallets.evmWallet.address,
        eth_public_key: wallets.evmWallet.publicKey
      });

      // Step 7: Store wallet data securely in local IndexedDB
      await this.cryptoService.storeWalletSecurely(email, walletData, passphrase);

      // Step 8: Create initial secure backup
      try {
        await this.cryptoService.createBackupWithRateLimit(email, passphrase);
        console.log('Initial backup created successfully');
      } catch (backupError) {
        console.warn('Failed to create initial backup:', backupError);
        // Don't fail the setup process if backup creation fails
      }      // Step 9: Authenticate the user to enable dashboard access
      try {
        // Call the auth service to authenticate with the newly created wallet
        const authenticatedUser = await this.authService.authenticateWithWallet({
          email,
          passphrase,
          walletAddress: wallets.seiWallet.address,
          ethWalletAddress: wallets.evmWallet.address
        }).toPromise();
        
        console.log('User authenticated successfully after wallet setup:', authenticatedUser);

        await loading.dismiss();
        await this.showSuccessToast('Account setup completed! Welcome to YAP!');
        
        // Wait longer to ensure authentication state is fully set before navigation
        // Increased timeout to 1000ms to ensure auth state has time to propagate
        setTimeout(() => {
          console.log('Auth service isLoggedIn state:', this.authService.isLoggedIn);
          console.log('Auth service current user:', this.authService.currentUserValue);
          console.log('Navigating to dashboard after successful authentication');
          this.router.navigate(['/dashboard']);
        }, 1000);
        
      } catch (authError) {
        console.warn('Authentication failed after wallet setup, but wallet was created successfully:', authError);
        
        await loading.dismiss();
        await this.showSuccessToast('Wallet created successfully! Please log in to access your account.');
        
        // Navigate back to welcome page if authentication fails
        this.router.navigate(['/welcome']);
      }

    } catch (error: any) {
      await loading.dismiss();
      console.error('Account setup error:', error);
      
      let errorMessage = 'Failed to set up your account. Please try again.';
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await this.showAlert('Setup Failed', errorMessage);
    } finally {
      this.isLoading = false;
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
    this.router.navigate(['/welcome']);
  }

  // Security utility methods
  getSecurityScoreColor(): string {
    if (!this.securityAudit) return 'medium';
    const score = this.securityAudit.score;
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  }

  getPassphraseStrengthColor(): string {
    if (!this.passphraseValidation) return 'medium';
    const score = this.passphraseValidation.score;
    if (score >= 6) return 'success';
    if (score >= 4) return 'warning';
    return 'danger';
  }

  getPassphraseStrengthText(): string {
    if (!this.passphraseValidation) return '';
    const score = this.passphraseValidation.score;
    if (score >= 6) return 'Strong';
    if (score >= 4) return 'Moderate';
    if (score >= 2) return 'Weak';
    return 'Very Weak';
  }
}
