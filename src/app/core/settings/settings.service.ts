import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { catchError, map } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ApiService } from '../api-service.service';

/**
 * Application theme options
 */
export type ThemeOption = 'light' | 'dark' | 'system';

/**
 * Language difficulty levels
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * User application settings
 */
export interface AppSettings {
  theme: ThemeOption;
  language: string;
  notifications: boolean;
  soundEffects: boolean;
  dailyGoal: number;
  difficulty: DifficultyLevel;
  autoMint: boolean;
  showBalance: boolean;
  hapticFeedback: boolean;
}

/**
 * Default application settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  notifications: true,
  soundEffects: true,
  dailyGoal: 10,
  difficulty: 'beginner',
  autoMint: false,
  showBalance: true,
  hapticFeedback: true
};

/**
 * Key constants for settings storage
 */
export const SETTINGS_KEYS = {
  THEME: 'yap_theme',
  LANGUAGE: 'yap_language',
  NOTIFICATIONS: 'yap_notifications',
  SOUND_EFFECTS: 'yap_sound_effects',
  DAILY_GOAL: 'yap_daily_goal',
  DIFFICULTY: 'yap_difficulty',
  AUTO_MINT: 'yap_auto_mint',
  SHOW_BALANCE: 'yap_show_balance',
  HAPTIC_FEEDBACK: 'yap_haptic_feedback',
  FIRST_TIME_USER: 'yap_first_time_user',
  ONBOARDING_COMPLETE: 'yap_onboarding_complete',
  LAST_ACTIVE_DATE: 'yap_last_active_date',
  TOKEN_VERSION: 'yap_token_version',
  COMPLETE_APP_SETTINGS: 'yap_app_settings'
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private baseUrl = `${environment.apiUrl}/settings`;
  
  // Settings change subjects
  private themeSubject = new BehaviorSubject<ThemeOption>('system');
  private settingsSubject = new BehaviorSubject<AppSettings>(DEFAULT_SETTINGS);
  
  // Observable streams
  theme$ = this.themeSubject.asObservable();
  settings$ = this.settingsSubject.asObservable();
  
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService
  ) {
    this.loadAllSettings();
  }

  /** Read a boolean/JSON flag (returns undefined if not set). */
  async get<T = any>(key: string): Promise<T | undefined> {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  }

  /** Persist a flag. */
  async set(key: string, value: any): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
  
  /**
   * Remove a specific setting
   * @param key Setting key to remove
   */
  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
    return Promise.resolve();
  }
  
  /**
   * Clear all settings (reset to defaults)
   */
  async clear(): Promise<void> {
    // Only clear YAP-specific settings
    Object.values(SETTINGS_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Reset to defaults
    this.settingsSubject.next(DEFAULT_SETTINGS);
    this.themeSubject.next(DEFAULT_SETTINGS.theme);
    
    return Promise.resolve();
  }
  
  /**
   * Load all settings from storage and initialize subjects
   */
  private async loadAllSettings(): Promise<void> {
    try {
      // Try to load complete settings object first
      const completeSettings = await this.get<AppSettings>(SETTINGS_KEYS.COMPLETE_APP_SETTINGS);
      
      if (completeSettings) {
        // We have the complete settings object
        this.settingsSubject.next(completeSettings);
        this.themeSubject.next(completeSettings.theme);
        return;
      }
      
      // Otherwise, build settings from individual keys
      const settings = { ...DEFAULT_SETTINGS };
      
      // Load individual settings if available
      const theme = await this.get<ThemeOption>(SETTINGS_KEYS.THEME);
      if (theme) settings.theme = theme;
      
      const language = await this.get<string>(SETTINGS_KEYS.LANGUAGE);
      if (language) settings.language = language;
      
      const notifications = await this.get<boolean>(SETTINGS_KEYS.NOTIFICATIONS);
      if (notifications !== undefined) settings.notifications = notifications;
      
      const soundEffects = await this.get<boolean>(SETTINGS_KEYS.SOUND_EFFECTS);
      if (soundEffects !== undefined) settings.soundEffects = soundEffects;
      
      const dailyGoal = await this.get<number>(SETTINGS_KEYS.DAILY_GOAL);
      if (dailyGoal) settings.dailyGoal = dailyGoal;
      
      const difficulty = await this.get<DifficultyLevel>(SETTINGS_KEYS.DIFFICULTY);
      if (difficulty) settings.difficulty = difficulty;
      
      const autoMint = await this.get<boolean>(SETTINGS_KEYS.AUTO_MINT);
      if (autoMint !== undefined) settings.autoMint = autoMint;
      
      const showBalance = await this.get<boolean>(SETTINGS_KEYS.SHOW_BALANCE);
      if (showBalance !== undefined) settings.showBalance = showBalance;
      
      const hapticFeedback = await this.get<boolean>(SETTINGS_KEYS.HAPTIC_FEEDBACK);
      if (hapticFeedback !== undefined) settings.hapticFeedback = hapticFeedback;
      
      // Update subjects with loaded settings
      this.settingsSubject.next(settings);
      this.themeSubject.next(settings.theme);
      
      // Store complete settings for future use
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, settings);
    } catch (error) {
      console.error('Error loading settings:', error);
      // Fall back to defaults on error
      this.settingsSubject.next(DEFAULT_SETTINGS);
      this.themeSubject.next(DEFAULT_SETTINGS.theme);
    }
  }
  
  /**
   * Update application theme
   * @param theme Theme option to set
   */
  async updateTheme(theme: ThemeOption): Promise<void> {
    try {
      await this.set(SETTINGS_KEYS.THEME, theme);
      this.themeSubject.next(theme);
      
      // Update the complete settings object
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, theme };
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
      
      // Apply theme to document
      this.applyTheme(theme);
    } catch (error) {
      this.errorService.handleError(error, 'theme-update');
    }
  }
  
  /**
   * Update user preferred language
   * @param language Language code (e.g., 'en', 'es')
   */
  async updateLanguage(language: string): Promise<void> {
    try {
      await this.set(SETTINGS_KEYS.LANGUAGE, language);
      
      // Update the complete settings object
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, language };
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
    } catch (error) {
      this.errorService.handleError(error, 'language-update');
    }
  }
  
  /**
   * Update app difficulty level
   * @param level Difficulty level to set
   */
  async updateDifficulty(level: DifficultyLevel): Promise<void> {
    try {
      await this.set(SETTINGS_KEYS.DIFFICULTY, level);
      
      // Update the complete settings object
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, difficulty: level };
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
    } catch (error) {
      this.errorService.handleError(error, 'difficulty-update');
    }
  }
  
  /**
   * Update notification preferences
   * @param enabled Whether notifications should be enabled
   */
  async updateNotifications(enabled: boolean): Promise<void> {
    try {
      await this.set(SETTINGS_KEYS.NOTIFICATIONS, enabled);
      
      // Update the complete settings object
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, notifications: enabled };
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
    } catch (error) {
      this.errorService.handleError(error, 'notifications-update');
    }
  }
  
  /**
   * Update sound effect preferences
   * @param enabled Whether sound effects should be enabled
   */
  async updateSoundEffects(enabled: boolean): Promise<void> {
    try {
      await this.set(SETTINGS_KEYS.SOUND_EFFECTS, enabled);
      
      // Update the complete settings object
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, soundEffects: enabled };
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
    } catch (error) {
      this.errorService.handleError(error, 'sound-effects-update');
    }
  }
  
  /**
   * Update daily goal
   * @param goal Daily goal value
   */
  async updateDailyGoal(goal: number): Promise<void> {
    try {
      await this.set(SETTINGS_KEYS.DAILY_GOAL, goal);
      
      // Update the complete settings object
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, dailyGoal: goal };
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
    } catch (error) {
      this.errorService.handleError(error, 'daily-goal-update');
    }
  }
  
  /**
   * Update multiple settings at once
   * @param settings Partial settings object with values to update
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, ...settings };
      
      // Update all changed settings individually
      await Promise.all(
        Object.entries(settings).map(async ([key, value]) => {
          const settingKey = `yap_${key}`;
          await this.set(settingKey, value);
        })
      );
      
      // Update the complete settings object
      this.settingsSubject.next(updatedSettings);
      await this.set(SETTINGS_KEYS.COMPLETE_APP_SETTINGS, updatedSettings);
      
      // Update theme if it was changed
      if (settings.theme && settings.theme !== currentSettings.theme) {
        this.themeSubject.next(settings.theme);
        this.applyTheme(settings.theme);
      }
    } catch (error) {
      this.errorService.handleError(error, 'settings-update');
    }
  }
  
  /**
   * Apply theme to document
   * @param theme Theme to apply
   */
  private applyTheme(theme: ThemeOption): void {
    if (theme === 'system') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('dark-theme', prefersDark);
    } else {
      // Use explicit preference
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }
  }
  
  /**
   * Mark user as first time user
   * @param isFirstTime Whether the user is a first-time user
   */
  async setFirstTimeUser(isFirstTime: boolean): Promise<void> {
    await this.set(SETTINGS_KEYS.FIRST_TIME_USER, isFirstTime);
  }
  
  /**
   * Check if user is a first time user
   * @returns True if user is a first time user, false otherwise
   */
  async isFirstTimeUser(): Promise<boolean> {
    const value = await this.get<boolean>(SETTINGS_KEYS.FIRST_TIME_USER);
    return value !== false; // Treat undefined as first time user
  }
  
  /**
   * Mark onboarding as complete
   * @param isComplete Whether onboarding is complete
   */
  async setOnboardingComplete(isComplete: boolean): Promise<void> {
    await this.set(SETTINGS_KEYS.ONBOARDING_COMPLETE, isComplete);
  }
  
  /**
   * Check if onboarding is complete
   * @returns True if onboarding is complete, false otherwise
   */
  async isOnboardingComplete(): Promise<boolean> {
    const value = await this.get<boolean>(SETTINGS_KEYS.ONBOARDING_COMPLETE);
    return value === true;
  }
  
  /**
   * Save cloud settings (sync with server if available)
   */
  syncSettingsToCloud(walletAddress: string): Observable<boolean> {
    const settings = this.settingsSubject.value;
    
    return this.apiService.post<{success: boolean}>(
      'settings/sync', 
      { walletAddress, settings }
    ).pipe(
      map(response => response.success),
      catchError(error => {
        this.errorService.handleError(error, 'settings-sync');
        return throwError(() => error);
      })
    );
  }
}
