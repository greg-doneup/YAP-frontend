import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { ApiService } from '../api-service.service';

/**
 * Vocabulary item model matching the backend schema
 */
export interface VocabItem {
  id?: string;
  term: string;
  translation: string;
  audioUrl?: string;
  difficulty?: number;
  examples?: string[];
  tags?: string[];
}

/**
 * Lesson model matching the backend schema
 */
export interface Lesson {
  _id?: string;
  lesson_id: string;
  language: string;
  level: string;
  focus: string;
  new_vocabulary: VocabItem[];
  speaking_exercises: SpeakingExercise[];
  review_points: string[];
}

/**
 * Speaking exercise model
 */
export interface SpeakingExercise {
  type: string;
  prompt: string;
  items: ExerciseItem[];
  leveling_note: string;
}

/**
 * Exercise item model
 */
export interface ExerciseItem {
  question: string;
  example_answer: string;
}

/**
 * User's lesson progress data
 */
export interface LessonProgress {
  currentLessonId: string;
  currentWordId: string;
  nextWordAvailableAt: string;
  completedLessons?: string[];
  completedWords?: string[];
  streak?: number;
  level?: number;
  totalXp?: number;
}

/**
 * Daily lesson completion results
 */
export interface LessonCompletion {
  pass: boolean;
  pronunciationScore: number;
  grammarScore: number;
  expected: string;
  corrected: string;
}

/**
 * Quiz submission result
 */
export interface QuizResult {
  score: number;
  pass: boolean;
  corrected: string;
  expected?: string;
}

/**
 * Progress statistics for the user
 */
export interface ProgressStats {
  completedLessons: number;
  completedQuizzes: number;
  totalXp: number;
  dailyStreak: number;
  level: number;
  nextLevelXp: number;
  levelProgress: number;
}

/**
 * Service for managing learning activities, including vocabulary, 
 * daily lessons, quizzes, and tracking user progress
 */
@Injectable({
  providedIn: 'root'
})
export class LearningService {
  private baseUrl = `${environment.apiUrl}`;
  
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService
  ) { }

  /**
   * Get today's vocabulary items for learning
   */
  getDailyVocab(): Observable<VocabItem[]> {
    return this.connectivityService.callWithRetry<VocabItem[]>(
      'learning/daily',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        retries: 2
      }
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'daily-vocab-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get quiz words for today
   */
  getTodaysQuiz(): Observable<{words: VocabItem[], expected: string}> {
    return this.apiService.get<{words: VocabItem[], expected: string}>('learning/quiz').pipe(
      catchError(error => {
        this.errorService.handleError(error, 'quiz-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Submit a daily lesson completion with audio recording
   * @param walletAddress User's wallet address
   * @param expectedWordId ID of the vocabulary word being practiced
   * @param audioRecording Audio blob of the user's pronunciation
   */
  submitLessonCompletion(
    walletAddress: string, 
    expectedWordId: string, 
    audioRecording: Blob
  ): Observable<LessonCompletion> {
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('wallet', walletAddress);
    formData.append('expectedId', expectedWordId);
    formData.append('audio', audioRecording, 'recording.wav');
    
    return this.apiService.post<LessonCompletion>('learning/daily/complete', formData).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'lesson-submission');
        return throwError(() => error);
      })
    );
  }

  /**
   * Submit a quiz answer
   * @param walletAddress User's wallet address
   * @param transcript The text answer provided by the user
   */
  submitQuizAnswer(walletAddress: string, transcript: string): Observable<QuizResult> {
    return this.apiService.post<QuizResult>('learning/quiz/submit', { wallet: walletAddress, transcript }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'quiz-submission');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's learning progress statistics
   * @param walletAddress User's wallet address
   */
  getUserProgress(walletAddress: string): Observable<ProgressStats> {
    return this.apiService.get<ProgressStats>(`learning/progress/${walletAddress}`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'progress-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's detailed lesson progress
   * @param userId User ID (can be wallet address)
   */
  getLessonProgress(userId: string): Observable<LessonProgress> {
    return this.apiService.get<LessonProgress>('learning/progress', { userId }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'lesson-progress-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user's lesson progress
   * @param userId User ID (can be wallet address)
   * @param progress Progress fields to update
   */
  updateLessonProgress(userId: string, progress: Partial<LessonProgress>): Observable<LessonProgress> {
    const payload = {
      userId,
      ...progress
    };
    
    return this.apiService.post<LessonProgress>('learning/progress', payload).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'lesson-progress-update');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get lesson details by lesson ID
   * @param lessonId The lesson ID to fetch
   */
  getLesson(lessonId: string): Observable<Lesson> {
    return this.apiService.get<Lesson>(`learning/lessons/${lessonId}`).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'lesson-fetch');
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Get lesson completion history
   * @param userId User ID (can be wallet address)
   * @param limit Maximum number of completions to return (default: 10)
   */
  getLessonHistory(userId: string, limit: number = 10): Observable<LessonCompletion[]> {
    return this.apiService.get<{completions: LessonCompletion[]}>('learning/progress/history', { 
      userId, 
      limit 
    }).pipe(
      map(response => response.completions || []),
      catchError(error => {
        this.errorService.handleError(error, 'lesson-history-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Search vocabulary items by term or translation
   * @param query Search query string
   */
  searchVocabulary(query: string): Observable<VocabItem[]> {
    return this.apiService.get<{items: VocabItem[]}>('learning/vocab/search', 
      { q: query }
    ).pipe(
      map(response => response.items || []),
      catchError(error => {
        this.errorService.handleError(error, 'vocab-search');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get vocabulary item by ID
   * @param id Vocabulary item ID
   */
  getVocabItem(id: string): Observable<VocabItem> {
    return this.apiService.get<{item: VocabItem}>(`learning/vocab/${id}`).pipe(
      map(response => response.item),
      catchError(error => {
        this.errorService.handleError(error, 'vocab-item-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get learning suggestions based on user's progress
   * @param walletAddress User's wallet address
   */
  getLearningRecommendations(walletAddress: string): Observable<VocabItem[]> {
    return this.apiService.get<{recommendations: VocabItem[]}>('learning/recommendations', 
      { wallet: walletAddress }
    ).pipe(
      map(response => response.recommendations || []),
      catchError(error => {
        this.errorService.handleError(error, 'recommendations-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if the user has completed today's lessons and quiz
   * @param walletAddress User's wallet address
   */
  getTodayCompletionStatus(walletAddress: string): Observable<{
    dailyLessonCompleted: boolean,
    dailyQuizCompleted: boolean
  }> {
    return this.apiService.get<{
      dailyLessonCompleted: boolean,
      dailyQuizCompleted: boolean
    }>('learning/completion-status', { wallet: walletAddress }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'completion-status-fetch');
        return throwError(() => error);
      })
    );
  }
}
