import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { WalletService, WalletCreationResult } from '../../../services/wallet.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-waitlist-signup',
  templateUrl: './waitlist-signup.page.html',
  styleUrls: ['./waitlist-signup.page.scss'],
})
export class WaitlistSignupPage {
  email: string = '';
  securePhrase: string = '';
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private walletService: WalletService,
    private http: HttpClient
  ) {}

  /** Navigate back to intro */
  goBack() {
    this.router.navigate(['/welcome']);
  }

  /** Validate form inputs */
  isFormValid(): boolean {
    return this.email.trim() !== '' && 
           this.securePhrase.trim() !== '' &&
           this.isValidEmail(this.email);
  }

  /** Basic email validation */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /** Handle waitlist account creation */
  async onSubmit() {
    if (!this.isFormValid()) {
      await this.showAlert('Invalid Input', 'Please fill in all fields with valid information.');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Creating your wallet...',
    });
    await loading.present();

    try {
      // Create wallet through backend
      const result = await this.walletService.createWaitlistWallet(
        this.email, 
        this.securePhrase
      );
      
      await loading.dismiss();
      this.isLoading = false;
      
      // Show success message with wallet details
      await this.showWalletCreatedAlert(result);
      
      // Wait longer to ensure authentication state is fully set before navigation
      console.log('Waitlist signup successful, preparing for dashboard navigation');
      setTimeout(() => {
        console.log('Navigating to dashboard after successful wallet creation');
        this.router.navigate(['/dashboard']);
      }, 1000);
      
    } catch (error: any) {
      await loading.dismiss();
      this.isLoading = false;
      
      let errorMessage = 'We couldn\'t create your wallet. Please try again or contact support.';
      
      if (error?.error?.detail) {
        if (error.error.detail === 'Email not found in database') {
          errorMessage = 'Your email was not found in our waitlist. Please check your email address.';
        } else if (error.error.detail === 'User already has a wallet') {
          errorMessage = 'You already have a wallet created. Please use the login option instead.';
        }
      }
      
      await this.showAlert('Wallet Creation Failed', errorMessage);
    }
  }

  /** Show wallet created alert with details */
  private async showWalletCreatedAlert(result: WalletCreationResult) {
    const message = `🎉 Welcome to YAP! Your wallet has been created successfully!
    
📧 Email: ${this.email}
🏦 SEI Address: ${result.sei_address}
💰 ETH Address: ${result.eth_address}
🎁 Waitlist Bonus: ${result.waitlist_bonus} tokens

Your recovery phrase is securely encrypted and stored. Keep your passphrase safe!`;
    
    const alert = await this.alertController.create({
      header: 'Wallet Created!',
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
