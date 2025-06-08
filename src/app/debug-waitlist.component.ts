import { Component } from '@angular/core';
import { RegistrationService } from './modules/welcome/modules/registration/services/registration.service';
import { RegistrationAuthService } from './modules/welcome/modules/registration/services/registration-auth.service';

@Component({
  selector: 'app-debug-waitlist',
  template: `
    <ion-content class="ion-padding">
      <h2>Waitlist Conversion Debug Page</h2>
      
      <ion-card>
        <ion-card-header>
          <ion-card-title>Test Controls</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Email</ion-label>
            <ion-input [(ngModel)]="email" placeholder="waitlist@example.com"></ion-input>
          </ion-item>
          
          <ion-item>
            <ion-label position="stacked">Passphrase</ion-label>
            <ion-input [(ngModel)]="passphrase" type="password" placeholder="password"></ion-input>
          </ion-item>
          
          <ion-button expand="block" (click)="testWaitlistCheck()" [disabled]="loading">
            1. Check Waitlist Status
          </ion-button>
          
          <ion-button expand="block" (click)="testWalletCreation()" [disabled]="loading" color="secondary">
            2. Test Wallet Creation
          </ion-button>
          
          <ion-button expand="block" (click)="clearLogs()" color="tertiary">
            Clear Logs
          </ion-button>
        </ion-card-content>
      </ion-card>
      
      <ion-card>
        <ion-card-header>
          <ion-card-title>Debug Output</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="debug-log">
            <div *ngFor="let log of debugLogs" [class]="'log-' + log.type">
              <strong>{{ log.timestamp }}</strong> [{{ log.type.toUpperCase() }}]: {{ log.message }}
              <pre *ngIf="log.data">{{ log.data }}</pre>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: [`
    .debug-log {
      font-family: monospace;
      font-size: 12px;
      max-height: 400px;
      overflow-y: auto;
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
    }
    .log-info { color: #007bff; }
    .log-success { color: #28a745; }
    .log-error { color: #dc3545; }
    .log-warning { color: #ffc107; }
    pre {
      white-space: pre-wrap;
      margin: 5px 0;
      background: #e9ecef;
      padding: 5px;
      border-radius: 3px;
    }
  `]
})
export class DebugWaitlistComponent {
  email = 'waitlist@example.com';
  passphrase = 'testpassword123';
  loading = false;
  debugLogs: any[] = [];

  constructor(
    private registrationService: RegistrationService,
    private authService: RegistrationAuthService
  ) {}

  log(type: string, message: string, data?: any) {
    this.debugLogs.push({
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data: data ? JSON.stringify(data, null, 2) : null
    });
  }

  clearLogs() {
    this.debugLogs = [];
  }

  async testWaitlistCheck() {
    this.log('info', 'Starting waitlist status check...');
    
    try {
      const result = await this.registrationService.checkWaitlistStatus(this.email);
      this.log('success', 'Waitlist check completed', result);
    } catch (error: any) {
      this.log('error', 'Waitlist check failed', error);
    }
  }

  async testWalletCreation() {
    this.log('info', 'Starting wallet creation...');
    this.loading = true;
    
    try {
      // First check waitlist status
      this.log('info', 'Checking waitlist status...');
      const waitlistData = await this.registrationService.checkWaitlistStatus(this.email);
      
      if (waitlistData) {
        this.log('success', 'Found waitlist user', waitlistData);
        
        // Create wallet with conversion
        this.log('info', 'Creating wallet with waitlist conversion...');
        const result = await this.registrationService.createWalletWithConversion(
          this.email, 
          this.passphrase
        );
        
        this.log('success', 'Wallet creation result', result);
        
        // Test authentication
        if (result.token) {
          this.log('success', 'Token present, testing authentication...');
          await this.authService.completeAuthentication(result, this.email);
          this.log('success', 'Authentication completed successfully');
        } else {
          this.log('error', 'No token in result - authentication will fail');
        }
        
      } else {
        this.log('warning', 'Email not found in waitlist, testing standard registration...');
        
        const result = await this.registrationService.createWalletWithConversion(
          this.email, 
          this.passphrase,
          'Test User',
          'spanish'
        );
        
        this.log('success', 'Standard registration result', result);
      }
      
    } catch (error: any) {
      this.log('error', 'Wallet creation failed', {
        message: error.message,
        status: error.status,
        error: error.error,
        stack: error.stack?.substring(0, 500)
      });
    } finally {
      this.loading = false;
    }
  }
}
