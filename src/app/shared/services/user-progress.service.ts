import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from '../../core/auth/auth.service';

export interface UserProgress {
  userId: string;
  ceferLevel: string;
  lessonsCompleted: number;
  totalLessons: number;
  wordsLearned: number;
  daysStreak: number;
  lastActive: Date;
  badges: UserBadge[];
  levelHistory: LevelHistoryEntry[];
}

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  dateEarned: Date;
  tokensRewarded: number;
}

export interface LevelHistoryEntry {
  level: string;
  startDate: Date;
  completionDate?: Date;
  percentComplete: number;
  lessonsCompleted?: number;
  wordsLearned?: number;
}

export interface LevelCompletion {
  level: string;
  requiredLessons: number;
  requiredWords: number;
  requiredTests: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserProgressService {
  private userProgressSubject = new BehaviorSubject<UserProgress | null>(null);
  public userProgress$ = this.userProgressSubject.asObservable();
  
  // Define the requirements for completing each CEFR level
  private levelCompletionRequirements: { [key: string]: LevelCompletion } = {
    'A1.1': { level: 'A1.1', requiredLessons: 5, requiredWords: 50, requiredTests: 2 },
    'A1.2': { level: 'A1.2', requiredLessons: 5, requiredWords: 50, requiredTests: 2 },
    'A1.3': { level: 'A1.3', requiredLessons: 5, requiredWords: 50, requiredTests: 2 },
    'A2.1': { level: 'A2.1', requiredLessons: 7, requiredWords: 75, requiredTests: 3 },
    'A2.2': { level: 'A2.2', requiredLessons: 7, requiredWords: 75, requiredTests: 3 },
    'A2.3': { level: 'A2.3', requiredLessons: 7, requiredWords: 75, requiredTests: 3 },
    'B1.1': { level: 'B1.1', requiredLessons: 10, requiredWords: 100, requiredTests: 4 },
    // More levels would be defined here
  };

  // Default progress for new users
  private defaultUserProgress: UserProgress = {
    userId: '',
    ceferLevel: 'A1.1',
    lessonsCompleted: 0,
    totalLessons: 5,
    wordsLearned: 0,
    daysStreak: 0,
    lastActive: new Date(),
    badges: [],
    levelHistory: [
      {
        level: 'A1.1',
        startDate: new Date(),
        percentComplete: 0,
        lessonsCompleted: 0,
        wordsLearned: 0
      }
    ]
  };

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {
    this.initializeUserProgress();
  }

  private initializeUserProgress(): void {
    // Check if user is logged in and load their progress
    if (this.authService.isLoggedIn) {
      this.loadUserProgress();
    }
    
    // Listen for login/logout events
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadUserProgress();
      } else {
        this.userProgressSubject.next(null);
      }
    });
  }

  /**
   * Load user progress from API
   */
  loadUserProgress(): Observable<UserProgress> {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      console.error('Cannot load user progress: User ID is not available');
      const defaultProgress = { ...this.defaultUserProgress };
      this.userProgressSubject.next(defaultProgress);
      return of(defaultProgress);
    }
    
    // Make API call to get user progress
    return this.apiService.get<UserProgress>(`api/user-progress/${userId}`).pipe(
      tap(progress => {
        progress.userId = userId;
        this.userProgressSubject.next(progress);
      }),
      catchError(error => {
        console.error('Error loading user progress:', error);
        // For new users or API errors, return default progress
        const defaultProgress = { ...this.defaultUserProgress, userId };
        this.userProgressSubject.next(defaultProgress);
        return of(defaultProgress);
      })
    );
  }

  /**
   * Get the current user's CEFR level
   */
  getCurrentLevel(): string | null {
    const progress = this.userProgressSubject.getValue();
    return progress?.ceferLevel || null;
  }
  
  /**
   * Get the current user progress state
   */
  getCurrentProgressValue(): UserProgress | null {
    return this.userProgressSubject.getValue();
  }

  /**
   * Update the user's current CEFR level
   */
  updateCurrentLevel(level: string): Observable<UserProgress> {
    const progress = this.userProgressSubject.getValue();
    
    if (!progress) {
      console.error('Cannot update level: No user progress available');
      const defaultProgress = { ...this.defaultUserProgress };
      return of(defaultProgress);
    }
    
    // Make API call to update user level
    return this.apiService.put<UserProgress>(`api/user-progress/${progress.userId}/level`, { level }).pipe(
      tap(updatedProgress => {
        this.userProgressSubject.next(updatedProgress);
      }),
      catchError(error => {
        console.error('Error updating user level:', error);
        // Fall back to local update if API fails
        const updatedProgress = { ...progress };
        updatedProgress.ceferLevel = level;
        
        // Add to level history if not already there
        const existingLevelEntry = updatedProgress.levelHistory.find((entry: LevelHistoryEntry) => entry.level === level);
        if (!existingLevelEntry) {
          updatedProgress.levelHistory.push({
            level,
            startDate: new Date(),
            percentComplete: 0,
            lessonsCompleted: 0,
            wordsLearned: 0
          });
        }
        
        this.userProgressSubject.next(updatedProgress);
        return of(updatedProgress);
      })
    );
  }

  /**
   * Record completion of a lesson
   */
  recordLessonCompletion(lessonId: string, wordsLearned: number): Observable<UserProgress> {
    const progress = this.userProgressSubject.getValue();
    
    if (!progress) {
      console.error('Cannot record lesson completion: No user progress available');
      const defaultProgress = { ...this.defaultUserProgress };
      return of(defaultProgress);
    }
    
    // Make API call to record lesson completion
    return this.apiService.post<UserProgress>(`api/user-progress/${progress.userId}/lessons`, { 
      lessonId, 
      wordsLearned 
    }).pipe(
      tap(updatedProgress => {
        this.userProgressSubject.next(updatedProgress);
      }),
      catchError(error => {
        console.error('Error recording lesson completion:', error);
        // Fall back to local update if API fails
        const updatedProgress = { ...progress };
        
        updatedProgress.lessonsCompleted += 1;
        updatedProgress.wordsLearned += wordsLearned;
        updatedProgress.lastActive = new Date();
        
        // Update level history
        const currentLevelEntry = updatedProgress.levelHistory.find(
          (entry: LevelHistoryEntry) => entry.level === updatedProgress.ceferLevel
        );
        
        // Initialize lessonsCompleted property if it doesn't exist
        if (currentLevelEntry && currentLevelEntry.lessonsCompleted === undefined) {
          currentLevelEntry.lessonsCompleted = 0;
          currentLevelEntry.wordsLearned = 0;
        }
        
        if (currentLevelEntry) {
          const levelReqs = this.levelCompletionRequirements[updatedProgress.ceferLevel];
          if (levelReqs) {
            // Increment lessons completed for this level
            currentLevelEntry.lessonsCompleted = (currentLevelEntry.lessonsCompleted || 0) + 1;
            currentLevelEntry.wordsLearned = (currentLevelEntry.wordsLearned || 0) + wordsLearned;
            
            // Calculate percentage based on level-specific lessons completed
            const percentComplete = Math.min(100, 
              (currentLevelEntry.lessonsCompleted / levelReqs.requiredLessons) * 100);
            currentLevelEntry.percentComplete = percentComplete;
            
            // Check if level is complete
            if (percentComplete >= 100) {
              currentLevelEntry.completionDate = new Date();
              // In a real app, you might trigger a level-up here
            }
          }
        }
        
        // Update streak logic
        const today = new Date().toISOString().split('T')[0];
        const lastActiveDate = updatedProgress.lastActive.toISOString().split('T')[0];
        
        if (today !== lastActiveDate) {
          // User completed a lesson on a new day
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          if (lastActiveDate === yesterdayStr) {
            // Consecutive day, increase streak
            updatedProgress.daysStreak += 1;
          } else {
            // Streak broken, restart
            updatedProgress.daysStreak = 1;
          }
        }
        
        this.userProgressSubject.next(updatedProgress);
        return of(updatedProgress);
      })
    );
  }

  /**
   * Check if the user should level up based on their progress
   */
  checkForLevelUp(): Observable<boolean> {
    const progress = this.userProgressSubject.getValue();
    
    if (!progress) {
      return of(false);
    }
    
    const currentLevel = progress.ceferLevel;
    const requirements = this.levelCompletionRequirements[currentLevel];
    
    if (!requirements) {
      return of(false);
    }
    
    const isComplete = 
      progress.lessonsCompleted >= requirements.requiredLessons && 
      progress.wordsLearned >= requirements.requiredWords;
      
    // In a real app, you might also check test scores
    
    return of(isComplete);
  }

  /**
   * Get the requirements for completing the current level
   */
  getCurrentLevelRequirements(): Observable<LevelCompletion | null> {
    const progress = this.userProgressSubject.getValue();
    
    if (!progress) {
      return of(null);
    }
    
    return of(this.levelCompletionRequirements[progress.ceferLevel] || null);
  }

  /**
   * Calculate the next CEFR level based on the current one
   */
  getNextLevel(currentLevel: string): string | null {
    const levels = [
      'A1.1', 'A1.2', 'A1.3', 
      'A2.1', 'A2.2', 'A2.3',
      'B1.1', 'B1.2', 'B1.3',
      'B2.1', 'B2.2', 'B2.3',
      'C1.1', 'C1.2', 'C1.3',
      'C2.1', 'C2.2', 'C2.3'
    ];
    
    const currentIndex = levels.indexOf(currentLevel);
    if (currentIndex === -1 || currentIndex === levels.length - 1) {
      return null;  // Current level not found or already at highest level
    }
    
    return levels[currentIndex + 1];
  }
}
