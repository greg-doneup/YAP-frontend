import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { CryptoService } from '../services/crypto-mock.service';
import { RegistrationService } from '../services/registration.service';
import { RegistrationAuthService } from '../services/registration-auth.service';

@Component({
  selector: 'app-waitlist-registration',
  templateUrl: './waitlist-registration.page.html',
  styleUrls: ['./waitlist-registration.page.scss'],
})
export class WaitlistRegistrationPage implements OnInit {
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
    private cryptoService: CryptoService,
    private registrationService: RegistrationService,
    private authService: RegistrationAuthService
  ) {
    this.setupForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      passphrase: ['', [Validators.required, Validators.minLength(12)]],
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
    this.isPerformingAudit = true;
    try {
      this.securityAudit = await this.cryptoService.performSecurityAudit();
      console.log('Security audit completed:', this.securityAudit);
    } catch (error) {
      console.error('Security audit failed:', error);
      this.securityAudit = {
        status: 'warning',
        issues: [{
          level: 'warning',
          description: 'Could not complete security check.'
        }]
      };
    } finally {
      this.isPerformingAudit = false;
    }
  }

  // Navigation back to intro
  goBack() {
    this.router.navigate(['/welcome']);
  }
  
  // Navigate to standard registration
  navigateToStandardRegistration() {
    this.router.navigate(['/welcome/registration/standard']);
  }

  // Toggle password visibility
  togglePassphraseVisibility() {
    this.hidePassphrase = !this.hidePassphrase;
  }

  // Toggle recovery options
  toggleRecoveryOptions() {
    this.showRecoveryOptions = !this.showRecoveryOptions;
  }

  // Get color for passphrase strength indicator
  getStrengthColor(): string {
    if (!this.passphraseValidation) return 'medium';
    
    switch(this.passphraseValidation.strength) {
      case 'weak': return 'danger';
      case 'medium': return 'warning';
      case 'strong': return 'success';
      default: return 'medium';
    }
  }

  // Handle form submission
  async onSubmit() {
    if (this.setupForm.invalid) {
      const toast = await this.toastCtrl.create({
        message: 'Please fix the errors in the form',
        duration: 2000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({
      message: 'Verifying your waitlist status...',
      spinner: 'circular'
    });
    await loading.present();

    try {
      const { email, passphrase, recoveryPhrase } = this.setupForm.value;
      
      const result = await this.registrationService.retrieveWaitlistWallet(
        email, 
        passphrase,
        recoveryPhrase || undefined
      );

      await loading.dismiss();
      this.isLoading = false;
      
      // Show success message with retrieved wallet details
      const alert = await this.alertCtrl.create({
        header: 'Waitlist Access Granted!',
        message: `Welcome back to YAP! Your wallet has been successfully retrieved.
        
        📧 Email: ${email}
        🏦 SEI Address: ${result.sei_address}
        💰 ETH Address: ${result.eth_address}
        🎁 Waitlist Bonus: ${result.waitlist_bonus} points
        
        You're all set to start your language learning journey!`,
        buttons: ['Let\'s Go!']
      });
      
      await alert.present();
      await alert.onDidDismiss();
      
      // Navigate to dashboard after successful retrieval
      await this.authService.completeAuthentication(result, email);
      
      // Add backup authentication flag in localStorage
      localStorage.setItem('user_authenticated', 'true');
      
      // Allow a short delay for auth state to be processed
      setTimeout(() => {
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
      
      let errorMessage = 'We couldn\'t verify your waitlist status. Please try again.';
      
      if (error?.error?.detail) {
        if (error.error.detail === 'Invalid email or passphrase') {
          errorMessage = 'The email or passphrase you entered is incorrect.';
        } else if (error.error.detail === 'Email not found in waitlist') {
          errorMessage = 'Your email was not found in our waitlist. Please check your email address.';
        } else if (error.error.detail === 'Account recovery required') {
          errorMessage = 'Your account requires additional recovery steps. Please use the recovery option.';
          this.showRecoveryOptions = true;
        }
      }
      
      const alert = await this.alertCtrl.create({
        header: 'Verification Failed',
        message: errorMessage,
        buttons: ['Try Again']
      });
      await alert.present();
    }
  }

  getSecurityAuditStatusColor(): string {
    if (!this.securityAudit) return 'medium';
    
    switch(this.securityAudit.status) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'good': return 'success';
      default: return 'medium';
    }
  }
}
