import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ErrorService } from '../error/error.service';
import { ApiService } from '../api-service.service';

/**
 * User profile information
 */
export interface UserProfile {
  walletAddress: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  xp: number;
  streak: number;
  level?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * XP history entry
 */
export interface XpHistoryEntry {
  id?: string;
  walletAddress: string;
  amount: number;
  date: string;
  type?: string;
  pass?: boolean;
  ts: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  language?: string;
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'system';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  soundEffects?: boolean;
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
 * Offchain profile data (XP, streak, wallet info)
 */
export interface OffchainProfile {
  userId: string;
  ethWalletAddress?: string;
  email?: string;
  xp: number;
  streak: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service for interacting with user profiles
 * Provides methods to retrieve and update user information, XP, streaks, and preferences
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService
  ) { }

  /**
   * Get user profile information
   * @param walletAddress User's wallet address
   */
  getUserProfile(walletAddress: string): Observable<UserProfile> {
    return this.apiService.get<UserProfile>(`profile/${walletAddress}`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'profile-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new user profile
   * @param walletAddress User's wallet address
   */
  createUserProfile(walletAddress: string): Observable<UserProfile> {
    return this.apiService.post<UserProfile>(
      'profile', 
      { walletAddress }
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'profile-creation');
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user profile information
   * @param walletAddress User's wallet address
   * @param updates Fields to update
   */
  updateUserProfile(walletAddress: string, updates: Partial<UserProfile>): Observable<void> {
    return this.apiService.patch<void>(
      `profile/${walletAddress}`, 
      updates
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'profile-update');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's XP
   * @param walletAddress User's wallet address
   */
  getUserXp(walletAddress: string): Observable<number> {
    return this.apiService.get<{xp: number}>(
      `points?walletAddress=${walletAddress}`
    ).pipe(
      map(response => response.xp),
      catchError(error => {
        this.errorService.handleError(error, 'xp-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's XP history
   * @param walletAddress User's wallet address
   * @param limit Maximum number of entries to return
   */
  getXpHistory(walletAddress: string, limit: number = 20): Observable<XpHistoryEntry[]> {
    return this.apiService.get<{history: XpHistoryEntry[]}>(
      `points/history`, 
      { walletAddress, limit }
    ).pipe(
      map(response => response.history || []),
      catchError(error => {
        this.errorService.handleError(error, 'xp-history-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's XP history for a specific date
   * @param walletAddress User's wallet address
   * @param date Date in YYYY-MM-DD format
   */
  getXpHistoryByDate(walletAddress: string, date: string): Observable<XpHistoryEntry[]> {
    return this.apiService.get<{history: XpHistoryEntry[]}>(
      `points/history?walletAddress=${walletAddress}&date=${date}`
    ).pipe(
      map(response => response.history || []),
      catchError(error => {
        this.errorService.handleError(error, 'xp-history-by-date-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's streak information
   * @param walletAddress User's wallet address
   */
  getUserStreak(walletAddress: string): Observable<StreakInfo> {
    return this.apiService.get<StreakInfo>(
      `profile/${walletAddress}/streak`
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'streak-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user's streak
   * @param walletAddress User's wallet address
   * @param streakDays New streak value
   */
  updateStreak(walletAddress: string, streakDays: number): Observable<void> {
    return this.apiService.patch<void>(
      `profile/${walletAddress}`,
      { streak: streakDays }
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'streak-update');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's preferences
   * @param walletAddress User's wallet address
   */
  getUserPreferences(walletAddress: string): Observable<UserPreferences> {
    return this.apiService.get<UserPreferences>(
      `profile/${walletAddress}/preferences`
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'preferences-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user's preferences
   * @param walletAddress User's wallet address
   * @param preferences New preferences
   */
  updateUserPreferences(walletAddress: string, preferences: Partial<UserPreferences>): Observable<void> {
    return this.apiService.patch<void>(
      `profile/${walletAddress}/preferences`,
      preferences
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'preferences-update');
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if the user's profile exists, and create one if it doesn't
   * @param walletAddress User's wallet address
   */
  ensureProfileExists(walletAddress: string): Observable<UserProfile> {
    return this.getUserProfile(walletAddress).pipe(
      catchError(error => {
        // If the profile doesn't exist (404), create a new one
        if (error.status === 404) {
          return this.createUserProfile(walletAddress);
        }
        // Otherwise, propagate the error
        return throwError(() => error);
      })
    );
  }

  /**
   * Get offchain profile data (XP, streak, etc.)
   * @param userId User's ID (not wallet address)
   */
  getOffchainProfile(userId: string): Observable<OffchainProfile> {
    return this.apiService.get<OffchainProfile>(`profile/${userId}`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'offchain-profile-fetch');
        return throwError(() => error);
      })
    );
  }
}
