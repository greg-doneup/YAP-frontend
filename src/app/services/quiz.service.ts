import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../core/auth/auth.service';

export interface QuizQuestion {
  id: string;
  type: 'text' | 'pronunciation' | 'multiple_choice' | 'translation';
  cefrLevel: string;
  language: string;
  question: string;
  targetWord: string;
  context?: string;
  options?: string[]; // For multiple choice
  audioUrl?: string; // For pronunciation questions
  difficulty: number; // 1-5 scale
  source: 'lesson' | 'chat' | 'vocabulary'; // Where the word came from
  metadata?: {
    grammarFocus?: string;
    wordType?: string;
    frequencyScore?: number;
  };
}

export interface QuizSubmission {
  questionId: string;
  userAnswer?: string;
  audioData?: Blob;
  questionType: string;
  cefrLevel: string;
}

export interface QuizResult {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  feedback: string;
  pronunciationScore?: number;
  audioUrl?: string;
  detailedFeedback?: {
    grammarNotes?: string;
    pronunciationTips?: string;
    vocabularyContext?: string;
    cefrLevelAppropriate?: boolean;
  };
}

export interface QuizCompletionRequest {
  attempts: Array<{
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    points: number;
    feedback: string;
  }>;
  totalScore: number;
  cefrLevel: string;
}

export interface QuizCompletionResult {
  tokensEarned: number;
  totalPoints: number;
  accuracy: number;
  cefrLevelFeedback: string;
  wordsToReview: string[];
  nextQuizAvailable: Date;
}

export interface DailyQuizStatus {
  date: string;
  quizzesCompleted: number;
  maxDailyQuizzes: number;
  remainingQuizzes: number;
  tokensEarnedToday: number;
  pointsEarnedToday: number;
  canTakeQuiz: boolean;
  nextResetTime: Date;
}

export interface CefrQuizRequest {
  cefrLevel: string;
  includeRecentChatWords: boolean;
  questionCount: number;
  focusAreas?: string[]; // 'vocabulary', 'pronunciation', 'grammar'
  excludeWords?: string[]; // Words to avoid
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private currentQuizQuestionsSubject = new BehaviorSubject<QuizQuestion[]>([]);
  public currentQuizQuestions$ = this.currentQuizQuestionsSubject.asObservable();

  private baseUrl = '/quiz';

  constructor(
    private http: HttpClient,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  /**
   * Generate CEFR-based quiz questions
   */
  async generateCefrBasedQuiz(request: CefrQuizRequest): Promise<QuizQuestion[]> {
    try {
      const response = await this.http.post<{ questions: QuizQuestion[] }>(
        `${this.baseUrl}/generate-cefr-quiz`,
        {
          ...request,
          userId: this.authService.currentUserValue?.id
        }
      ).toPromise();

      const questions = response?.questions || [];
      this.currentQuizQuestionsSubject.next(questions);
      
      return questions;
    } catch (error) {
      console.error('Error generating CEFR quiz:', error);
      throw error;
    }
  }

  /**
   * Get current quiz questions
   */
  getQuizQuestions(): QuizQuestion[] {
    return this.currentQuizQuestionsSubject.value;
  }

  /**
   * Submit an answer to a quiz question
   */
  async submitAnswer(submission: QuizSubmission): Promise<QuizResult> {
    try {
      const formData = new FormData();
      formData.append('questionId', submission.questionId);
      formData.append('questionType', submission.questionType);
      formData.append('cefrLevel', submission.cefrLevel);
      formData.append('userId', this.authService.currentUserValue?.id || '');

      if (submission.userAnswer) {
        formData.append('userAnswer', submission.userAnswer);
      }

      if (submission.audioData) {
        formData.append('audioData', submission.audioData, 'quiz-answer.wav');
      }

      const response$ = this.http.post<QuizResult>(
        `${this.baseUrl}/submit-answer`,
        formData
      );

      return await response$.toPromise() as QuizResult;
    } catch (error) {
      console.error('Error submitting quiz answer:', error);
      throw error;
    }
  }

  /**
   * Complete quiz session and get final results
   */
  async completeQuiz(request: QuizCompletionRequest): Promise<QuizCompletionResult> {
    try {
      const response$ = this.http.post<QuizCompletionResult>(
        `${this.baseUrl}/complete`,
        {
          ...request,
          userId: this.authService.currentUserValue?.id
        }
      );

      const result = await response$.toPromise() as QuizCompletionResult;
      
      // Clear current quiz questions
      this.currentQuizQuestionsSubject.next([]);
      
      return result;
    } catch (error) {
      console.error('Error completing quiz:', error);
      throw error;
    }
  }

  /**
   * Get daily quiz status for the user
   */
  async getDailyQuizStatus(): Promise<DailyQuizStatus> {
    try {
      const response$ = this.http.get<DailyQuizStatus>(
        `${this.baseUrl}/daily-status`,
        {
          params: {
            userId: this.authService.currentUserValue?.id || ''
          }
        }
      );

      return await response$.toPromise() as DailyQuizStatus;
    } catch (error) {
      console.error('Error getting daily quiz status:', error);
      
      // Return default status on error
      return {
        date: new Date().toISOString().split('T')[0],
        quizzesCompleted: 0,
        maxDailyQuizzes: 4,
        remainingQuizzes: 4,
        tokensEarnedToday: 0,
        pointsEarnedToday: 0,
        canTakeQuiz: true,
        nextResetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  }

  /**
   * Get quiz history for the user
   */
  getQuizHistory(limit = 10): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/history`, {
      params: {
        userId: this.authService.currentUserValue?.id || '',
        limit: limit.toString()
      }
    }).pipe(
      catchError(error => {
        console.error('Error getting quiz history:', error);
        return of([]);
      })
    );
  }

  /**
   * Get quiz statistics
   */
  getQuizStatistics(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/statistics`, {
      params: {
        userId: this.authService.currentUserValue?.id || ''
      }
    }).pipe(
      catchError(error => {
        console.error('Error getting quiz statistics:', error);
        return of({});
      })
    );
  }

  /**
   * Get words from recent chat sessions for quiz generation
   */
  async getRecentChatWords(cefrLevel: string, limit = 20): Promise<string[]> {
    try {
      const response$ = this.http.get<{ words: string[] }>(
        `${this.baseUrl}/recent-chat-words`,
        {
          params: {
            userId: this.authService.currentUserValue?.id || '',
            cefrLevel,
            limit: limit.toString()
          }
        }
      );

      const response = await response$.toPromise();
      return response?.words || [];
    } catch (error) {
      console.error('Error getting recent chat words:', error);
      return [];
    }
  }

  /**
   * Report quiz question quality (for improvement)
   */
  reportQuestionQuality(questionId: string, rating: number, feedback?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/question-feedback`, {
      questionId,
      rating,
      feedback,
      userId: this.authService.currentUserValue?.id
    });
  }
}
