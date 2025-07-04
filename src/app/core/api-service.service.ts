import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../environments/environment';
import { TokenService } from './token/token.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private defaultTimeout = 30000; // 30 seconds
  private maxRetries = 2;

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) { }

  /**
   * Create headers for HTTP requests including auth token and request ID
   */
  private createHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-request-id': uuidv4(), // Generate unique request ID for tracking
    });

    const token = this.tokenService.getToken();
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
    // Remove leading slash from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
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
    // Remove leading slash from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
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
    // Remove leading slash from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
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
    // Remove leading slash from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
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
    // Remove leading slash from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
    return this.http.patch<T>(url, data, {
      headers: this.createHeaders()
    }).pipe(
      timeout(customTimeout || this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }
}
