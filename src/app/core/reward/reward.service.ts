import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { RateLimiterService, DEFAULT_CONFIGS } from '../rate-limiter/rate-limiter.service';
import { ApiService } from '../api-service.service';

/**
 * User rewards statistics from blockchain
 */
export interface UserStats {
  pointTotal: string;
  mintableYAP: string;
  totalYAPMinted: string;
}

/**
 * Token information
 */
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Transaction response
 */
export interface TransactionResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Service for interacting with blockchain rewards and token functionalities
 * Provides methods to retrieve token balances, record daily completions, and mint tokens
 */
@Injectable({
  providedIn: 'root'
})
export class RewardService {
  private baseUrl = `${environment.apiUrl}/reward`;
  
  // Rate limiter keys
  private static readonly RL_RECORD_COMPLETION = 'reward_record_completion';
  private static readonly RL_MINT_TOKENS = 'reward_mint_tokens';
  private static readonly RL_BALANCE_CHECK = 'reward_balance_check';

  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService,
    private rateLimiter: RateLimiterService
  ) { }

  /**
   * Record a user's daily completion to earn rewards
   * This updates their point total and mintable YAP amount
   * If minting is enabled, it will also mint YAP tokens
   * @param walletAddress User's wallet address
   */
  recordCompletion(walletAddress: string): Observable<TransactionResponse> {
    return this.rateLimiter.executeIfAllowed(
      RewardService.RL_RECORD_COMPLETION,
      () => this.connectivityService.callWithRetry<TransactionResponse>(
        `${this.baseUrl}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
          retries: 2
        }
      ).pipe(
        catchError(error => {
          this.errorService.handleError(error, 'record-completion');
          return throwError(() => error);
        })
      ),
      // One completion per user per day
      {
        maxOperations: 1,
        windowMs: 86400000, // 24 hours
        message: 'You have already recorded your completion for today.'
      }
    );
  }

  /**
   * Get user's reward statistics including point total and mintable YAP tokens
   * @param walletAddress User's wallet address
   */
  getUserStats(walletAddress: string): Observable<UserStats> {
    return this.rateLimiter.executeIfAllowed(
      RewardService.RL_BALANCE_CHECK,
      () => this.apiService.get<UserStats>(`reward/stats/${walletAddress}`).pipe(
        catchError(error => {
          this.errorService.handleError(error, 'user-stats-fetch');
          return throwError(() => error);
        })
      ),
      // Allow 20 balance checks per minute
      {
        maxOperations: 20,
        windowMs: 60000,
        message: 'Balance check rate limit exceeded. Please try again later.'
      }
    );
  }

  /**
   * Get user's YAP token balance
   * @param walletAddress User's wallet address
   */
  getBalance(walletAddress: string): Observable<string> {
    return this.rateLimiter.executeIfAllowed(
      RewardService.RL_BALANCE_CHECK,
      () => this.apiService.get<{balance: string}>(`reward/balance/${walletAddress}`).pipe(
        map(response => response.balance),
        catchError(error => {
          this.errorService.handleError(error, 'balance-fetch');
          return throwError(() => error);
        })
      ),
      // Allow 20 balance checks per minute
      {
        maxOperations: 20,
        windowMs: 60000,
        message: 'Balance check rate limit exceeded. Please try again later.'
      }
    );
  }

  /**
   * Mint user's accumulated YAP tokens
   * @param walletAddress User's wallet address
   */
  mintAccumulatedYAP(walletAddress: string): Observable<TransactionResponse> {
    return this.rateLimiter.executeIfAllowed(
      RewardService.RL_MINT_TOKENS,
      () => this.apiService.post<TransactionResponse>('reward/mint', { walletAddress }).pipe(
        catchError(error => {
          this.errorService.handleError(error, 'mint-tokens');
          return throwError(() => error);
        })
      ),
      // One mint operation per 10 minutes per user
      {
        maxOperations: 1,
        windowMs: 600000, // 10 minutes
        message: 'Minting operation rate limit exceeded. Please try again later.'
      }
    );
  }

  /**
   * Check if user has completed their daily task today
   * @param walletAddress User's wallet address
   */
  hasCompletedToday(walletAddress: string): Observable<boolean> {
    return this.apiService.get<{completed: boolean}>(`reward/completed/${walletAddress}`).pipe(
      map(response => response.completed),
      catchError(error => {
        this.errorService.handleError(error, 'completion-check');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get information about the YAP token (name, symbol, decimals)
   */
  getTokenInfo(): Observable<TokenInfo> {
    return this.apiService.get<TokenInfo>('reward/token-info').pipe(
      catchError(error => {
        this.errorService.handleError(error, 'token-info');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the current daily reward amount in YAP tokens
   */
  getDailyReward(): Observable<string> {
    return this.apiService.get<{reward: string}>('reward/daily-reward').pipe(
      map(response => response.reward),
      catchError(error => {
        this.errorService.handleError(error, 'daily-reward');
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if YAP minting is currently enabled
   */
  isMintingEnabled(): Observable<boolean> {
    return this.apiService.get<{enabled: boolean}>('reward/minting-enabled').pipe(
      map(response => response.enabled),
      catchError(error => {
        this.errorService.handleError(error, 'minting-status');
        return throwError(() => error);
      })
    );
  }
}
