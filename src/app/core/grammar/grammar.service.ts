import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { ApiService } from '../api-service.service';

/**
 * Vocabulary item model that matches the backend schema
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
 * Grammar evaluation results from backend
 */
export interface GrammarEvaluation {
  score: number;
  corrected: string;
  issues?: string[];
}

/**
 * Quiz submission result
 */
export interface QuizResult {
  score: number;
  pass: boolean;
  corrected: string;
}

/**
 * Daily completion result
 */
export interface DailyCompletion {
  pass: boolean;
  pronunciationScore: number;
  grammarScore: number;
  expected: string;
  corrected: string;
  timestamp?: string;
}

/**
 * Grammar service that interfaces with the YAP backend grammar service
 * Handles vocabulary, grammar evaluation, and learning progress
 */
@Injectable({
  providedIn: 'root'
})
export class GrammarService {
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService
  ) { }

  /**
   * Get available vocabulary items
   */
  getVocabulary(): Observable<VocabItem[]> {
    return this.apiService.get<{vocab: VocabItem[]}>('learning/vocab')
      .pipe(
        map(response => response.vocab || []),
        catchError(error => {
          this.errorService.handleError(error, 'vocab-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a specific vocabulary item by ID
   */
  getVocabItem(id: string): Observable<VocabItem> {
    return this.apiService.get<{item: VocabItem}>(`learning/vocab/${id}`)
      .pipe(
        map(response => response.item),
        catchError(error => {
          this.errorService.handleError(error, 'vocab-item-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get multiple vocabulary items by their IDs
   */
  getVocabItems(ids: string[]): Observable<VocabItem[]> {
    return this.apiService.post<{items: VocabItem[]}>('learning/vocab', { ids })
      .pipe(
        map(response => response.items || []),
        catchError(error => {
          this.errorService.handleError(error, 'vocab-items-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get today's vocabulary items for learning
   */
  getTodaysVocab(): Observable<VocabItem[]> {
    return this.apiService.get<{vocab: VocabItem[]}>('learning/daily/vocab')
      .pipe(
        map(response => response.vocab || []),
        catchError(error => {
          this.errorService.handleError(error, 'daily-vocab-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Evaluate text for grammar correctness
   * @param text The text to evaluate
   * @param expected Optional expected text for comparison
   * @param lang Optional language code (defaults to 'en')
   */
  evaluateGrammar(text: string, expected?: string, lang: string = 'en'): Observable<GrammarEvaluation> {
    return this.apiService.post<GrammarEvaluation>('grammar/evaluate', { 
      text, 
      expected,
      lang
    }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'grammar-eval');
        return throwError(() => error);
      })
    );
  }

  /**
   * Submit a daily quiz answer
   * @param walletAddress The user's blockchain wallet address
   * @param transcript The user's quiz answer
   */
  submitQuizAnswer(walletAddress: string, transcript: string): Observable<QuizResult> {
    // Using the connectivity service for retries in this specific case
    return this.connectivityService.callWithRetry<QuizResult>(
      'learning/quiz/submit', 
      {
        method: 'POST',
        body: { wallet: walletAddress, transcript }
      }
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'quiz-submit');
        return throwError(() => error);
      })
    );
  }

  /**
   * Submit a daily practice completion
   * @param walletAddress The user's blockchain wallet address
   * @param transcript The user's practice answer
   * @param audioRecording Optional audio recording blob
   */
  submitDailyCompletion(
    walletAddress: string,
    transcript: string,
    audioRecording?: Blob
  ): Observable<DailyCompletion> {
    // Create a FormData object if we have an audio recording
    let payload: FormData | {wallet: string, transcript: string};
    
    if (audioRecording) {
      const formData = new FormData();
      formData.append('wallet', walletAddress);
      formData.append('transcript', transcript);
      formData.append('audio', audioRecording, 'recording.wav');
      payload = formData;
    } else {
      payload = { wallet: walletAddress, transcript };
    }
    
    return this.apiService.post<DailyCompletion>(
      'learning/daily/complete', 
      payload
    ).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'daily-completion');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's daily completion results
   * @param walletAddress The user's blockchain wallet address
   * @param date Optional date in YYYY-MM-DD format (defaults to today)
   */
  getDailyResults(walletAddress: string, date?: string): Observable<DailyCompletion[]> {
    const params: Record<string, string> = { wallet: walletAddress };
    if (date) {
      params['date'] = date; // Using bracket notation to access property on index signature
    }
    
    return this.apiService.get<{results: DailyCompletion[]}>('learning/daily/results', { params })
      .pipe(
        map(response => response.results || []),
        catchError(error => {
          this.errorService.handleError(error, 'results-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get suggested sentence for vocab items
   * @param vocabItems Array of vocabulary items
   */
  getSuggestedSentence(vocabItems: VocabItem[]): Observable<string> {
    return this.apiService.post<{sentence: string}>(
      'learning/suggest-sentence', 
      { items: vocabItems.map(item => item.id) }
    ).pipe(
      map(response => response.sentence),
      catchError(error => {
        this.errorService.handleError(error, 'sentence-suggestion');
        return throwError(() => error);
      })
    );
  }

  /**
   * Generate example sentences for a vocabulary term
   * @param term The vocabulary term to generate examples for
   * @param count Number of examples to generate (default: 3)
   */
  generateExamples(term: string, count: number = 3): Observable<string[]> {
    return this.apiService.post<{examples: string[]}>('grammar/examples', { term, count })
      .pipe(
        map(response => response.examples || []),
        catchError(error => {
          this.errorService.handleError(error, 'examples-generation');
          return throwError(() => error);
        })
      );
  }
}
