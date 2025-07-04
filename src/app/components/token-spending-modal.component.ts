import { Component, OnInit, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TokenService, TokenSpendingRequest, TokenBalance } from '../services/token.service';

@Component({
  selector: 'app-token-spending-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ data.title || 'Spend Tokens' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="closeModal()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="spending-modal-content">
      <div class="spending-info">
        <div class="feature-info">
          <ion-icon [name]="data.icon || 'diamond-outline'" class="feature-icon"></ion-icon>
          <h2>{{ data.featureName }}</h2>
          <p class="feature-description">{{ data.description }}</p>
        </div>

        <div class="token-details">
          <div class="cost-breakdown">
            <div class="cost-item">
              <span class="cost-label">Cost:</span>
              <span class="cost-value">
                <ion-icon name="diamond" class="token-icon"></ion-icon>
                {{ data.tokenCost }} YAP
              </span>
            </div>
            <div class="cost-item" *ngIf="data.duration">
              <span class="cost-label">Duration:</span>
              <span class="cost-value">{{ data.duration }}</span>
            </div>
            <div class="cost-item" *ngIf="data.benefits">
              <span class="cost-label">Benefits:</span>
              <span class="cost-value">{{ data.benefits }}</span>
            </div>
          </div>

          <div class="balance-info">
            <div class="current-balance">
              <span class="balance-label">Your Balance:</span>
              <span class="balance-value" [class.insufficient]="currentBalance < data.tokenCost">
                <ion-icon name="diamond" class="token-icon"></ion-icon>
                {{ currentBalance }} YAP
              </span>
            </div>
            <div class="after-purchase" *ngIf="currentBalance >= data.tokenCost">
              <span class="balance-label">After Purchase:</span>
              <span class="balance-value">
                <ion-icon name="diamond" class="token-icon"></ion-icon>
                {{ currentBalance - data.tokenCost }} YAP
              </span>
            </div>
          </div>

          <div class="warning" *ngIf="currentBalance < data.tokenCost">
            <ion-icon name="warning-outline"></ion-icon>
            <span>Insufficient tokens. You need {{ data.tokenCost - currentBalance }} more YAP tokens.</span>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <ion-button 
          expand="block" 
          color="medium" 
          fill="outline"
          (click)="closeModal()">
          Cancel
        </ion-button>
        <ion-button 
          expand="block" 
          color="primary"
          [disabled]="currentBalance < data.tokenCost || isProcessing"
          (click)="confirmSpending()">
          <ion-spinner *ngIf="isProcessing" name="crescent"></ion-spinner>
          <span *ngIf="!isProcessing">
            Spend {{ data.tokenCost }} YAP
          </span>
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .spending-modal-content {
      --padding-top: 20px;
      --padding-bottom: 20px;
      --padding-start: 20px;
      --padding-end: 20px;
    }

    .spending-info {
      margin-bottom: 32px;
    }

    .feature-info {
      text-align: center;
      margin-bottom: 24px;
    }

    .feature-icon {
      font-size: 48px;
      color: var(--ion-color-primary);
      margin-bottom: 12px;
    }

    .feature-info h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 600;
    }

    .feature-description {
      color: var(--ion-color-medium);
      margin: 0;
    }

    .token-details {
      background: var(--ion-color-light);
      border-radius: 12px;
      padding: 16px;
    }

    .cost-breakdown {
      margin-bottom: 16px;
    }

    .cost-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .cost-label {
      font-weight: 500;
      color: var(--ion-color-dark);
    }

    .cost-value {
      display: flex;
      align-items: center;
      font-weight: 600;
    }

    .token-icon {
      color: var(--ion-color-warning);
      margin-right: 4px;
      font-size: 16px;
    }

    .balance-info {
      border-top: 1px solid var(--ion-color-light-shade);
      padding-top: 16px;
    }

    .current-balance, .after-purchase {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .balance-label {
      font-weight: 500;
      color: var(--ion-color-medium);
    }

    .balance-value {
      display: flex;
      align-items: center;
      font-weight: 600;
    }

    .balance-value.insufficient {
      color: var(--ion-color-danger);
    }

    .warning {
      display: flex;
      align-items: center;
      background: var(--ion-color-danger-tint);
      color: var(--ion-color-danger);
      padding: 12px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .warning ion-icon {
      margin-right: 8px;
      font-size: 20px;
    }

    .action-buttons {
      display: flex;
      gap: 12px;
    }

    .action-buttons ion-button {
      flex: 1;
    }
  `]
})
export class TokenSpendingModalComponent implements OnInit {
  @Input() data: any = {};
  currentBalance = 0;
  isProcessing = false;

  constructor(
    private modalController: ModalController,
    private tokenService: TokenService
  ) {}

  ngOnInit() {
    // Get current token balance
    this.tokenService.tokenBalance$.subscribe(balance => {
      this.currentBalance = balance.totalBalance;
    });
  }

  async confirmSpending() {
    if (this.currentBalance < this.data.tokenCost) {
      return;
    }

    this.isProcessing = true;

    try {
      const spendingRequest: TokenSpendingRequest = {
        featureId: this.data.featureId,
        amount: this.data.tokenCost,
        action: this.data.action,
        metadata: this.data.metadata
      };

      this.tokenService.spendTokens(spendingRequest).subscribe({
        next: (result) => {
          if (result.success) {
            this.modalController.dismiss({
              confirmed: true,
              result: result
            });
          } else {
            console.error('Token spending failed:', result.error);
          }
          this.isProcessing = false;
        },
        error: (error) => {
          console.error('Error spending tokens:', error);
          this.isProcessing = false;
        }
      });
    } catch (error) {
      console.error('Error spending tokens:', error);
      this.isProcessing = false;
    }
  }

  closeModal() {
    this.modalController.dismiss({
      confirmed: false
    });
  }
}
