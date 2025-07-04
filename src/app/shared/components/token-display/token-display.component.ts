/**
 * Token Display Component
 * 
 * Displays user's token balance and allowances:
 * - Current token balance with real-time updates
 * - Daily allowance status for features
 * - Unlimited hour pass indicators
 * - Purchase options for tokens and passes
 */

import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { TokenService, TokenBalance, DailyAllowance, UnlimitedHourPass } from '../../../services/token.service';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-token-display',
  templateUrl: './token-display.component.html',
  styleUrls: ['./token-display.component.scss']
})
export class TokenDisplayComponent implements OnInit, OnDestroy {
  @Input() compact: boolean = false;
  @Input() showAllowances: boolean = true;
  @Input() showUnlimitedPasses: boolean = true;
  @Input() featureFilter?: string; // Filter to show only specific feature

  tokenBalance$: Observable<TokenBalance>;
  dailyAllowances$: Observable<DailyAllowance[]>;
  unlimitedPasses$: Observable<UnlimitedHourPass[]>;

  private subscriptions: Subscription[] = [];

  constructor(
    private tokenService: TokenService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    this.tokenBalance$ = this.tokenService.tokenBalance$;
    this.dailyAllowances$ = this.tokenService.dailyAllowances$;
    this.unlimitedPasses$ = this.tokenService.unlimitedPasses$;
  }

  ngOnInit() {
    // Refresh data when component initializes
    this.tokenService.refreshAllData();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Format time remaining for unlimited passes
   */
  formatTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const diffMs = new Date(expiresAt).getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Expired';
    }

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${remainingMinutes}m`;
    }
  }

  /**
   * Get progress percentage for allowances
   */
  getProgressPercentage(allowance: DailyAllowance): number {
    if (allowance.dailyLimit === 0) return 0;
    return Math.round((allowance.used / allowance.dailyLimit) * 100);
  }

  /**
   * Get progress color based on usage
   */
  getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'primary';
  }

  /**
   * Purchase unlimited hour pass for a feature
   */
  async purchaseUnlimitedHour(featureId: string, featureName: string) {
    const alert = await this.alertController.create({
      header: 'Purchase Unlimited Hour',
      message: `Purchase unlimited access to ${featureName} for 1 hour? This will cost 2 tokens.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Purchase',
          handler: () => {
            this.processPurchase(featureId, featureName);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Process unlimited hour purchase
   */
  private processPurchase(featureId: string, featureName: string) {
    const subscription = this.tokenService.purchaseUnlimitedHour(featureId).subscribe({
      next: async (result: any) => {
        if (result.success) {
          const toast = await this.toastController.create({
            message: `Unlimited hour activated for ${featureName}!`,
            duration: 3000,
            color: 'success',
            position: 'top'
          });
          await toast.present();
        } else {
          const toast = await this.toastController.create({
            message: result.error || 'Purchase failed',
            duration: 3000,
            color: 'danger',
            position: 'top'
          });
          await toast.present();
        }
      },
      error: async (error: any) => {
        console.error('Purchase error:', error);
        const toast = await this.toastController.create({
          message: 'Purchase failed. Please try again.',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Refresh token data
   */
  refreshData() {
    this.tokenService.refreshAllData();
  }

  /**
   * Show token purchase options
   */
  async showTokenPurchaseOptions() {
    const alert = await this.alertController.create({
      header: 'Get More Tokens',
      message: 'How would you like to get more tokens?',
      buttons: [
        {
          text: 'Complete Lessons',
          handler: () => {
            // Navigate to learning section
            console.log('Navigate to learning');
          }
        },
        {
          text: 'Take Exams',
          handler: () => {
            // Navigate to assessments
            console.log('Navigate to assessments');
          }
        },
        {
          text: 'Purchase Tokens',
          handler: () => {
            // Navigate to token purchase
            console.log('Navigate to token purchase');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  /**
   * Filter allowances based on feature filter
   */
  filterAllowances(allowances: DailyAllowance[]): DailyAllowance[] {
    if (!this.featureFilter) {
      return allowances;
    }
    return allowances.filter(a => a.featureId.includes(this.featureFilter!));
  }

  /**
   * Filter unlimited passes based on feature filter
   */
  filterUnlimitedPasses(passes: UnlimitedHourPass[]): UnlimitedHourPass[] {
    if (!this.featureFilter) {
      return passes;
    }
    return passes.filter(p => p.featureId.includes(this.featureFilter!));
  }

  /**
   * Check if unlimited pass is active and not expired
   */
  isUnlimitedPassActive(pass: UnlimitedHourPass): boolean {
    if (!pass.isActive || !pass.expiresAt) {
      return false;
    }
    return new Date(pass.expiresAt) > new Date();
  }

  /**
   * Get feature display name
   */
  getFeatureDisplayName(featureId: string): string {
    const featureNames: { [key: string]: string } = {
      'dailyLessons': 'Daily Lessons',
      'aiTextChat': 'AI Text Chat',
      'aiSpeechChat': 'AI Speech Chat',
      'pronunciationAnalysis': 'Pronunciation Analysis',
      'ttsGeneration': 'Text-to-Speech',
      'unitExam': 'Unit Exams',
      'unitExamSkipAhead': 'Skip-Ahead Exams',
      'adaptiveReviewQuiz': 'Adaptive Quizzes'
    };
    return featureNames[featureId] || featureId;
  }
}
