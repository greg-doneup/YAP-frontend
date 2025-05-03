import { Injectable } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ErrorService } from '../error/error.service';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of operations allowed within the time window
   */
  maxOperations: number;
  
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  
  /**
   * Optional error message when rate limit is exceeded
   */
  message?: string;
}

/**
 * Default configurations for different service types
 */
export const DEFAULT_CONFIGS = {
  /**
   * Default API rate limit: 60 requests per minute
   */
  API: {
    maxOperations: 60,
    windowMs: 60000,
    message: 'API rate limit exceeded. Please try again later.'
  },
  
  /**
   * Voice recording rate limit: 20 recordings per minute
   */
  VOICE: {
    maxOperations: 20,
    windowMs: 60000,
    message: 'Voice recording rate limit exceeded. Please try again later.'
  },
  
  /**
   * Learning rate limit: 30 lesson completions per day (86400000ms = 24h)
   */
  LEARNING: {
    maxOperations: 30,
    windowMs: 86400000,
    message: 'Daily learning limit reached. Please come back tomorrow.'
  }
};

/**
 * Service to manage rate limiting for different operations
 * Prevents abuse and excessive use of resources
 */
@Injectable({
  providedIn: 'root'
})
export class RateLimiterService {
  /**
   * Map of limiters indexed by key
   */
  private limiters = new Map<string, {
    operations: number;
    resetTimestamp: number;
    config: RateLimitConfig;
  }>();

  constructor(private errorService: ErrorService) { }

  /**
   * Check if an operation is allowed based on rate limiting
   * @param key Identifier for the specific rate limiter
   * @param config Rate limit configuration
   * @returns Whether the operation is allowed
   */
  checkLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIGS.API): boolean {
    const now = Date.now();
    
    // Get or initialize limiter
    if (!this.limiters.has(key)) {
      this.initializeLimiter(key, config);
    }
    
    const limiter = this.limiters.get(key)!;
    
    // Reset counter if window has passed
    if (now > limiter.resetTimestamp) {
      limiter.operations = 0;
      limiter.resetTimestamp = now + limiter.config.windowMs;
    }
    
    // Check if under limit
    return limiter.operations < limiter.config.maxOperations;
  }

  /**
   * Execute an operation if it's allowed by rate limiting
   * @param key Identifier for the specific rate limiter
   * @param operation Function to execute if allowed
   * @param config Rate limit configuration
   * @returns Observable of the operation result or error
   */
  executeIfAllowed<T>(
    key: string, 
    operation: () => Observable<T>,
    config: RateLimitConfig = DEFAULT_CONFIGS.API
  ): Observable<T> {
    // Check if operation is allowed
    if (this.checkLimit(key, config)) {
      // Increment operation counter
      const limiter = this.limiters.get(key)!;
      limiter.operations++;
      
      // Execute operation
      return operation();
    } else {
      // Rate limit exceeded
      const limiter = this.limiters.get(key)!;
      const timeRemaining = limiter.resetTimestamp - Date.now();
      
      const errorMessage = limiter.config.message || 
        `Rate limit exceeded. Please try again in ${Math.ceil(timeRemaining / 1000)} seconds.`;
      
      this.errorService.handleError(new Error(errorMessage), 'rate-limit-exceeded');
      return throwError(() => new Error(errorMessage));
    }
  }

  /**
   * Reset a specific rate limiter
   * @param key Identifier for the specific rate limiter
   */
  resetLimit(key: string): void {
    if (this.limiters.has(key)) {
      const limiter = this.limiters.get(key)!;
      limiter.operations = 0;
      limiter.resetTimestamp = Date.now() + limiter.config.windowMs;
    }
  }

  /**
   * Get the number of operations remaining for a specific rate limiter
   * @param key Identifier for the specific rate limiter
   * @returns Number of operations remaining or -1 if limiter doesn't exist
   */
  getRemainingOperations(key: string): number {
    if (!this.limiters.has(key)) {
      return -1;
    }
    
    const limiter = this.limiters.get(key)!;
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now > limiter.resetTimestamp) {
      limiter.operations = 0;
      limiter.resetTimestamp = now + limiter.config.windowMs;
    }
    
    return limiter.config.maxOperations - limiter.operations;
  }

  /**
   * Get the time remaining until a specific rate limiter resets
   * @param key Identifier for the specific rate limiter
   * @returns Time remaining in milliseconds or -1 if limiter doesn't exist
   */
  getTimeRemaining(key: string): number {
    if (!this.limiters.has(key)) {
      return -1;
    }
    
    const limiter = this.limiters.get(key)!;
    const timeRemaining = limiter.resetTimestamp - Date.now();
    
    return Math.max(0, timeRemaining);
  }

  /**
   * Execute an operation with a delay if the rate limit is exceeded
   * Will automatically wait until the rate limit resets and then execute
   * @param key Identifier for the specific rate limiter
   * @param operation Function to execute
   * @param config Rate limit configuration
   * @returns Observable of the operation result
   */
  executeWithBackoff<T>(
    key: string,
    operation: () => Observable<T>,
    config: RateLimitConfig = DEFAULT_CONFIGS.API
  ): Observable<T> {
    // Check if operation is allowed
    if (this.checkLimit(key, config)) {
      // Increment operation counter
      const limiter = this.limiters.get(key)!;
      limiter.operations++;
      
      // Execute operation immediately
      return operation();
    } else {
      // Calculate delay until reset
      const limiter = this.limiters.get(key)!;
      const delay = limiter.resetTimestamp - Date.now() + 100; // Add 100ms buffer
      
      // Wait and then execute
      return timer(delay).pipe(
        mergeMap(() => {
          // Reset counter since window has passed
          limiter.operations = 1; // Set to 1 for this operation
          limiter.resetTimestamp = Date.now() + limiter.config.windowMs;
          
          // Execute operation after delay
          return operation();
        })
      );
    }
  }

  /**
   * Initialize a new rate limiter
   * @private
   * @param key Identifier for the specific rate limiter
   * @param config Rate limit configuration
   */
  private initializeLimiter(key: string, config: RateLimitConfig): void {
    this.limiters.set(key, {
      operations: 0,
      resetTimestamp: Date.now() + config.windowMs,
      config
    });
  }
}
