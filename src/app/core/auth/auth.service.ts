import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../api-service.service';
import { ErrorService } from '../error/error.service';
import { TokenService } from '../token/token.service';
import { CryptoService } from '../../shared/services/crypto.service';

export interface User {
  id: string;
  email: string;
  username?: string;
  roles?: string[];
  walletAddress?: string;
  ethWalletAddress?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
  name?: string;
  role?: string;
  walletAddress?: string;
  ethWalletAddress?: string;
  starting_points?: number; // Points for waitlist users
  waitlist_bonus?: number; // Alternative field for waitlist bonus
}

export interface WalletAuthRequest {
  email: string;
  passphrase: string;
  walletAddress: string;
  ethWalletAddress: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private lastAuthResponse: AuthResponse | null = null; // Store the last auth response
  private refreshingToken = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private tokenService: TokenService,
    private cryptoService: CryptoService
  ) {
    this.loadUserFromStorage();
  }

  public loadUserFromStorage(): void {
    const token = this.tokenService.getToken();
    if (token) {
      this.validateToken(token).subscribe();
    } else {
      // Check if we have a basic user profile in localStorage
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          this.currentUserSubject.next(user);
          
          // Try to load wallet addresses from secure storage if available
          this.loadWalletAddressesFromSecureStorage(user.email);
        } catch (e) {
          console.error('Failed to parse user from localStorage', e);
        }
      }
    }
  }

  private async loadWalletAddressesFromSecureStorage(email: string): Promise<void> {
    try {
      // Check if we have wallet metadata in secure storage
      const walletMetadata = await this.cryptoService.getWalletMetadata(email);
      if (walletMetadata && this.currentUserValue) {
        // Update the current user with wallet addresses from secure storage
        const updatedUser = {
          ...this.currentUserValue,
          walletAddress: walletMetadata.sei_address,
          ethWalletAddress: walletMetadata.eth_address
        };
        
        console.log('Loaded wallet addresses from secure storage:', {
          sei: walletMetadata.sei_address,
          eth: walletMetadata.eth_address
        });
        
        // Update localStorage with the complete user data
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
        return;
      }
      
      // Fallback: check localStorage for wallet addresses
      const walletAddressesStr = localStorage.getItem('wallet_addresses');
      if (walletAddressesStr && this.currentUserValue) {
        try {
          const walletAddresses = JSON.parse(walletAddressesStr);
          const updatedUser = {
            ...this.currentUserValue,
            walletAddress: walletAddresses.sei_address,
            ethWalletAddress: walletAddresses.eth_address
          };
          
          console.log('Loaded wallet addresses from localStorage fallback:', {
            sei: walletAddresses.sei_address,
            eth: walletAddresses.eth_address
          });
          
          // Update localStorage with the complete user data
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
          
          // Try to migrate to secure storage
          this.saveWalletMetadataToSecureStorage(updatedUser);
        } catch (error) {
          console.error('Failed to parse wallet addresses from localStorage:', error);
        }
      }
    } catch (error) {
      console.log('No wallet data found in secure storage or error loading:', error);
    }
  }

  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get authToken(): string | null {
    return this.tokenService.getToken();
  }

  public get refreshToken(): string | null {
    return this.tokenService.getRefreshToken();
  }

  login(credentials: LoginCredentials): Observable<User> {
    return this.apiService.post<AuthResponse>('auth/login', credentials)
      .pipe(
        map(response => this.handleAuthResponse(response)),
        catchError(error => {
          this.errorService.handleError(error, 'login-failed');
          return throwError(() => error);
        })
      );
  }

  register(userData: RegisterData): Observable<User> {
    return this.apiService.post<AuthResponse>('auth/register', userData)
      .pipe(
        map(response => this.handleAuthResponse(response)),
        catchError(error => {
          this.errorService.handleError(error, 'registration-failed');
          return throwError(() => error);
        })
      );
  }

  logout(): Observable<void> {
    const refreshToken = this.refreshToken;
    this.clearAuthData();
    if (refreshToken) {
      return this.apiService.post<void>('auth/revoke', { refreshToken })
        .pipe(
          catchError(error => {
            console.error("Failed to revoke refresh token:", error);
            return of(void 0);
          })
        );
    } else {
      return of(void 0);
    }
  }

  validateToken(token: string): Observable<User> {
    return this.apiService.get<AuthResponse>('auth/validate')
      .pipe(
        map(response => {
          if (!response.refreshToken) {
            response.refreshToken = this.refreshToken || '';
          }
          return this.handleAuthResponse(response);
        }),
        catchError(error => {
          this.clearAuthData();
          this.errorService.handleError(error, 'token-validation-failed');
          return throwError(() => error);
        })
      );
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshingToken) {
      return this.refreshTokenSubject.asObservable()
        .pipe(
          switchMap(token => {
            if (token) {
              return of(token);
            }
            return throwError(() => new Error('Refresh token is null during refresh process'));
          })
        );
    }
    
    this.refreshingToken = true;
    this.refreshTokenSubject.next(null);
    
    const refreshToken = this.refreshToken;
    
    if (!refreshToken) {
      this.refreshingToken = false;
      return throwError(() => new Error('No refresh token available'));
    }
    
    return this.apiService.post<AuthResponse>('auth/refresh', { refreshToken })
      .pipe(
        map(response => {
          this.tokenService.setToken(response.token);
          this.tokenService.setRefreshToken(response.refreshToken);
          
          if (response.userId && this.currentUserValue) {
            const updatedUser = { ...this.currentUserValue };
            if (response.walletAddress) updatedUser.walletAddress = response.walletAddress;
            if (response.ethWalletAddress) updatedUser.ethWalletAddress = response.ethWalletAddress;
            
            // Save updated user data to localStorage
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            this.currentUserSubject.next(updatedUser);
            
            // Also save wallet metadata to secure storage
            this.saveWalletMetadataToSecureStorage(updatedUser);
          }
          
          this.refreshingToken = false;
          this.refreshTokenSubject.next(response.token);
          
          return response.token;
        }),
        catchError(error => {
          this.refreshingToken = false;
          if (error?.status === 401) {
            this.clearAuthData();
          }
          this.errorService.handleError(error, 'token-refresh-failed');
          return throwError(() => error);
        })
      );
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.apiService.post<void>('auth/password-reset/request', { email })
      .pipe(
        catchError(error => {
          this.errorService.handleError(error, 'password-reset-request-failed');
          return throwError(() => error);
        })
      );
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.apiService.post<void>('auth/password-reset/confirm', {
      token,
      newPassword
    }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'password-reset-failed');
        return throwError(() => error);
      })
    );
  }
  
  revokeToken(token: string): Observable<void> {
    return this.apiService.post<void>('auth/revoke', { refreshToken: token })
      .pipe(
        catchError(error => {
          this.errorService.handleError(error, 'token-revocation-failed');
          return throwError(() => error);
        })
      );
  }

  authenticateWithWallet(walletData: WalletAuthRequest): Observable<User> {
    return this.apiService.post<AuthResponse>('auth/wallet', {
      userId: walletData.email, // Using email as userId for wallet auth
      walletAddress: walletData.walletAddress,
      ethWalletAddress: walletData.ethWalletAddress,
      signupMethod: 'wallet'
    })
      .pipe(
        map(response => this.handleAuthResponse(response)),
        catchError(error => {
          this.errorService.handleError(error, 'wallet-auth-failed');
          return throwError(() => error);
        })
      );
  }

  private handleAuthResponse(response: AuthResponse): User {
    console.log('=== AUTH RESPONSE DEBUG ===');
    console.log('Full response object:', response);
    console.log('Response wallet addresses:');
    console.log('- walletAddress:', response.walletAddress);
    console.log('- ethWalletAddress:', response.ethWalletAddress);
    
    // Store the full auth response for later use
    this.lastAuthResponse = response;
    
    const user: User = {
      id: response.userId,
      email: response.email,
      walletAddress: response.walletAddress,
      ethWalletAddress: response.ethWalletAddress
    };
    
    console.log('Created user object:', user);
    
    this.tokenService.setToken(response.token);
    if (response.refreshToken) {
      this.tokenService.setRefreshToken(response.refreshToken);
    }
    
    // Save user data to localStorage for persistence
    localStorage.setItem('currentUser', JSON.stringify(user));
    console.log('Saved user to localStorage:', JSON.stringify(user));
    
    // Also save wallet metadata to secure storage if wallet addresses are present
    this.saveWalletMetadataToSecureStorage(user);
    
    this.currentUserSubject.next(user);
    return user;
  }

  private async saveWalletMetadataToSecureStorage(user: User): Promise<void> {
    if (user.walletAddress || user.ethWalletAddress) {
      try {
        // Create wallet metadata entry (non-sensitive data)
        const walletMetadata = {
          email: user.email,
          sei_address: user.walletAddress || '',
          eth_address: user.ethWalletAddress || '',
          created_at: new Date().toISOString(),
          last_accessed: new Date().toISOString()
        };

        // Use CryptoService's internal DB access
        const db = await (this.cryptoService as any).dbPromise;
        
        // Try to store in walletMetadata first, fallback to userPreferences
        try {
          await db.put('walletMetadata', { id: user.email, ...walletMetadata });
          console.log('Saved wallet metadata to walletMetadata store');
        } catch (error) {
          // Fallback to userPreferences
          await db.put('userPreferences', { 
            id: `wallet_${user.email}`,
            ...walletMetadata 
          });
          console.log('Saved wallet metadata to userPreferences store');
        }
        
        console.log('Wallet metadata saved:', {
          sei: user.walletAddress,
          eth: user.ethWalletAddress
        });
      } catch (error) {
        console.error('Failed to save wallet metadata to secure storage:', error);
        // As a fallback, save to localStorage temporarily
        const walletAddresses = {
          sei_address: user.walletAddress || '',
          eth_address: user.ethWalletAddress || ''
        };
        localStorage.setItem('wallet_addresses', JSON.stringify(walletAddresses));
        console.log('Saved wallet addresses to localStorage as fallback');
      }
    }
  }
  
  /**
   * Get the last authentication response which may contain waitlist bonus information
   */
  getAuthResponse(): AuthResponse | null {
    return this.lastAuthResponse;
  }
  
  private clearAuthData(): void {
    this.tokenService.removeToken();
    this.tokenService.removeRefreshToken();
    localStorage.removeItem('currentUser'); // Clear user data from localStorage
    this.currentUserSubject.next(null);
    this.refreshTokenSubject.next(null);
    this.lastAuthResponse = null; // Clear the stored auth response
  }
}
