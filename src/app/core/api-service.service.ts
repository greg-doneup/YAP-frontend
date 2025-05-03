import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private defaultTimeout = 30000; // 30 seconds
  private maxRetries = 2;

  constructor(private http: HttpClient) { }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Create headers for HTTP requests including auth token and request ID
   */
  private createHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-request-id': uuidv4(), // Generate unique request ID for tracking
    });

    const token = this.getAuthToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  /**
   * Handle HTTP errors consistently
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
    }
    
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * GET request with authentication and error handling
   */
  get<T>(endpoint: string, params = {}, customTimeout?: number, responseType?: any): Observable<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    return this.http.get<T>(url, {
      headers: this.createHeaders(),
      params: params,
      responseType: responseType as any
    }).pipe(
      timeout(customTimeout || this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }

  /**
   * POST request with authentication and error handling
   */
  post<T>(endpoint: string, data = {}, customTimeout?: number): Observable<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    return this.http.post<T>(url, data, {
      headers: this.createHeaders()
    }).pipe(
      timeout(customTimeout || this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }

  /**
   * PUT request with authentication and error handling
   */
  put<T>(endpoint: string, data = {}, customTimeout?: number): Observable<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    return this.http.put<T>(url, data, {
      headers: this.createHeaders()
    }).pipe(
      timeout(customTimeout || this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }

  /**
   * DELETE request with authentication and error handling
   */
  delete<T>(endpoint: string, customTimeout?: number): Observable<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    return this.http.delete<T>(url, {
      headers: this.createHeaders()
    }).pipe(
      timeout(customTimeout || this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }

  /**
   * PATCH request with authentication and error handling
   */
  patch<T>(endpoint: string, data = {}, customTimeout?: number): Observable<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    return this.http.patch<T>(url, data, {
      headers: this.createHeaders()
    }).pipe(
      timeout(customTimeout || this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }
}
