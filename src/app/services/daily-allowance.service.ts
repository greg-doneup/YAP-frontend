import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../core/api-service.service';

export interface DailyAllowance {
  featureName: string;
  dailyLimit: number;
  used: number;
  remaining: number;
  resetTime: Date;
}

export interface LessonAccess {
  canAccessLesson: boolean;
  requiresTokens: boolean;
  tokenCost: number;
  allowanceRemaining: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class DailyAllowanceService {
  private dailyAllowancesSubject = new BehaviorSubject<DailyAllowance[]>([]);
  public dailyAllowances$ = this.dailyAllowancesSubject.asObservable();

  // Default allowances for new users
  private defaultAllowances: DailyAllowance[] = [
    {
      featureName: 'Daily Lessons',
      dailyLimit: 5,
      used: 0,
      remaining: 5,
      resetTime: this.getNextMidnightUTC()
    },
    {
      featureName: 'AI Chat',
      dailyLimit: 15, // 15 minutes
      used: 0,
      remaining: 15,
      resetTime: this.getNextMidnightUTC()
    }
  ];

  constructor(private apiService: ApiService) {
    this.initializeAllowances();
  }

  private initializeAllowances(): void {
    // Try to load from API, fallback to local storage, then default
    this.loadDailyAllowances().subscribe({
      next: (allowances) => {
        this.dailyAllowancesSubject.next(allowances);
      },
      error: (error) => {
        console.warn('Failed to load allowances from API, using defaults:', error);
        this.checkAndResetDailyAllowances();
        this.dailyAllowancesSubject.next([...this.defaultAllowances]);
      }
    });
  }

  private loadDailyAllowances(): Observable<DailyAllowance[]> {
    return this.apiService.get<DailyAllowance[]>('/daily-allowances').pipe(
      tap((allowances: DailyAllowance[]) => {
        // Convert date strings back to Date objects
        allowances.forEach(allowance => {
          allowance.resetTime = new Date(allowance.resetTime);
        });
      }),
      catchError(() => {
        // Fallback to stored allowances or defaults
        const stored = localStorage.getItem('dailyAllowances');
        if (stored) {
          const allowances = JSON.parse(stored);
          allowances.forEach((allowance: DailyAllowance) => {
            allowance.resetTime = new Date(allowance.resetTime);
          });
          return of(allowances);
        }
        return of([...this.defaultAllowances]);
      })
    );
  }

  private getNextMidnightUTC(): Date {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    return midnight;
  }

  private checkAndResetDailyAllowances(): void {
    const now = new Date();
    
    this.defaultAllowances.forEach((allowance: DailyAllowance) => {
      if (now >= allowance.resetTime) {
        // Reset the allowance
        allowance.used = 0;
        allowance.remaining = allowance.dailyLimit;
        allowance.resetTime = this.getNextMidnightUTC();
      }
    });
  }

  /**
   * Check if user can access a lesson
   */
  canAccessLesson(): Observable<LessonAccess> {
    const currentAllowances = this.dailyAllowancesSubject.value;
    const lessonAllowance = currentAllowances.find((a: DailyAllowance) => a.featureName === 'Daily Lessons');
    
    if (!lessonAllowance) {
      return new BehaviorSubject<LessonAccess>({
        canAccessLesson: false,
        requiresTokens: false,
        tokenCost: 0,
        allowanceRemaining: 0,
        message: 'Allowance data not found'
      });
    }

    const access: LessonAccess = {
      canAccessLesson: lessonAllowance.remaining > 0,
      requiresTokens: lessonAllowance.remaining === 0,
      tokenCost: lessonAllowance.remaining === 0 ? 1 : 0,
      allowanceRemaining: lessonAllowance.remaining,
      message: lessonAllowance.remaining > 0 
        ? `${lessonAllowance.remaining} free lessons remaining today`
        : 'Daily limit reached. 1 YAP token required per lesson.'
    };

    return new BehaviorSubject<LessonAccess>(access);
  }

  /**
   * Use a lesson from the daily allowance
   */
  useLessonAllowance(): void {
    const currentAllowances = this.dailyAllowancesSubject.value;
    const lessonAllowance = currentAllowances.find((a: DailyAllowance) => a.featureName === 'Daily Lessons');
    
    if (lessonAllowance && lessonAllowance.remaining > 0) {
      lessonAllowance.used += 1;
      lessonAllowance.remaining -= 1;
      
      // Update the backend
      this.updateAllowanceUsage('Daily Lessons', lessonAllowance.used).subscribe();
      
      // Update subscribers
      this.dailyAllowancesSubject.next([...currentAllowances]);
    }
  }

  /**
   * Purchase unlimited lessons for the day with tokens
   */
  purchaseUnlimitedLessons(duration: 'day' | 'week' | 'month'): Observable<boolean> {
    // TODO: Integrate with token service
    const cost = duration === 'day' ? 3 : duration === 'week' ? 20 : 75;
    
    console.log(`Purchasing unlimited lessons for ${duration} at cost of ${cost} YAP tokens`);
    
    // For now, just return success
    return new BehaviorSubject<boolean>(true);
  }

  /**
   * Update allowance usage on the backend
   */
  private updateAllowanceUsage(featureName: string, used: number): Observable<any> {
    return this.apiService.put(`/daily-allowances/usage`, {
      featureName,
      used,
      timestamp: new Date().toISOString()
    }).pipe(
      catchError((error) => {
        console.warn('Failed to update allowance usage on backend:', error);
        return of(null);
      })
    );
  }

  /**
   * Get current daily allowances
   */
  getCurrentAllowances(): DailyAllowance[] {
    return this.dailyAllowancesSubject.value;
  }

  /**
   * Check if feature has remaining allowance
   */
  hasAllowanceRemaining(featureName: string): boolean {
    const currentAllowances = this.dailyAllowancesSubject.value;
    const allowance = currentAllowances.find((a: DailyAllowance) => a.featureName === featureName);
    return allowance ? allowance.remaining > 0 : false;
  }
}
