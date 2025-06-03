import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly tokenKey = 'auth_token';
  private readonly refreshTokenKey = 'refresh_token';

  constructor() { }

  /**
   * Get the current auth token from storage
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Set the auth token in storage
   */
  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Remove the auth token from storage
   */
  removeToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * Get the refresh token from storage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  /**
   * Set the refresh token in storage
   */
  setRefreshToken(token: string): void {
    localStorage.setItem(this.refreshTokenKey, token);
  }

  /**
   * Remove the refresh token from storage
   */
  removeRefreshToken(): void {
    localStorage.removeItem(this.refreshTokenKey);
  }

  /**
   * Clear all tokens from storage
   */
  clearTokens(): void {
    this.removeToken();
    this.removeRefreshToken();
  }
}
