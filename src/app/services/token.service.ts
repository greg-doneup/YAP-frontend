/**
 * Token Service
 * 
 * Manages YAP token operations and allowances:
 * - Token balance retrieval and caching
 * - Daily allowance tracking
 * - Token spending validation
 * - Unlimited hour pass management
 * - Real-time balance updates
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { BlockchainService } from './blockchain.service';
import { environment } from '../../environments/environment';

export interface TokenBalance {
  balance: number;
  stakedBalance: number;
  totalBalance: number;
  lastUpdated: Date;
}

export interface DailyAllowance {
  featureId: string;
  featureName: string;
  dailyLimit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
  unlimitedUntil?: Date;
}

export interface UnlimitedHourPass {
  featureId: string;
  isActive: boolean;
  expiresAt?: Date;
  timeRemaining?: number; // minutes
}

export interface TokenSpendingRequest {
  featureId: string;
  amount: number;
  action?: string;
  metadata?: any;
}

export interface TokenSpendingResult {
  success: boolean;
  transactionId?: string;
  newBalance: number;
  tokensSpent: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private apiUrl = environment.apiUrl; // Use environment configuration instead of hardcoded localhost
  
  // Token balance state
  private tokenBalanceSubject = new BehaviorSubject<TokenBalance>({
    balance: 0,
    stakedBalance: 0,
    totalBalance: 0,
    lastUpdated: new Date()
  });
  public tokenBalance$ = this.tokenBalanceSubject.asObservable();

  // Daily allowances state
  private dailyAllowancesSubject = new BehaviorSubject<DailyAllowance[]>([]);
  public dailyAllowances$ = this.dailyAllowancesSubject.asObservable();

  // Unlimited hour passes state
  private unlimitedPassesSubject = new BehaviorSubject<UnlimitedHourPass[]>([]);
  public unlimitedPasses$ = this.unlimitedPassesSubject.asObservable();

  // Auto-refresh interval (every 30 seconds)
  private refreshInterval = 30000;
  private refreshSubscription: any;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private blockchainService: BlockchainService
  ) {
    this.initializeService();
  }

  /**
   * Initialize the token service
   */
  private initializeService(): void {
    // Start auto-refresh when user is authenticated
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.startAutoRefresh();
        this.refreshAllData().catch(error => 
          console.warn('Initial token data refresh failed:', error)
        );
      } else {
        this.stopAutoRefresh();
        this.resetState();
      }
    });
  }

  /**
   * Get current token balance
   */
  public getTokenBalance(): Observable<TokenBalance> {
    return this.http.get<any>(`${this.apiUrl}/tokens/balance`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => ({
        balance: response.balance || 0,
        stakedBalance: response.stakedBalance || 0,
        totalBalance: (response.balance || 0) + (response.stakedBalance || 0),
        lastUpdated: new Date()
      })),
      tap(balance => this.tokenBalanceSubject.next(balance)),
      catchError(error => {
        console.error('Error fetching token balance, using fallback:', error);
        // Fallback: Check if user just registered and should have starting points
        const currentUser = localStorage.getItem('currentUser');
        let fallbackBalance = 0;
        
        if (currentUser) {
          try {
            const userData = JSON.parse(currentUser);
            // Check if user was created recently (within last hour) - new user
            const now = new Date();
            const userCreated = new Date(userData.createdAt || now);
            const hoursSinceCreation = (now.getTime() - userCreated.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceCreation < 1) {
              fallbackBalance = 100; // New users get 100 tokens
              console.log('🎁 New user detected, providing 100 starting tokens');
            }
          } catch (e) {
            console.warn('Error parsing user data for fallback balance');
          }
        }
        
        const fallbackTokenBalance = {
          balance: fallbackBalance,
          stakedBalance: 0,
          totalBalance: fallbackBalance,
          lastUpdated: new Date()
        };
        
        this.tokenBalanceSubject.next(fallbackTokenBalance);
        return of(fallbackTokenBalance);
      })
    );
  }

  /**
   * Get daily allowances for all features
   */
  public getDailyAllowances(): Observable<DailyAllowance[]> {
    return this.http.get<any>(`${this.apiUrl}/allowances/daily`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.allowances || []),
      tap(allowances => this.dailyAllowancesSubject.next(allowances)),
      catchError(error => {
        console.error('Error fetching daily allowances, using fallback:', error);
        
        // Fallback: Provide default daily allowances for new users
        const fallbackAllowances: DailyAllowance[] = [
          {
            featureId: 'ai-chat',
            featureName: 'AI Chat',
            dailyLimit: 10,
            used: 0,
            remaining: 10,
            resetsAt: this.getNextMidnight()
          },
          {
            featureId: 'pronunciation-practice',
            featureName: 'Pronunciation Practice',
            dailyLimit: 5,
            used: 0,
            remaining: 5,
            resetsAt: this.getNextMidnight()
          },
          {
            featureId: 'quiz',
            featureName: 'Quiz Practice',
            dailyLimit: 15,
            used: 0,
            remaining: 15,
            resetsAt: this.getNextMidnight()
          }
        ];
        
        console.log('🎁 Providing fallback daily allowances for new user');
        this.dailyAllowancesSubject.next(fallbackAllowances);
        return of(fallbackAllowances);
      })
    );
  }

  /**
   * Get next midnight for allowance reset
   */
  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Get unlimited hour passes
   */
  public getUnlimitedPasses(): Observable<UnlimitedHourPass[]> {
    return this.http.get<any>(`${this.apiUrl}/allowances/unlimited`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.passes || []),
      tap(passes => this.unlimitedPassesSubject.next(passes)),
      catchError(error => {
        console.error('Error fetching unlimited passes:', error);
        return of(this.unlimitedPassesSubject.value);
      })
    );
  }

  /**
   * Validate token spending before making a purchase
   */
  public validateTokenSpending(request: TokenSpendingRequest): Observable<{
    canSpend: boolean;
    currentBalance: number;
    reason?: string;
  }> {
    return this.http.post<any>(`${this.apiUrl}/tokens/validate-spending`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => {
        console.error('Error validating token spending:', error);
        return of({
          canSpend: false,
          currentBalance: this.tokenBalanceSubject.value.balance,
          reason: 'Validation service unavailable'
        });
      })
    );
  }

  /**
   * Spend tokens for a feature
   */
  public spendTokens(request: TokenSpendingRequest): Observable<TokenSpendingResult> {
    return this.http.post<any>(`${this.apiUrl}/tokens/spend`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => ({
        success: response.success || false,
        transactionId: response.transactionId,
        newBalance: response.newBalance || 0,
        tokensSpent: request.amount,
        error: response.error
      })),
      tap(result => {
        if (result.success) {
          // Update local balance
          const currentBalance = this.tokenBalanceSubject.value;
          this.tokenBalanceSubject.next({
            ...currentBalance,
            balance: result.newBalance,
            totalBalance: result.newBalance + currentBalance.stakedBalance,
            lastUpdated: new Date()
          });
        }
      }),
      catchError(error => {
        console.error('Error spending tokens:', error);
        return of({
          success: false,
          newBalance: this.tokenBalanceSubject.value.balance,
          tokensSpent: 0,
          error: 'Spending service unavailable'
        });
      })
    );
  }

  /**
   * Purchase unlimited hour pass for a feature
   */
  public purchaseUnlimitedHour(featureId: string): Observable<{
    success: boolean;
    expiresAt?: Date;
    tokensSpent: number;
    error?: string;
  }> {
    const request: TokenSpendingRequest = {
      featureId: `${featureId}_unlimitedHour`,
      amount: 2, // Standard cost for unlimited hour
      action: 'unlimitedHour'
    };

    return this.spendTokens(request).pipe(
      map(result => ({
        success: result.success,
        expiresAt: result.success ? new Date(Date.now() + 60 * 60 * 1000) : undefined,
        tokensSpent: result.tokensSpent,
        error: result.error
      })),
      tap(result => {
        if (result.success) {
          // Update unlimited passes
          this.refreshUnlimitedPasses();
        }
      })
    );
  }

  /**
   * Get allowance status for a specific feature
   */
  public getFeatureAllowance(featureId: string): Observable<DailyAllowance | null> {
    return this.dailyAllowances$.pipe(
      map(allowances => allowances.find(a => a.featureId === featureId) || null)
    );
  }

  /**
   * Get unlimited pass status for a specific feature
   */
  public getFeatureUnlimitedPass(featureId: string): Observable<UnlimitedHourPass | null> {
    return this.unlimitedPasses$.pipe(
      map(passes => passes.find(p => p.featureId === featureId) || null)
    );
  }

  /**
   * Check if user can use a feature (has allowance or unlimited pass)
   */
  public canUseFeature(featureId: string): Observable<{
    canUse: boolean;
    reason: string;
    allowanceRemaining?: number;
    unlimitedUntil?: Date;
  }> {
    return this.http.post<any>(`${this.apiUrl}/allowances/check`, {
      featureId,
      quantity: 1
    }, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => {
        console.error('Error checking feature allowance via API, using local data:', error);
        
        // Fallback: Check local allowances data
        const currentAllowances = this.dailyAllowancesSubject.value;
        const featureAllowance = currentAllowances.find(a => a.featureId === featureId);
        
        if (featureAllowance && featureAllowance.remaining > 0) {
          return of({
            canUse: true,
            reason: `${featureAllowance.remaining} free ${featureAllowance.featureName} messages remaining today`,
            allowanceRemaining: featureAllowance.remaining
          });
        }
        
        // Check unlimited passes
        const currentPasses = this.unlimitedPassesSubject.value;
        const unlimitedPass = currentPasses.find(p => p.featureId === featureId && p.isActive);
        
        if (unlimitedPass) {
          return of({
            canUse: true,
            reason: 'Unlimited access active',
            unlimitedUntil: unlimitedPass.expiresAt
          });
        }
        
        return of({
          canUse: false,
          reason: 'No free allowance remaining and service unavailable',
          allowanceRemaining: 0
        });
      })
    );
  }

  /**
   * Use daily allowance for a feature
   */
  public useAllowance(featureId: string, quantity: number = 1): Observable<{
    success: boolean;
    used: number;
    remaining: number;
    totalUsed: number;
    dailyLimit: number;
    error?: string;
  }> {
    return this.http.post<any>(`${this.apiUrl}/allowances/use`, {
      featureId,
      quantity
    }, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => ({
        success: response.success || false,
        used: response.used || 0,
        remaining: response.remaining || 0,
        totalUsed: response.totalUsed || 0,
        dailyLimit: response.dailyLimit || 0,
        error: response.error
      })),
      tap(result => {
        if (result.success) {
          // Refresh allowances after successful use
          this.getDailyAllowances().subscribe();
        }
      }),
      catchError(error => {
        console.error('Error using allowance:', error);
        return of({
          success: false,
          used: 0,
          remaining: 0,
          totalUsed: 0,
          dailyLimit: 0,
          error: 'Service unavailable'
        });
      })
    );
  }

  /**
   * Refresh all token and allowance data
   * Now uses blockchain data when possible for accurate YAP token balance
   */
  public async refreshAllData(): Promise<void> {
    try {
      // Try to get real blockchain balance first
      console.log('🔄 Refreshing token data - attempting blockchain connection...');
      await this.getBlockchainTokenBalance();
      console.log('✅ Successfully refreshed token balance from blockchain');
    } catch (error) {
      console.warn('⚠️ Blockchain unavailable, falling back to API:', error);
      // Fallback to API balance
      this.getTokenBalance().subscribe();
    }
    
    // Always refresh allowances and passes from API (for now)
    this.getDailyAllowances().subscribe();
    this.getUnlimitedPasses().subscribe();
  }

  /**
   * Refresh just unlimited passes
   */
  public refreshUnlimitedPasses(): void {
    this.getUnlimitedPasses().subscribe();
  }

  /**
   * Start auto-refresh of token data
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshSubscription = interval(this.refreshInterval).pipe(
      switchMap(() => this.getTokenBalance())
    ).subscribe();
  }

  /**
   * Stop auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
  }

  /**
   * Reset service state (on logout)
   */
  private resetState(): void {
    this.tokenBalanceSubject.next({
      balance: 0,
      stakedBalance: 0,
      totalBalance: 0,
      lastUpdated: new Date()
    });
    this.dailyAllowancesSubject.next([]);
    this.unlimitedPassesSubject.next([]);
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Get current token balance (synchronous)
   */
  public getCurrentBalance(): number {
    return this.tokenBalanceSubject.value.balance;
  }

  /**
   * Get current daily allowances (synchronous)
   */
  public getCurrentAllowances(): DailyAllowance[] {
    return this.dailyAllowancesSubject.value;
  }

  /**
   * Get current unlimited passes (synchronous)
   */
  public getCurrentUnlimitedPasses(): UnlimitedHourPass[] {
    return this.unlimitedPassesSubject.value;
  }

  /**
   * Get YAP token balance from blockchain smart contract
   * This provides the real, on-chain balance for the user
   */
  public async getBlockchainTokenBalance(): Promise<TokenBalance> {
    try {
      // Get current user's wallet address
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      
      const userData = JSON.parse(currentUser);
      const walletAddress = userData.walletAddress || userData.ethWalletAddress;
      
      if (!walletAddress) {
        throw new Error('No wallet address found for user');
      }
      
      console.log('🔗 Getting YAP token balance from blockchain for:', walletAddress);
      
      // Get balance from YAP token smart contract
      const balance = await this.blockchainService.getTokenBalance(walletAddress);
      console.log('💰 Blockchain YAP balance:', balance);
      
      const tokenBalance: TokenBalance = {
        balance: balance,
        stakedBalance: 0, // TODO: Get from vesting contract if implemented
        totalBalance: balance,
        lastUpdated: new Date()
      };
      
      // Update the subject with real blockchain data
      this.tokenBalanceSubject.next(tokenBalance);
      
      return tokenBalance;
    } catch (error) {
      console.error('❌ Error getting blockchain token balance:', error);
      
      // Fallback to default balance for new users
      const fallbackBalance: TokenBalance = {
        balance: 0,
        stakedBalance: 0,
        totalBalance: 0,
        lastUpdated: new Date()
      };
      
      return fallbackBalance;
    }
  }

  /**
   * Refresh token balance using blockchain data when possible
   */
  public refreshTokenBalance(): void {
    this.getBlockchainTokenBalance().then(balance => {
      console.log('✅ Token balance refreshed from blockchain:', balance);
    }).catch(error => {
      console.error('Error refreshing token balance from blockchain:', error);
    });
  }
}
