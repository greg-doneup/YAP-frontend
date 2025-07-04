import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../api-service.service';
import { ErrorService } from '../error/error.service';
import { Lesson } from '../learning/learning.service';

/**
 * Dynamic lesson generation request
 */
export interface DynamicLessonRequest {
  userId: string;
  language: string;
  cefrLevel: string;
  skillFocus?: string;
  duration?: number;
  forceRegenerate?: boolean;
}

/**
 * Dynamic lesson response
 */
export interface DynamicLessonResponse {
  lesson: Lesson;
  cached: boolean;
  generatedAt: string;
  metadata: {
    userId: string;
    language: string;
    cefrLevel: string;
    skillFocus: string;
    duration: number;
    qualityScore: number;
    personalizationFactors: any;
  };
  qualityScore?: number;
}

/**
 * Language change request
 */
export interface LanguageChangeRequest {
  userId: string;
  newLanguage: string;
  targetLevel: string;
}

/**
 * Language change response
 */
export interface LanguageChangeResponse {
  message: string;
  newLanguage: string;
  targetLevel: string;
  previousLanguage: string;
  progressReset: boolean;
  starterLessonsAvailable: number;
  nextSteps: {
    generateFirstLesson: string;
    parameters: any;
  };
}

/**
 * Available language info
 */
export interface LanguageInfo {
  code: string;
  name: string;
  levels: string[];
}

/**
 * Service for dynamic lesson generation and language management
 */
@Injectable({
  providedIn: 'root'
})
export class DynamicLessonService {

  constructor(
    private apiService: ApiService,
    private errorService: ErrorService
  ) {}

  /**
   * Generate a dynamic CEFR-compliant lesson
   */
  generateLesson(request: DynamicLessonRequest): Observable<DynamicLessonResponse> {
    return this.apiService.post<DynamicLessonResponse>('learning/dynamic-lessons/generate', request).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'dynamic-lesson-generation');
        return throwError(() => error);
      })
    );
  }

  /**
   * Change user's target language and reset progress
   */
  changeLanguage(request: LanguageChangeRequest): Observable<LanguageChangeResponse> {
    return this.apiService.put<LanguageChangeResponse>('learning/dynamic-lessons/language', request).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'language-change');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get available languages for dynamic lesson generation
   */
  getAvailableLanguages(): Observable<{
    languages: LanguageInfo[];
    totalLanguages: number;
    features: {
      dynamicGeneration: boolean;
      cefrCompliant: boolean;
      personalized: boolean;
      progressTracking: boolean;
    };
  }> {
    return this.apiService.get<{
      languages: LanguageInfo[];
      totalLanguages: number;
      features: {
        dynamicGeneration: boolean;
        cefrCompliant: boolean;
        personalized: boolean;
        progressTracking: boolean;
      };
    }>('learning/dynamic-lessons/available-languages').pipe(
      catchError(error => {
        this.errorService.handleError(error, 'available-languages-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Generate a beginner lesson for a specific language
   */
  generateBeginnerLesson(userId: string, language: string): Observable<DynamicLessonResponse> {
    const request: DynamicLessonRequest = {
      userId,
      language,
      cefrLevel: 'A1',
      skillFocus: 'basics',
      duration: 15
    };

    return this.generateLesson(request);
  }

  /**
   * Generate a lesson focused on a specific skill
   */
  generateSkillFocusedLesson(
    userId: string, 
    language: string, 
    cefrLevel: string, 
    skill: 'vocabulary' | 'grammar' | 'conversation' | 'pronunciation'
  ): Observable<DynamicLessonResponse> {
    const request: DynamicLessonRequest = {
      userId,
      language,
      cefrLevel,
      skillFocus: skill,
      duration: 20
    };

    return this.generateLesson(request);
  }

  /**
   * Check if a language is supported for dynamic generation
   */
  isLanguageSupported(languageCode: string): Observable<boolean> {
    return this.getAvailableLanguages().pipe(
      map(response => response.languages.some(lang => lang.code === languageCode))
    );
  }

  /**
   * Get CEFR levels available for a language
   */
  getAvailableLevelsForLanguage(languageCode: string): Observable<string[]> {
    return this.getAvailableLanguages().pipe(
      map(response => {
        const language = response.languages.find(lang => lang.code === languageCode);
        return language ? language.levels : [];
      })
    );
  }

  /**
   * Regenerate a lesson (force new generation instead of using cache)
   */
  regenerateLesson(request: DynamicLessonRequest): Observable<DynamicLessonResponse> {
    const regenerateRequest = { ...request, forceRegenerate: true };
    return this.generateLesson(regenerateRequest);
  }
}
