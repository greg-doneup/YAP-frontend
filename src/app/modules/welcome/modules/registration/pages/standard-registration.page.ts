import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { RegistrationService, StandardWalletCreationResult, WaitlistUserData } from '../services/registration.service';
import { RegistrationAuthService } from '../services/registration-auth.service';

@Component({
  selector: 'app-standard-registration',
  templateUrl: './standard-registration.page.html',
  styleUrls: ['./standard-registration.page.scss'],
})
export class StandardRegistrationPage {
  email: string = '';
  securePhrase: string = '';
  name: string = '';
  selectedLanguage: string = 'spanish';
  isLoading: boolean = false;
  
  // Waitlist conversion state
  isWaitlistUser: boolean = false;
  waitlistUserData: WaitlistUserData | null = null;
  emailCheckLoading: boolean = false;
  emailChecked: boolean = false;

  constructor(
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private http: HttpClient,
    private registrationService: RegistrationService,
    private authService: RegistrationAuthService
  ) {}

  /** Navigate back to intro */
  goBack() {
    this.router.navigate(['/welcome']);
  }
  
  /** Navigate to waitlist registration */
  navigateToWaitlistRegistration() {
    this.router.navigate(['/welcome/registration/waitlist']);
  }

  /** Check if email exists in waitlist when user finishes typing */
  async onEmailBlur() {
    if (this.email && this.isValidEmail(this.email) && !this.emailChecked) {
      await this.checkWaitlistStatus();
    }
  }

  /** Check if email exists in waitlist */
  async checkWaitlistStatus() {
    if (!this.email || !this.isValidEmail(this.email)) {
      return;
    }

    this.emailCheckLoading = true;
    try {
      this.waitlistUserData = await this.registrationService.checkWaitlistStatus(this.email);
      
      if (this.waitlistUserData) {
        this.isWaitlistUser = true;
        this.name = this.waitlistUserData.name; // Pre-fill name from waitlist
        this.selectedLanguage = this.waitlistUserData.language_to_learn; // Pre-fill language
        console.log('Waitlist user detected:', this.waitlistUserData);
      } else {
        this.isWaitlistUser = false;
        this.waitlistUserData = null;
      }
      
      this.emailChecked = true;
    } catch (error) {
      console.error('Error checking waitlist status:', error);
      // On error, assume standard registration
      this.isWaitlistUser = false;
      this.waitlistUserData = null;
    } finally {
      this.emailCheckLoading = false;
    }
  }

  /** 
   * Unified wallet creation flow
   * Always uses the same endpoint - waitlist conversion is handled automatically
   */
  async createWallet() {
    if (!this.isFormValid()) {
      await this.showAlert('Form Invalid', 'Please fill out all required fields');
      return;
    }

    const loading = await this.loadingController.create({
      message: this.isWaitlistUser ? 'Converting your waitlist account...' : 'Creating your wallet...',
    });
    await loading.present();

    this.isLoading = true;

    try {
      // Always call the unified creation method
      // It will automatically detect and handle waitlist conversion
      const result = await this.registrationService.createWalletWithConversion(
        this.email, 
        this.securePhrase,
        this.name, // For waitlist users, this gets overridden with existing data
        this.selectedLanguage // For waitlist users, this gets overridden with existing data
      );

      if (result.status === 'success') {
        // Store auth tokens if provided
        if (result.token) {
          await this.authService.completeAuthentication(result, this.email);
        }

        // Navigate to dashboard after successful registration
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

  /** Form validation */
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
    
    // For waitlist users, name and language are pre-filled from waitlist data
    if (!this.isWaitlistUser) {
      if (!this.name || !this.selectedLanguage) {
        return false;
      }
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
    this.isWaitlistUser = false;
    this.waitlistUserData = null;
    this.name = ''; // Clear name when email changes
    this.selectedLanguage = 'spanish'; // Reset to default
  }

  /** Handle form submission - alias for createWallet */
  async onSubmit() {
    await this.createWallet();
  }

  /** Handle secure phrase input events */
  onSecurePhraseInput(event: any) {
    // This method can be used for real-time validation feedback
    // For now, just update the model value (which ngModel already handles)
    const value = event.target.value;
    this.securePhrase = value;
    
    // You could add real-time validation here, such as:
    // - Check password strength
    // - Show validation messages
    // - Update UI feedback
  }

  /** Get display text for the submit button */
  getSubmitButtonText(): string {
    if (this.isLoading) {
      return this.isWaitlistUser ? 'Converting Account...' : 'Creating Wallet...';
    }
    return this.isWaitlistUser ? 'Convert Waitlist Account' : 'Create Wallet';
  }

  /** Get helper text for name field */
  getNameHelperText(): string {
    if (this.isWaitlistUser) {
      return `Welcome back, ${this.name}! We'll use your name from the waitlist.`;
    }
    return 'Enter your full name';
  }

  /** Get helper text for language field */
  getLanguageHelperText(): string {
    if (this.isWaitlistUser) {
      return `We'll continue with ${this.selectedLanguage} as selected on the waitlist.`;
    }
    return 'Choose the language you want to learn';
  }
}
