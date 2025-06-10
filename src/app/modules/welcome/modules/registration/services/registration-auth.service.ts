// This file contains extensions to the auth service for registration functionality

import { Injectable } from '@angular/core';
import { WalletCreationResult } from '../../../../../services/wallet.service';
import { StandardWalletCreationResult } from './registration.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../core/auth/auth.service';
import { TokenService } from '../../../../../core/token/token.service';
import { environment } from '../../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RegistrationAuthService {
  constructor(
    private router: Router,
    private authService: AuthService,
    private tokenService: TokenService
  ) {}
  
  /**
   * Complete authentication after wallet creation/retrieval
   */
  async completeAuthentication(result: StandardWalletCreationResult, email: string): Promise<void> {
    console.log('🔍 [DEBUG] completeAuthentication called with:');
    console.log('  result:', result);
    console.log('  email:', email);
    console.log('  result.token:', result.token);
    console.log('  result.userId:', result.userId);
    
    try {
      // Check if we already have tokens from the registration response
      if (result.token) {
        console.log('✅ Using tokens from registration response');
        
        // Use tokens from the registration response
        this.tokenService.setToken(result.token);
        if (result.refreshToken) {
          this.tokenService.setRefreshToken(result.refreshToken);
        }
        
        // Store user information with wallet addresses
        const user = {
          id: result.userId || `user_${Math.random().toString(36).substring(2, 15)}`,
          email: email,
          walletAddress: result.walletAddress || result.sei_address,
          ethWalletAddress: result.ethWalletAddress || result.eth_address
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_wallet', JSON.stringify({
          sei_address: result.walletAddress || result.sei_address,
          eth_address: result.ethWalletAddress || result.eth_address
        }));
        
        console.log('Stored user with wallet addresses:', user);
        
        // Force refresh the AuthService to load the wallet addresses
        this.authService.loadUserFromStorage();
        
        console.log('Authentication completed with registration tokens', result);
        return;
      }
      
      console.log('❌ No token in result, attempting backend authentication');
      console.log('  - result.token exists:', !!result.token);
      console.log('  - result.userId exists:', !!result.userId);
      
      // Fallback: Try to authenticate with the live backend
      const authResponse = await this.authenticateWithBackend(email, 
        result.walletAddress || result.sei_address, 
        result.ethWalletAddress || result.eth_address);
      
      if (authResponse && authResponse.token) {
        // Use real tokens from backend
        this.tokenService.setToken(authResponse.token);
        this.tokenService.setRefreshToken(authResponse.refreshToken || 'refresh-token');
        
        // Store user information
        const user = {
          id: authResponse.userId || `user_${Math.random().toString(36).substring(2, 15)}`,
          email: email,
          walletAddress: result.walletAddress || result.sei_address,
          ethWalletAddress: result.ethWalletAddress || result.eth_address
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_wallet', JSON.stringify({
          sei_address: result.walletAddress || result.sei_address,
          eth_address: result.ethWalletAddress || result.eth_address
        }));
        
        console.log('Stored user with wallet addresses (backend auth):', user);
        
        // Force refresh the AuthService to load the wallet addresses
        this.authService.loadUserFromStorage();
        
        console.log('Authentication completed with live backend', result);
      } else {
        throw new Error('No token received from backend');
      }
    } catch (error) {
      console.warn('Live backend authentication failed, falling back to mock auth:', error);
      
      // Fallback to mock authentication
      this.completeMockAuthentication(result, email);
    }
  }

  /**
   * Fallback mock authentication for development
   */
  private completeMockAuthentication(result: StandardWalletCreationResult, email: string): void {
    // Store auth data in localStorage/session
    localStorage.setItem('user_authenticated', 'true');
    localStorage.setItem('user_wallet', JSON.stringify({
      sei_address: result.walletAddress || result.sei_address,
      eth_address: result.ethWalletAddress || result.eth_address
    }));
    
    // Create a mock JWT token for authentication
    const mockToken = this.generateMockToken(email, 
      result.walletAddress || result.sei_address, 
      result.ethWalletAddress || result.eth_address);
    
    // Set the token in the token service
    this.tokenService.setToken(mockToken);
    this.tokenService.setRefreshToken('mock-refresh-token');
    
    // Store user information in the auth service with wallet addresses
    const mockUserId = `user_${Math.random().toString(36).substring(2, 15)}`;
    const user = {
      id: mockUserId,
      email: email,
      walletAddress: result.walletAddress || result.sei_address,
      ethWalletAddress: result.ethWalletAddress || result.eth_address
    };
    
    // Store user in localStorage and update the AuthService
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    console.log('Mock authentication completed with wallet addresses:', user);
    
    // Force refresh the AuthService by calling loadUserFromStorage
    this.authService.loadUserFromStorage();
  }

  /**
   * Authenticate with the live backend
   */
  private async authenticateWithBackend(email: string, seiAddress: string, ethAddress: string): Promise<any> {
    const authPayload = {
      userId: email, // Using email as userId for wallet auth
      walletAddress: seiAddress,
      ethWalletAddress: ethAddress,
      signupMethod: 'wallet'
    };

    const response = await fetch(`${environment.apiUrl}/auth/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authPayload)
    });

    if (!response.ok) {
      throw new Error(`Backend auth failed: ${response.status}`);
    }

    return await response.json();
  }
  
  /**
   * Generate a mock token for testing
   */
  private generateMockToken(email: string, seiAddress: string, ethAddress: string): string {
    // Create a simple mock JWT-like token structure
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      email: email,
      sei_address: seiAddress,
      eth_address: ethAddress,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours from now
      iat: Math.floor(Date.now() / 1000)
    }));
    const signature = btoa('mocksignature');
    
    return `${header}.${payload}.${signature}`;
    // In production, this would be obtained from the backend
    return `mock-auth-token-${Math.random().toString(36).substring(2, 15)}`;
  }
}
