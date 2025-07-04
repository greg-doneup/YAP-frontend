import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { RegistrationService, StandardWalletCreationResult, WaitlistUserData } from '../services/registration.service';
import { RegistrationAuthService } from '../services/registration-auth.service';
import { SecureWalletRegistrationService } from '../../../../../services/secure-wallet-registration.service';

@Component({
  selector: 'app-waitlist-registration',
  templateUrl: './waitlist-registration.page.html',
  styleUrls: ['./waitlist-registration.page.scss'],
})
export class WaitlistRegistrationPage {
  email: string = '';
  securePhrase: string = '';
  isLoading: boolean = false;
  
  // Database lookup state - auto-filled from database
  databaseUserData: WaitlistUserData | null = null;
  emailCheckLoading: boolean = false;
  emailChecked: boolean = false;
  userDataFound: boolean = false;

  constructor(
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private http: HttpClient,
    private registrationService: RegistrationService,
    private authService: RegistrationAuthService,
    private secureWalletService: SecureWalletRegistrationService
  ) {}

  /** Navigate back to intro */
  goBack() {
    this.router.navigate(['/welcome']);
  }
  
  /** Navigate to standard registration */
  navigateToStandardRegistration() {
    this.router.navigate(['/welcome/registration/standard']);
  }

  /** Check if email exists in database when user finishes typing */
  async onEmailBlur() {
    if (this.email && this.isValidEmail(this.email) && !this.emailChecked) {
      await this.checkDatabaseForUser();
    }
  }

  /** Check if email exists in database and extract user data */
  async checkDatabaseForUser() {
    if (!this.email || !this.isValidEmail(this.email)) {
      return;
    }

    this.emailCheckLoading = true;
    try {
      this.databaseUserData = await this.registrationService.checkWaitlistStatus(this.email);
      
      if (this.databaseUserData) {
        this.userDataFound = true;
        console.log('Database user detected:', this.databaseUserData);
      } else {
        this.userDataFound = false;
        this.databaseUserData = null;
      }
      
      this.emailChecked = true;
    } catch (error) {
      console.error('Error checking database for user:', error);
      // On error, assume no existing user data
      this.userDataFound = false;
      this.databaseUserData = null;
    } finally {
      this.emailCheckLoading = false;
    }
  }

  /** 
   * Unified wallet creation flow - uses same endpoint as standard registration
   * Database lookup provides name, language_to_learn, and userId automatically
   */
  async createWallet() {
    if (!this.isFormValid()) {
      await this.showAlert('Form Invalid', 'Please fill out all required fields');
      return;
    }

    const loading = await this.loadingController.create({
      message: this.userDataFound ? 'Converting your account...' : 'Creating your wallet...',
    });
    await loading.present();

    this.isLoading = true;

    try {
      // Ensure we have required data for registration
      if (!this.databaseUserData?.name || !this.databaseUserData?.language_to_learn) {
        throw new Error('Name and language to learn are required for registration');
      }

      // Use secure wallet creation service instead of legacy method
      const result = await this.secureWalletService.createSecureWallet(
        this.email,
        this.securePhrase,
        this.databaseUserData.name, // Auto-filled from database
        this.databaseUserData.language_to_learn // Auto-filled from database
      );

      if (result.success) {
        // Convert SecureRegistrationResponse to StandardWalletCreationResult format
        const standardResult = {
          status: 'success' as const,
          sei_address: result.walletAddress || '',
          eth_address: result.ethWalletAddress || '',
          waitlist_bonus: result.starting_points || 0,
          message: result.message || 'Account converted successfully',
          starting_points: result.starting_points || 0,
          token: result.token,
          refreshToken: result.refreshToken,
          userId: result.userId,
          isWaitlistConversion: result.isWaitlistConversion || true,
          walletAddress: result.walletAddress,
          ethWalletAddress: result.ethWalletAddress,
          encryptedMnemonic: result.encryptedMnemonic
        };

        // Use the registration auth service to complete authentication properly
        await this.authService.completeAuthentication(standardResult, this.email);

        // Small delay to ensure authentication state is fully updated
        await new Promise(resolve => setTimeout(resolve, 100));

        // Navigate to dashboard after successful authentication
        console.log('✅ Waitlist conversion and authentication completed, navigating to dashboard');
        this.router.navigate(['/dashboard']);
      } else {
        await this.showAlert('Registration Failed', result.message || 'Failed to create wallet');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      }
      
      await this.showAlert('Registration Error', errorMessage);
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  /** Form validation - only email and passphrase required */
  isFormValid(): boolean {
    if (!this.email || !this.securePhrase) {
      return false;
    }
    
    if (!this.isValidEmail(this.email)) {
      return false;
    }
    
    if (this.securePhrase.length < 8) {
      return false;
    }
    
    return true;
  }

  /** Email validation */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  /** Reset email check when email changes */
  onEmailChange() {
    this.emailChecked = false;
    this.userDataFound = false;
    this.databaseUserData = null;
  }

  /** Handle form submission - alias for createWallet */
  async onSubmit() {
    await this.createWallet();
  }

  /** Handle secure phrase input events */
  onSecurePhraseInput(event: any) {
    const value = event.target.value;
    this.securePhrase = value;
  }

  /** Get passphrase strength indicator */
  getPassphraseStrength(): { score: number; feedback: string; color: string } {
    if (!this.securePhrase) {
      return { score: 0, feedback: '', color: 'medium' };
    }

    let score = 0;
    let feedback = [];

    // Length check
    if (this.securePhrase.length >= 8) score += 1;
    if (this.securePhrase.length >= 12) score += 1;
    if (this.securePhrase.length >= 16) score += 1;

    // Character variety checks
    if (/[a-z]/.test(this.securePhrase)) score += 1;
    if (/[A-Z]/.test(this.securePhrase)) score += 1;
    if (/[0-9]/.test(this.securePhrase)) score += 1;
    if (/[^A-Za-z0-9]/.test(this.securePhrase)) score += 1;

    // Generate feedback
    if (this.securePhrase.length < 8) feedback.push('Use at least 8 characters');
    if (!/[a-z]/.test(this.securePhrase)) feedback.push('Add lowercase letters');
    if (!/[A-Z]/.test(this.securePhrase)) feedback.push('Add uppercase letters');
    if (!/[0-9]/.test(this.securePhrase)) feedback.push('Add numbers');
    if (!/[^A-Za-z0-9]/.test(this.securePhrase)) feedback.push('Add symbols');

    let color = 'danger';
    let strengthText = 'Weak';

    if (score >= 4) {
      color = 'warning';
      strengthText = 'Medium';
    }
    if (score >= 6) {
      color = 'success';
      strengthText = 'Strong';
    }

    return {
      score: Math.min(score, 7),
      feedback: feedback.length > 0 ? feedback.join(', ') : `${strengthText} passphrase`,
      color
    };
  }

  /** Get display text for the submit button */
  getSubmitButtonText(): string {
    if (this.isLoading) {
      return this.userDataFound ? 'Converting Account...' : 'Creating Wallet...';
    }
    return this.userDataFound ? 'Convert Account' : 'Create Wallet';
  }

  /** Get user info display text */
  getUserInfoText(): string {
    if (this.userDataFound && this.databaseUserData) {
      return `Welcome back, ${this.databaseUserData.name}! We'll use your saved information (${this.databaseUserData.language_to_learn}).`;
    }
    return '';
  }
}