import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { RegistrationService, StandardWalletCreationResult } from '../services/registration.service';
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
  isLoading: boolean = false;

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

  /** Validate form inputs */
  isFormValid(): boolean {
    return this.email.trim() !== '' && 
           this.securePhrase.trim() !== '' &&
           this.name.trim() !== '' &&
           this.isValidEmail(this.email);
  }

  /** Basic email validation */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /** Handle standard account creation */
  async onSubmit() {
    if (!this.isFormValid()) {
      await this.showAlert('Invalid Input', 'Please fill in all fields with valid information.');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Creating your account...',
    });
    await loading.present();

    try {
      // Create wallet for standard user
      const result = await this.registrationService.createStandardWallet(
        this.email, 
        this.securePhrase,
        this.name
      );
      
      await loading.dismiss();
      this.isLoading = false;
      
      // Show success message with wallet details
      await this.showAccountCreatedAlert(result);
      
      // Complete authentication using the registration auth service
      await this.authService.completeAuthentication(result, this.email);
      
      // Wait longer to ensure authentication state is fully set before navigation
      console.log('Standard registration successful, preparing for dashboard navigation');
      
      // Add backup authentication flag in localStorage
      localStorage.setItem('user_authenticated', 'true');
      
      setTimeout(() => {
        console.log('Navigating to dashboard after successful account creation');
        
        // Try router navigation first
        this.router.navigate(['/dashboard']).then(success => {
          if (!success) {
            console.log('Router navigation failed, trying direct location change');
            // If router navigation fails, force navigation
            window.location.href = '/dashboard';
          }
        });
      }, 1500);
      
    } catch (error: any) {
      await loading.dismiss();
      this.isLoading = false;
      
      let errorMessage = 'We couldn\'t create your account. Please try again or contact support.';
      
      if (error?.error?.detail) {
        if (error.error.detail === 'Email already registered') {
          errorMessage = 'This email is already registered. Please use the login option instead.';
        }
      }
      
      await this.showAlert('Account Creation Failed', errorMessage);
    }
  }

  /** Show account created alert with details */
  private async showAccountCreatedAlert(result: StandardWalletCreationResult) {
    const message = `🎉 Welcome to YAP! Your account has been created successfully!
    
📧 Email: ${this.email}
✨ Name: ${this.name}
🏦 SEI Address: ${result.sei_address}
💰 ETH Address: ${result.eth_address}

Your recovery phrase is securely encrypted and stored. Keep your passphrase safe!`;
    
    const alert = await this.alertController.create({
      header: 'Account Created!',
      message,
      buttons: ['Continue']
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

  /** Handle secure phrase input */
  onSecurePhraseInput(event: any) {
    this.securePhrase = event.target.value;
  }
}
