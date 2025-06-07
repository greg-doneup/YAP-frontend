import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-waitlist-login',
  templateUrl: './waitlist-login.page.html',
  styleUrls: ['./waitlist-login.page.scss'],
})
export class WaitlistLoginPage {
  email: string = '';
  securePhrase: string = '';
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private authService: AuthService
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

  /** Handle waitlist login submission */
  async onSubmit() {
    if (!this.isFormValid()) {
      await this.showAlert('Invalid Input', 'Please enter a valid email and secure phrase.');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Authenticating with wallet...',
    });
    await loading.present();

    try {
      // Use the new non-custodial wallet authentication
      console.log('Starting wallet authentication for waitlist user:', this.email);
      
      const authObservable = await this.authService.authenticateWithWallet(this.email, this.securePhrase);
      
      authObservable.subscribe({
        next: async (user) => {
          await loading.dismiss();
          this.isLoading = false;
          
          console.log('Waitlist authentication successful:', user);
          console.log('User wallet addresses:', {
            sei: user.walletAddress,
            evm: user.ethWalletAddress
          });
          
          // Navigate to dashboard after successful authentication
          setTimeout(() => {
            console.log('Navigating to dashboard after successful wallet authentication');
            this.router.navigate(['/dashboard']);
          }, 500);
        },
        error: async (error) => {
          await loading.dismiss();
          this.isLoading = false;
          
          console.error('Waitlist authentication failed:', error);
          await this.showAlert(
            'Authentication Failed', 
            'Could not authenticate your wallet. Please check your email and secure phrase and try again.'
          );
        }
      });
      
    } catch (error) {
      await loading.dismiss();
      this.isLoading = false;
      
      console.error('Wallet authentication error:', error);
      await this.showAlert(
        'Authentication Error', 
        'An error occurred during wallet authentication. Please try again.'
      );
    }
  }

  /** Mock waitlist verification - replace with actual API call */
  private async verifyWaitlistAccess(): Promise<void> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock validation - in real implementation, this would call your backend
    // For now, we'll simulate a successful verification
    const mockWaitlistEmails = ['test@example.com', 'waitlist@yap.com'];
    
    if (!mockWaitlistEmails.includes(this.email.toLowerCase())) {
      throw new Error('Email not found in waitlist');
    }
    
    // In real implementation, verify secure phrase against stored hash
    if (this.securePhrase.length < 4) {
      throw new Error('Invalid secure phrase');
    }
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

  /** Handle secure phrase input - mask characters after typing */
  onSecurePhraseInput(event: any) {
    this.securePhrase = event.target.value;
  }
}
