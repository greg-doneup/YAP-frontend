import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../api-service.service';

export interface AnalyticsEvent {
  eventName: string;
  properties?: Record<string, any>;
  timestamp?: number;
  userId?: string;
  sessionId?: string;
}

export interface UsageMetrics {
  dailyActiveUsers: number;
  sessionsCount: number;
  averageSessionDuration: number;
  completionRate: number;
  userRetention: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly apiUrl = `${environment.apiUrl}/observability`;
  private sessionId: string;
  private userId: string | null = null;
  private sessionStartTime: number;

  constructor(private apiService: ApiService) {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.trackEvent('session_start');
  }

  /**
   * Track a user event and send it to the observability service
   */
  trackEvent(eventName: string, properties: Record<string, any> = {}): void {
    const event: AnalyticsEvent = {
      eventName,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId || undefined
    };

    this.apiService.post('observability/events', event)
      .pipe(
        catchError(error => {
          console.error('Failed to track analytics event:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Track user learning progress
   */
  trackLearningProgress(lessonId: string, completed: boolean, score?: number): void {
    this.trackEvent('learning_progress', {
      lessonId,
      completed,
      score
    });
  }

  /**
   * Track voice practice results
   */
  trackVoicePractice(phraseId: string, accuracy: number, duration: number): void {
    this.trackEvent('voice_practice', {
      phraseId,
      accuracy, 
      duration
    });
  }

  /**
   * Track grammar check usage
   */
  trackGrammarCheck(text: string, corrections: number): void {
    this.trackEvent('grammar_check', {
      textLength: text.length,
      corrections
    });
  }

  /**
   * Get usage metrics for admin dashboard
   */
  getUsageMetrics(timeframe: 'day' | 'week' | 'month'): Observable<UsageMetrics> {
    return this.apiService.get<UsageMetrics>(`observability/metrics?timeframe=${timeframe}`)
      .pipe(
        catchError(error => {
          console.error('Failed to fetch analytics metrics:', error);
          return of({
            dailyActiveUsers: 0,
            sessionsCount: 0,
            averageSessionDuration: 0,
            completionRate: 0,
            userRetention: 0
          });
        })
      );
  }

  /**
   * Set the current user ID for analytics tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
    this.trackEvent('user_identified');
  }

  /**
   * End the current session and send session metrics
   */
  endSession(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    this.trackEvent('session_end', {
      duration: sessionDuration
    });
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
