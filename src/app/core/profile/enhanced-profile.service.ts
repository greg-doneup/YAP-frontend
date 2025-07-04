import { Injectable } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../api-service.service';
import { ErrorService } from '../error/error.service';
import { DynamicLessonService } from '../dynamic-lesson/dynamic-lesson.service';

/**
 * Enhanced user profile with language management
 */
export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  initial_language_to_learn: string;
  interests?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Language change result
 */
export interface LanguageChangeResult {
  success: boolean;
  message: string;
  newLanguage: string;
  previousLanguage: string;
  progressReset: boolean;
}

/**
 * Profile service with language management capabilities
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private currentLanguageSubject = new BehaviorSubject<string>('spanish');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private dynamicLessonService: DynamicLessonService
  ) {
    this.loadUserLanguagePreference();
  }

  /**
   * Get user profile
   */
  getUserProfile(userId: string): Observable<UserProfile> {
    return this.apiService.get<UserProfile>(`profile/${userId}`).pipe(
      tap(profile => {
        // Update current language when profile is loaded
        if (profile.initial_language_to_learn) {
          this.currentLanguageSubject.next(profile.initial_language_to_learn);
        }
      }),
      catchError(error => {
        this.errorService.handleError(error, 'profile-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user profile
   */
  updateUserProfile(userId: string, updates: Partial<UserProfile>): Observable<void> {
    return this.apiService.put<void>(`profile/${userId}`, updates).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'profile-update');
        return throwError(() => error);
      })
    );
  }

  /**
   * Change user's target language and reset learning progress
   */
  changeTargetLanguage(
    userId: string, 
    newLanguage: string, 
    targetLevel: string = 'A1'
  ): Observable<LanguageChangeResult> {
    // First, check if the language is supported
    return new Observable<LanguageChangeResult>(observer => {
      this.dynamicLessonService.isLanguageSupported(newLanguage).subscribe({
        next: (isSupported) => {
          if (!isSupported) {
            observer.error(new Error(`Language ${newLanguage} is not supported for dynamic lesson generation`));
            return;
          }

          // Get current language for comparison
          const previousLanguage = this.currentLanguageSubject.value;

          if (previousLanguage === newLanguage) {
            observer.next({
              success: true,
              message: 'Language unchanged',
              newLanguage,
              previousLanguage,
              progressReset: false
            });
            observer.complete();
            return;
          }

          // Step 1: Update profile language preference
          this.updateUserProfile(userId, { 
            initial_language_to_learn: newLanguage 
          }).subscribe({
            next: () => {
              // Step 2: Reset learning progress via learning service
              this.dynamicLessonService.changeLanguage({
                userId,
                newLanguage,
                targetLevel
              }).subscribe({
                next: (changeResponse) => {
                  // Update local state
                  this.currentLanguageSubject.next(newLanguage);
                  this.saveLanguagePreference(newLanguage);
                  
                  const result: LanguageChangeResult = {
                    success: true,
                    message: changeResponse.message,
                    newLanguage,
                    previousLanguage,
                    progressReset: changeResponse.progressReset
                  };
                  
                  observer.next(result);
                  observer.complete();
                },
                error: (error) => {
                  this.errorService.handleError(error, 'learning-progress-reset');
                  observer.error(error);
                }
              });
            },
            error: (error) => {
              this.errorService.handleError(error, 'profile-language-update');
              observer.error(error);
            }
          });
        },
        error: (error) => {
          observer.error(error);
        }
      });
    }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'language-change');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get current target language
   */
  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  /**
   * Set current language (for local state management)
   */
  setCurrentLanguage(language: string): void {
    this.currentLanguageSubject.next(language);
  }

  /**
   * Check if user can change to a specific language
   */
  canChangeToLanguage(language: string): Observable<boolean> {
    return this.dynamicLessonService.isLanguageSupported(language);
  }

  /**
   * Get available CEFR levels for the current language
   */
  getAvailableLevelsForCurrentLanguage(): Observable<string[]> {
    const currentLanguage = this.getCurrentLanguage();
    return this.dynamicLessonService.getAvailableLevelsForLanguage(currentLanguage);
  }

  /**
   * Load user's language preference from storage or API
   */
  private loadUserLanguagePreference(): void {
    // Try to load from localStorage first
    const storedLanguage = localStorage.getItem('userTargetLanguage');
    if (storedLanguage) {
      this.currentLanguageSubject.next(storedLanguage);
    }

    // Update from API when available
    // This would typically be called after user authentication
  }

  /**
   * Save language preference to local storage
   */
  private saveLanguagePreference(language: string): void {
    localStorage.setItem('userTargetLanguage', language);
  }

  /**
   * Generate a welcome lesson for the new language
   */
  generateWelcomeLesson(userId: string, language: string): Observable<any> {
    return this.dynamicLessonService.generateBeginnerLesson(userId, language);
  }
}
