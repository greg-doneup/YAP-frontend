import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, delay, map, retry, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiService } from '../api-service.service';
import { HttpClient } from '@angular/common/http';

// Extend environment type with rpcUrl if missing
declare module '../../../environments/environment' {
  export interface Environment {
    production: boolean;
    apiUrl: string;
    rpcUrl: string;
  }
}

/**
 * Service health status representation
 */
export interface ServiceStatus {
  service: BackendService;
  healthy: boolean;
  timestamp: number;
  responseTime?: number;
  error?: string;
}

/**
 * Enumeration of YAP backend services
 */
export enum BackendService {
  AUTH = 'auth',
  PROFILE = 'profile',
  LEARNING = 'learning',
  REWARD = 'reward',
  GATEWAY = 'gateway',
  BLOCKCHAIN = 'blockchain'
}

/**
 * Connectivity service for YAP application
 * Handles connectivity to backend services and blockchain
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  // Network connectivity status
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public isOnline$ = this.isOnlineSubject.asObservable();
  
  // Services health status
  private servicesStatusSubject = new BehaviorSubject<Map<BackendService, ServiceStatus>>(new Map());
  public servicesStatus$ = this.servicesStatusSubject.asObservable();

  // Blockchain connectivity status
  private blockchainConnectedSubject = new BehaviorSubject<boolean>(false);
  public blockchainConnected$ = this.blockchainConnectedSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private http: HttpClient // Keep this for blockchain RPC calls
  ) {
    // Initialize online status listeners
    this.setupOnlineListener();
    
    // Start monitoring services
    this.initServiceMonitoring();
  }

  /**
   * Check the health of a specific backend service
   */
  checkServiceHealth(service: BackendService): Observable<ServiceStatus> {
    const startTime = Date.now();
    
    // Determine health endpoint based on service
    if (service === BackendService.BLOCKCHAIN) {
      return this.checkBlockchainHealth(startTime);
    }

    return this.apiService.get<any>(`${service}/healthz`, {}, 5000).pipe(
      map(() => ({
        service,
        healthy: true,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      })),
      catchError(error => {
        const status: ServiceStatus = {
          service,
          healthy: false,
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
          error: error.message || 'Unknown error'
        };
        return of(status);
      })
    );
  }

  /**
   * Check blockchain connectivity health
   */
  private checkBlockchainHealth(startTime: number): Observable<ServiceStatus> {
    // For blockchain, we just check if we can connect to the RPC endpoint
    // This would typically use ethers.js or similar library in a real implementation
    return this.http.get(`${environment.rpcUrl}`, { responseType: 'text' }).pipe(
      map(() => {
        this.blockchainConnectedSubject.next(true);
        return {
          service: BackendService.BLOCKCHAIN,
          healthy: true,
          timestamp: Date.now(),
          responseTime: Date.now() - startTime
        };
      }),
      catchError(error => {
        this.blockchainConnectedSubject.next(false);
        return of({
          service: BackendService.BLOCKCHAIN,
          healthy: false,
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
          error: error.message || 'Failed to connect to blockchain RPC'
        });
      })
    );
  }

  /**
   * Check health of all services
   */
  checkAllServices(): Observable<Map<BackendService, ServiceStatus>> {
    const services = Object.values(BackendService);
    const statusMap = new Map<BackendService, ServiceStatus>();
    
    // Use of() and switchMap to sequentially check each service
    return of(...services).pipe(
      switchMap(service => this.checkServiceHealth(service).pipe(
        tap(status => {
          statusMap.set(service, status);
          this.servicesStatusSubject.next(new Map(statusMap));
        })
      )),
      map(() => statusMap)
    );
  }

  /**
   * Make an API call with retry logic
   */
  callWithRetry<T>(
    serviceUrl: string, 
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      body?: any,
      headers?: Record<string, string>,
      retries?: number,
      retryDelay?: number
    }
  ): Observable<T> {
    if (!this.isOnlineSubject.value) {
      return throwError(() => new Error('Device is offline'));
    }

    let request: Observable<T>;
    const retryCount = options.retries || 3;
    const retryDelay = options.retryDelay || 1000;
    const timeout = 30000; // Default timeout

    switch (options.method) {
      case 'GET':
        request = this.apiService.get<T>(serviceUrl, {}, timeout);
        break;
      case 'POST':
        request = this.apiService.post<T>(serviceUrl, options.body, timeout);
        break;
      case 'PUT':
        request = this.apiService.put<T>(serviceUrl, options.body, timeout);
        break;
      case 'DELETE':
        request = this.apiService.delete<T>(serviceUrl, timeout);
        break;
      default:
        return throwError(() => new Error('Invalid HTTP method'));
    }

    return request.pipe(
      retry({
        count: retryCount,
        delay: (error, attemptCount) => {
          const delayMs = retryDelay * attemptCount;
          console.log(`Retrying request (${attemptCount}): ${serviceUrl}`, error);
          return of(0).pipe(delay(delayMs));
        }
      }),
      catchError(error => {
        console.error(`Request failed after retries: ${serviceUrl}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Setup network connectivity listeners
   */
  private setupOnlineListener(): void {
    // Set initial status
    this.isOnlineSubject.next(navigator.onLine);
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnlineSubject.next(true);
      this.checkAllServices().subscribe();
    });
    
    window.addEventListener('offline', () => {
      this.isOnlineSubject.next(false);
      // Mark all services as unhealthy when offline
      const currentStatus = new Map<BackendService, ServiceStatus>();
      Object.values(BackendService).forEach(service => {
        currentStatus.set(service, {
          service,
          healthy: false,
          timestamp: Date.now()
        });
      });
      this.servicesStatusSubject.next(currentStatus);
    });
  }

  /**
   * Initialize periodic service health monitoring
   */
  private initServiceMonitoring(): void {
    // Initial check
    this.checkAllServices().subscribe();
    
    // Setup periodic checking (every 60 seconds)
    setInterval(() => {
      if (navigator.onLine) {
        this.checkAllServices().subscribe();
      }
    }, 60000);
  }
}
