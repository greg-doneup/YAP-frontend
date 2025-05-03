import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { ApiService } from '../api-service.service';

/**
 * User profile information for the leaderboard
 */
export interface LeaderboardUser {
  wallet: string;
  username?: string;
  avatarUrl?: string;
  xp: number;
  streak: number;
  rank?: number;
  yapBalance?: string;
  level?: number;
  joinedAt?: string;
}

/**
 * Leaderboard entry with rank information
 */
export interface LeaderboardEntry extends LeaderboardUser {
  rank: number;
  dailyXp?: number;
  weeklyXp?: number;
  monthlyXp?: number;
}

/**
 * Leaderboard time period
 */
export enum LeaderboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'allTime'
}

/**
 * Streak information
 */
export interface StreakInfo {
  current: number;
  longest: number;
  lastCompletionDate?: string;
}

/**
 * Service for interacting with leaderboard features in the YAP backend
 * Provides leaderboard rankings, user statistics, and streak information
 */
@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private baseUrl = `${environment.apiUrl}`;
  
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService
  ) { }

  /**
   * Get global leaderboard data
   * @param period The time period for the leaderboard
   * @param limit Maximum number of entries to return
   * @param offset Starting position for pagination
   */
  getLeaderboard(
    period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY,
    limit: number = 20,
    offset: number = 0
  ): Observable<LeaderboardEntry[]> {
    return this.connectivityService.callWithRetry<{entries: LeaderboardEntry[]}>(
      'learning/leaderboard',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        retries: 2
      }
    ).pipe(
      map(response => {
        const entries = response.entries || [];
        
        // Ensure all entries have rank information
        return entries.map((entry, index) => ({
          ...entry,
          rank: entry.rank || offset + index + 1
        }));
      }),
      catchError(error => {
        this.errorService.handleError(error, 'leaderboard-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a user's personal leaderboard rank and stats
   * @param walletAddress The wallet address of the user
   */
  getUserRank(walletAddress: string): Observable<LeaderboardEntry> {
    return this.apiService.get<LeaderboardEntry>(`learning/leaderboard/user/${walletAddress}`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'user-rank-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get streak information for a user
   * @param walletAddress The wallet address of the user
   */
  getUserStreak(walletAddress: string): Observable<StreakInfo> {
    return this.apiService.get<StreakInfo>(`profile/${walletAddress}/streak`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'streak-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user statistics including XP, level, streak and rank
   * @param walletAddress The wallet address of the user
   */
  getUserStats(walletAddress: string): Observable<LeaderboardUser> {
    return this.apiService.get<LeaderboardUser>(`profile/${walletAddress}`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'user-stats-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the user's friends/followed users on the leaderboard
   * @param walletAddress The wallet address of the user
   */
  getFriendsLeaderboard(walletAddress: string): Observable<LeaderboardEntry[]> {
    return this.apiService.get<{entries: LeaderboardEntry[]}>(`learning/leaderboard/friends/${walletAddress}`).pipe(
      map(response => response.entries || []),
      catchError(error => {
        this.errorService.handleError(error, 'friends-leaderboard-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the combined user dashboard data with rewards, streak, and rank
   * @param walletAddress The wallet address of the user
   */
  getUserDashboard(walletAddress: string): Observable<{
    wallet: string;
    xp: number;
    streak: number;
    yapBalance: string;
    rank?: number;
  }> {
    return this.apiService.get<{
      wallet: string;
      xp: number;
      streak: number;
      yapBalance: string;
      rank?: number;
    }>(`dashboard`, { wallet: walletAddress }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'dashboard-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get historical XP progress for a user
   * @param walletAddress The wallet address of the user
   * @param days Number of days of history to return
   */
  getXpHistory(walletAddress: string, days: number = 30): Observable<{
    date: string;
    xp: number;
  }[]> {
    return this.apiService.get<{history: {date: string; xp: number}[]}>(
      `profile/${walletAddress}/xp/history`, { days: days.toString() }
    ).pipe(
      map(response => response.history || []),
      catchError(error => {
        this.errorService.handleError(error, 'xp-history-fetch');
        return throwError(() => error);
      })
    );
  }
}
