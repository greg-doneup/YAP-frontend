import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserProgressService } from './user-progress.service';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'practice' | 'quiz' | 'flashcard';
  level: string;
  progress: number;
  day: string;
  difficulty: number;
  estimatedTime: number;
  imageUrl?: string;
  isNextLevel?: boolean;
  isRecommended?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LessonService {
  private currentLevelSubject = new BehaviorSubject<string>('A1.1');
  public currentLevel$ = this.currentLevelSubject.asObservable();
  
  private todaysLessonsSubject = new BehaviorSubject<Lesson[]>([]);
  public todaysLessons$ = this.todaysLessonsSubject.asObservable();

  // Mock data for development until backend is ready
  private mockLessons: { [key: string]: Lesson[] } = {
    'A1.1': [
      {
        id: 'a11-greetings-1',
        title: 'Greetings',
        description: 'Learn basic greetings and introductions',
        type: 'practice',
        level: 'A1.1',
        progress: 25,
        day: 'Mon',
        difficulty: 1,
        estimatedTime: 10,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      },
      {
        id: 'a11-numbers-1',
        title: 'Numbers 1-10',
        description: 'Learn counting from 1 to 10',
        type: 'practice',
        level: 'A1.1',
        progress: 0,
        day: 'Tue',
        difficulty: 1,
        estimatedTime: 8,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      },
      {
        id: 'a11-basics-1',
        title: 'Basic Conversation',
        description: 'Learn your first conversation phrases',
        type: 'practice',
        level: 'A1.1',
        progress: 0,
        day: 'Wed',
        difficulty: 1,
        estimatedTime: 12,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      },
      {
        id: 'a11-quiz-1',
        title: 'Beginner Quiz 1',
        description: 'Test your knowledge of basic greetings and numbers',
        type: 'quiz',
        level: 'A1.1',
        progress: 0,
        day: 'Thu',
        difficulty: 1,
        estimatedTime: 5,
        imageUrl: 'assets/images/lesson-quiz.jpg'
      },
      {
        id: 'a11-phrases-1',
        title: 'Useful Phrases',
        description: 'Essential phrases for everyday communication',
        type: 'practice',
        level: 'A1.1',
        progress: 0,
        day: 'Fri',
        difficulty: 1,
        estimatedTime: 15,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      },
      {
        id: 'a11-review-1',
        title: 'Week 1 Review',
        description: 'Review everything you learned this week',
        type: 'flashcard',
        level: 'A1.1',
        progress: 0,
        day: 'Sat',
        difficulty: 1,
        estimatedTime: 10,
        imageUrl: 'assets/images/lesson-flashcard.jpg'
      },
      {
        id: 'a11-challenge-1',
        title: 'Weekend Challenge',
        description: 'Test your skills with harder exercises',
        type: 'quiz',
        level: 'A1.1',
        progress: 0,
        day: 'Sun',
        difficulty: 2,
        estimatedTime: 8,
        imageUrl: 'assets/images/lesson-quiz.jpg'
      }
    ],
    'A1.2': [
      {
        id: 'a12-family-1',
        title: 'Family Members',
        description: 'Learn vocabulary for immediate family',
        type: 'practice',
        level: 'A1.2',
        progress: 0,
        day: 'Mon',
        difficulty: 2,
        estimatedTime: 15,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      }
    ],
    'A2.1': [
      {
        id: 'a21-routines-1',
        title: 'Daily Routines',
        description: 'Learn to describe your daily activities',
        type: 'practice',
        level: 'A2.1',
        progress: 0,
        day: 'Mon',
        difficulty: 3,
        estimatedTime: 15,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      }
    ],
    'B1.1': [
      {
        id: 'b11-experiences-1',
        title: 'Past Experiences',
        description: 'Talk about things you\'ve done',
        type: 'practice',
        level: 'B1.1',
        progress: 0,
        day: 'Mon',
        difficulty: 4,
        estimatedTime: 20,
        imageUrl: 'assets/images/card-banner/yap_composed_banner.jpg'
      }
    ]
  };

  private recommendedLessonsSubject = new BehaviorSubject<Lesson[]>([]);
  public recommendedLessons$ = this.recommendedLessonsSubject.asObservable();
  
  private nextUncompletedLessonSubject = new BehaviorSubject<Lesson | null>(null);
  public nextUncompletedLesson$ = this.nextUncompletedLessonSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private userProgressService: UserProgressService
  ) {
    // When user progress changes, update recommended lessons
    this.userProgressService.userProgress$.subscribe(progress => {
      if (progress) {
        this.setCurrentLevel(progress.ceferLevel);
        this.updateRecommendedLessons();
      }
    });
  }

  /**
   * Sets the current CEFR level for lessons
   */
  setCurrentLevel(level: string): void {
    if (this.currentLevelSubject.getValue() !== level) {
      this.currentLevelSubject.next(level);
      // When level changes, update today's lessons
      const currentDay = new Date().toLocaleString('en-us', { weekday: 'short' });
      this.loadLessonsForDay(currentDay);
    }
  }

  /**
   * Gets the current CEFR level
   */
  getCurrentLevel(): string {
    return this.currentLevelSubject.getValue();
  }

  /**
   * Load lessons based on level and day of the week
   * In production, this would call the API
   */
  loadLessonsForDay(day: string): Observable<Lesson[]> {
    const level = this.currentLevelSubject.getValue();
    
    // In a real app with API
    // return this.apiService.get<Lesson[]>(`lessons`, { level: level, day: day })
    //   .pipe(
    //     tap(lessons => this.todaysLessonsSubject.next(lessons)),
    //     catchError(error => {
    //       console.error('Error loading lessons:', error);
    //       return of([]);
    //     })
    //   );
    
    // For now, use mock data
    return of(this.getMockLessonsForLevelAndDay(level, day))
      .pipe(
        tap(lessons => this.todaysLessonsSubject.next(lessons))
      );
  }

  /**
   * Get all available lessons for a specific CEFR level
   */
  getLessonsForLevel(level: string): Observable<Lesson[]> {
    // In a real app with API
    // return this.apiService.get<Lesson[]>(`lessons`, { level: level });
    
    // For now, use mock data
    return of(this.getMockLessonsForLevel(level));
  }

  /**
   * Get a specific lesson by ID
   */
  getLessonById(lessonId: string): Observable<Lesson | null> {
    // In a real app with API
    // return this.apiService.get<Lesson>(`lessons/${lessonId}`);
    
    // For now, use mock data
    const allLessons = Object.values(this.mockLessons).flat();
    const lesson = allLessons.find(l => l.id === lessonId) || null;
    return of(lesson);
  }

  /**
   * Update a lesson's progress
   */
  updateLessonProgress(lessonId: string, progress: number): Observable<Lesson> {
    // In a real app with API
    // return this.apiService.put<Lesson>(`lessons/${lessonId}/progress`, { progress });
    
    // For now, update mock data
    const allLessons = Object.values(this.mockLessons).flat();
    const lesson = allLessons.find(l => l.id === lessonId);
    
    if (lesson) {
      lesson.progress = progress;
      // Update the subject to trigger updates in components
      this.todaysLessonsSubject.next([...this.todaysLessonsSubject.getValue()]);
    }
    
    return of(lesson as Lesson);
  }

  /**
   * Helper to get mock lessons for a level and day
   */
  private getMockLessonsForLevelAndDay(level: string, day: string): Lesson[] {
    if (!this.mockLessons[level]) {
      return [];
    }
    
    return this.mockLessons[level].filter(lesson => 
      lesson.day.toLowerCase() === day.toLowerCase()
    );
  }
  
  /**
   * Get recommended lessons for the user based on their level and progress
   */
  updateRecommendedLessons(): void {
    const currentLevel = this.currentLevelSubject.getValue();
    const allLevelLessons = this.getMockLessonsForLevel(currentLevel);
    
    // 1. First, get any uncompleted lessons
    const uncompletedLessons = allLevelLessons.filter(lesson => lesson.progress < 100);
    
    if (uncompletedLessons.length > 0) {
      // Sort by progress (show partially completed lessons first)
      const sortedLessons = [...uncompletedLessons].sort((a, b) => {
        // First prioritize lessons with some progress
        if (a.progress > 0 && b.progress === 0) return -1;
        if (a.progress === 0 && b.progress > 0) return 1;
        
        // Then prioritize by difficulty
        return a.difficulty - b.difficulty;
      });
      
      this.recommendedLessonsSubject.next(sortedLessons.slice(0, 3));
      this.nextUncompletedLessonSubject.next(sortedLessons[0] || null);
    } else {
      // All lessons completed, suggest moving to next level or review
      const nextLevel = this.userProgressService.getNextLevel(currentLevel);
      if (nextLevel) {
        // Get lessons from the next level as recommendations
        const nextLevelLessons = this.getMockLessonsForLevel(nextLevel);
        if (nextLevelLessons.length > 0) {
          // Sort by difficulty
          const sortedNextLessons = [...nextLevelLessons].sort((a, b) => a.difficulty - b.difficulty);
          
          // Add a special flag to indicate these are from the next level
          const recommendedNextLevelLessons = sortedNextLessons.slice(0, 3).map(lesson => ({
            ...lesson,
            isNextLevel: true
          }));
          
          this.recommendedLessonsSubject.next(recommendedNextLevelLessons);
          this.nextUncompletedLessonSubject.next(sortedNextLessons[0] || null);
          return;
        }
      }
      
      // If no next level or no lessons in next level, return empty
      this.recommendedLessonsSubject.next([]);
      this.nextUncompletedLessonSubject.next(null);
    }
  }
  
  /**
   * Get the next lesson the user should complete
   */
  getNextLesson(): Observable<Lesson | null> {
    return this.nextUncompletedLesson$;
  }
  
  /**
   * Get recommended lessons for today based on user's progress
   */
  getRecommendedLessons(): Observable<Lesson[]> {
    return this.recommendedLessons$;
  }
  
  /**
   * Complete a lesson and update user progress
   */
  completeLesson(lessonId: string, wordsLearned: number = 5): Observable<Lesson> {
    return this.updateLessonProgress(lessonId, 100).pipe(
      tap(lesson => {
        // Also update user progress
        this.userProgressService.recordLessonCompletion(lessonId, wordsLearned)
          .subscribe(() => {
            // After updating user progress, refresh recommended lessons
            this.updateRecommendedLessons();
          });
      })
    );
  }

  /**
   * Helper to get all mock lessons for a level
   */
  private getMockLessonsForLevel(level: string): Lesson[] {
    return this.mockLessons[level] || [];
  }
}
