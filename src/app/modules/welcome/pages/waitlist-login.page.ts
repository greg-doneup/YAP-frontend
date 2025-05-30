import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';

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
    private alertController: AlertController
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
      message: 'Verifying waitlist access...',
    });
    await loading.present();

    try {
      // TODO: Implement actual waitlist verification API call
      await this.verifyWaitlistAccess();
      
      await loading.dismiss();
      this.isLoading = false;
      
      // Navigate to main app or specific waitlist user flow
      this.router.navigate(['/home']); // Adjust as needed
      
    } catch (error) {
      await loading.dismiss();
      this.isLoading = false;
      
      await this.showAlert(
        'Verification Failed', 
        'We couldn\'t verify your waitlist access. Please check your email and secure phrase and try again.'
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
