import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../api-service.service';

// Add interface extension for environment
declare module '../../../environments/environment' {
  export interface Environment {
    production: boolean;
    apiUrl: string;
    rpcUrl: string;
    enableErrorLogging: boolean;
  }
}

/**
 * Standard error types in the YAP application
 */
export enum ErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  BLOCKCHAIN = 'blockchain',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown'
}

/**
 * Standardized error model for the application
 */
export interface AppError {
  type: ErrorType;
  message: string;
  code?: string | number;
  timestamp: number;
  source?: string;
  data?: any;
  originalError?: Error | HttpErrorResponse | unknown;
}

/**
 * Service for consistent error handling across the YAP application
 * Provides error normalization, tracking, and reporting
 */
@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  // Observable stream of application errors
  private errorSubject = new Subject<AppError>();
  public errors$ = this.errorSubject.asObservable();
  
  // Track recent errors for debugging
  private recentErrors: AppError[] = [];
  private readonly MAX_RECENT_ERRORS = 10;

  constructor(private apiService: ApiService) { }

  /**
   * Handle and normalize an error from any source
   */
  handleError(error: any, source?: string): Observable<never> {
    const appError = this.normalizeError(error, source);
    this.trackError(appError);
    return throwError(() => appError);
  }

  /**
   * Log an error without throwing it
   */
  logError(error: any, source?: string): void {
    const appError = this.normalizeError(error, source);
    this.trackError(appError);
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(): AppError[] {
    return [...this.recentErrors];
  }

  /**
   * Clear tracked errors
   */
  clearErrors(): void {
    this.recentErrors = [];
  }

  /**
   * Normalize different error types to AppError format
   */
  private normalizeError(error: any, source?: string): AppError {
    const timestamp = Date.now();

    // HTTP errors
    if (error instanceof HttpErrorResponse) {
      const errorType = this.getErrorTypeFromStatus(error.status);
      return {
        type: errorType,
        message: this.getErrorMessage(error),
        code: error.status,
        timestamp,
        source: source || 'http',
        data: error.error,
        originalError: error
      };
    }
    
    // Standard JS Error objects
    if (error instanceof Error) {
      return {
        type: ErrorType.CLIENT,
        message: error.message || 'An unexpected error occurred',
        timestamp,
        source: source || error.name || 'client',
        originalError: error
      };
    }

    // API errors with specific shape
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        type: this.getErrorTypeFromCode(error.code),
        message: String(error.message),
        code: error.code || error.statusCode,
        timestamp,
        source: source || 'api',
        data: error,
        originalError: error
      };
    }

    // Blockchain errors often have different formats
    if (error && typeof error === 'object' && ('reason' in error || 'message' in error)) {
      return {
        type: ErrorType.BLOCKCHAIN,
        message: String(error.reason || error.message || 'Blockchain operation failed'),
        code: error.code,
        timestamp,
        source: source || 'blockchain',
        data: error,
        originalError: error
      };
    }
    
    // String errors
    if (typeof error === 'string') {
      return {
        type: ErrorType.UNKNOWN,
        message: error,
        timestamp,
        source: source || 'unknown',
        originalError: error
      };
    }
    
    // Unknown errors
    return {
      type: ErrorType.UNKNOWN,
      message: 'An unknown error occurred',
      timestamp,
      source: source || 'unknown',
      data: error,
      originalError: error
    };
  }

  /**
   * Determine error type from HTTP status code
   */
  private getErrorTypeFromStatus(status: number): ErrorType {
    if (status === 0) {
      return ErrorType.NETWORK;
    }
    if (status === 401 || status === 403) {
      return ErrorType.AUTH;
    }
    if (status === 400 || status === 422) {
      return ErrorType.VALIDATION;
    }
    if (status >= 500) {
      return ErrorType.SERVER;
    }
    return ErrorType.CLIENT;
  }

  /**
   * Determine error type from error code
   */
  private getErrorTypeFromCode(code?: string | number): ErrorType {
    if (!code) return ErrorType.UNKNOWN;
    
    const codeStr = String(code).toLowerCase();
    
    if (codeStr.includes('auth') || codeStr.includes('unauthorized') || codeStr === '401' || codeStr === '403') {
      return ErrorType.AUTH;
    }
    if (codeStr.includes('valid') || codeStr.includes('input') || codeStr === '400' || codeStr === '422') {
      return ErrorType.VALIDATION;
    }
    if (codeStr.includes('network') || codeStr.includes('connection')) {
      return ErrorType.NETWORK;
    }
    if (codeStr.includes('blockchain') || codeStr.includes('wallet') || codeStr.includes('contract')) {
      return ErrorType.BLOCKCHAIN;
    }
    if (codeStr.includes('server') || codeStr.startsWith('5')) {
      return ErrorType.SERVER;
    }
    if (codeStr.includes('client') || codeStr.startsWith('4')) {
      return ErrorType.CLIENT;
    }
    
    return ErrorType.UNKNOWN;
  }

  /**
   * Extract human-readable message from various error types
   */
  private getErrorMessage(error: any): string {
    if (error instanceof HttpErrorResponse) {
      // Try to get message from response body
      if (error.error && typeof error.error === 'object' && 'message' in error.error) {
        return String(error.error.message);
      }
      
      // Provide specific messages for common HTTP status codes
      switch (error.status) {
        case 0: 
          return 'Cannot connect to server. Please check your internet connection.';
        case 401:
          return 'You need to log in to access this resource.';
        case 403:
          return 'You do not have permission to access this resource.';
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Server error. Please try again later.';
        default:
          return error.statusText || 'An error occurred while processing your request.';
      }
    }
    
    if (error && typeof error === 'object') {
      return String(error.message || error.error || error.reason || 'Unknown error');
    }
    
    // Default case - added return statement to fix function
    return String(error || 'An unexpected error occurred');
  }

  /**
   * Track error in memory and emit to subscribers
   */
  private trackError(error: AppError): void {
    // Don't log details in production unless explicitly enabled
    if (environment.production && !environment.enableErrorLogging) {
      console.error(`[ERROR] ${error.type}: ${error.message}`);
    } else {
      console.error('[ERROR]', error);
    }
    
    // Add to recent errors, keeping the list at maximum size
    this.recentErrors.unshift(error);
    if (this.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.recentErrors.pop();
    }
    
    // Emit error for subscribers
    this.errorSubject.next(error);
    
    // Here you could add error reporting to backend/analytics service
    this.reportErrorToAnalytics(error);
  }

  /**
   * Report errors to analytics or monitoring service
   */
  private reportErrorToAnalytics(error: AppError): void {
    // Skip reporting for certain error types in production
    if (environment.production) {
      // Don't report validation errors to reduce noise
      if (error.type === ErrorType.VALIDATION) {
        return;
      }
      
      // Don't report auth errors unless they're suspicious
      if (error.type === ErrorType.AUTH && error.code === 401) {
        return;
      }
    }
    
    // Implementation for error reporting to backend would go here
    // Example: send error to monitoring service
    /*
    this.apiService.post('errors/report', {
      type: error.type,
      message: error.message,
      code: error.code,
      source: error.source,
      timestamp: error.timestamp,
      userAgent: navigator.userAgent,
      // Don't include full error object to avoid sensitive data
    }).subscribe();
    */
  }
}
