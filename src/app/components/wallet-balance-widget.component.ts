import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TokenService, TokenBalance, DailyAllowance } from '../services/token.service';
import { WalletService } from '../services/wallet.service';
import { WalletStorageService } from '../services/wallet-storage.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-wallet-balance-widget',
  template: `
    <div class="wallet-widget">
      <div class="balance-section">
        <div class="balance-header">
          <h3>YAP Balance</h3>
          <ion-button 
            fill="clear" 
            size="small"
            (click)="refreshBalance()">
            <ion-icon name="refresh-outline"></ion-icon>
          </ion-button>
        </div>
        
        <div class="balance-display">
          <div class="total-balance">
            <ion-icon name="diamond" class="token-icon"></ion-icon>
            <span class="balance-amount">{{ tokenBalance.totalBalance | number:'1.2-2' }}</span>
            <span class="balance-label">YAP</span>
          </div>
          
          <div class="balance-breakdown" *ngIf="tokenBalance.stakedBalance > 0">
            <div class="balance-item">
              <span class="label">Available:</span>
              <span class="value">{{ tokenBalance.balance | number:'1.2-2' }}</span>
            </div>
            <div class="balance-item">
              <span class="label">Staked:</span>
              <span class="value">{{ tokenBalance.stakedBalance | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="allowances-section" *ngIf="dailyAllowances.length > 0">
        <h4>Daily Allowances</h4>
        <div class="allowance-grid">
          <div 
            class="allowance-item" 
            *ngFor="let allowance of dailyAllowances.slice(0, 3)"
            [class.exhausted]="allowance.remaining === 0">
            <div class="allowance-info">
              <span class="allowance-name">{{ allowance.featureName }}</span>
              <div class="allowance-progress">
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    [style.width.%]="(allowance.used / allowance.dailyLimit) * 100">
                  </div>
                </div>
                <span class="progress-text">
                  {{ allowance.remaining }}/{{ allowance.dailyLimit }}
                </span>
              </div>
            </div>
            <ion-button 
              *ngIf="allowance.remaining === 0"
              size="small"
              fill="outline"
              color="primary"
              (click)="purchaseUnlimitedAccess(allowance)">
              Unlock
            </ion-button>
          </div>
        </div>
      </div>


    </div>
  `,
  styles: [`
    .wallet-widget {
      background: rgba(0, 0, 0, 0.7);
      border-radius: 16px;
      padding: 16px;
      margin: 16px 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .balance-section {
      margin-bottom: 16px;
    }

    .balance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .balance-header h3 {
      margin: 0 !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
    }

    .balance-display {
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .balance-display:hover {
      transform: scale(1.02);
    }

    .total-balance {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .token-icon {
      color: var(--ion-color-warning);
      font-size: 24px;
      margin-right: 8px;
    }

    .balance-amount {
      font-size: 32px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      margin-right: 6px !important;
    }

    .balance-label {
      font-size: 16px !important;
      font-weight: 500 !important;
      color: #cccccc !important;
    }

    .balance-breakdown {
      display: flex;
      justify-content: space-around;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .balance-item {
      text-align: center;
    }

    .balance-item .label {
      display: block !important;
      font-size: 12px !important;
      color: #cccccc !important;
      margin-bottom: 2px !important;
    }

    .balance-item .value {
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
    }

    .allowances-section {
      margin-bottom: 16px;
    }

    .allowances-section h4 {
      margin: 0 0 12px 0 !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
    }

    .allowance-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .allowance-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      border-left: 3px solid var(--ion-color-primary);
    }

    .allowance-item.exhausted {
      border-left-color: var(--ion-color-warning);
    }

    .allowance-info {
      flex: 1;
    }

    .allowance-name {
      font-size: 14px !important;
      font-weight: 500 !important;
      color: #ffffff !important;
      display: block !important;
      margin-bottom: 4px !important;
    }

    .allowance-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-bar {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--ion-color-primary);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px !important;
      color: #cccccc !important;
      font-weight: 500 !important;
      min-width: 40px !important;
    }

    /* Force override any CSS variable references to dark colors */
    .wallet-widget h3,
    .wallet-widget h4,
    .wallet-widget span,
    .wallet-widget div {
      color: #ffffff !important;
    }
    
    /* Specifically target elements that might be using ion-color-dark */
    .balance-header h3,
    .allowances-section h4,
    .allowance-name,
    .balance-amount,
    .balance-label {
      color: #ffffff !important;
    }

    .quick-actions {
      margin-top: 16px;
    }
  `]
})
export class WalletBalanceWidgetComponent implements OnInit, OnDestroy {
  tokenBalance: TokenBalance = {
    balance: 0,
    stakedBalance: 0,
    totalBalance: 0,
    lastUpdated: new Date()
  };
  
  dailyAllowances: DailyAllowance[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private tokenService: TokenService,
    private walletService: WalletService,
    private walletStorageService: WalletStorageService,
    private authService: AuthService,
    private router: Router,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    // Subscribe to token balance updates
    this.subscriptions.push(
      this.tokenService.tokenBalance$.subscribe(balance => {
        this.tokenBalance = balance;
      })
    );

    // Subscribe to daily allowances
    this.subscriptions.push(
      this.tokenService.dailyAllowances$.subscribe(allowances => {
        this.dailyAllowances = allowances;
      })
    );

    // Initial data refresh
    this.refreshBalance();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  refreshBalance() {
    this.tokenService.refreshAllData();
  }

  openWalletDetails() {
    // Navigate to profile where wallet management is now located
    this.router.navigate(['/profile']);
  }

  async purchaseUnlimitedAccess(allowance: DailyAllowance) {
    // Import dynamically to avoid circular dependencies
    const { TokenSpendingModalComponent } = await import('./token-spending-modal.component');
    
    const modal = await this.modalController.create({
      component: TokenSpendingModalComponent,
      componentProps: {
        data: {
          title: 'Unlock Unlimited Access',
          featureId: allowance.featureId,
          featureName: allowance.featureName,
          description: 'Get unlimited access for the rest of the day',
          tokenCost: 3, // Based on the token matrix
          duration: 'Rest of day',
          benefits: 'Unlimited usage',
          icon: 'infinite-outline',
          action: 'unlock_unlimited',
          metadata: {
            featureType: 'daily_unlimited',
            originalLimit: allowance.dailyLimit
          }
        }
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.confirmed) {
        // Refresh allowances after successful purchase
        this.refreshBalance();
      }
    });

    await modal.present();
  }
}
