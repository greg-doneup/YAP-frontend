import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ethers } from 'ethers';

import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ApiService } from '../api-service.service';

export interface WalletInfo {
  address: string;
  balance: string;
  xp: number;
  streak: number;
}

export interface AuthResponse {
  token: string;
  walletAddress: string;
}

export interface TokenBalance {
  available: string;
  staked: string;
  total: string;
  token: string;
  decimals: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'send' | 'receive' | 'reward' | 'mint' | 'other';
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface GasPriceEstimate {
  slow: string;
  average: string;
  fast: string;
  recommended: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly TOKEN_KEY = 'yap_auth_token';
  private readonly WALLET_KEY = 'yap_wallet_address';
  
  // RPC provider for blockchain interactions
  private provider: ethers.JsonRpcProvider;
  
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService
  ) {
    // Initialize provider with network config
    this.provider = new ethers.JsonRpcProvider(environment.rpcUrl, {
      chainId: 38284, // SEI testnet chain ID
      name: "sei-testnet"
    });
  }

  /**
   * Get wallet balance
   * @param address Wallet address
   */
  getBalance(address: string): Observable<TokenBalance> {
    return this.apiService.get<TokenBalance>(`wallet/${address}/balance`)
      .pipe(
        catchError(error => {
          this.errorService.handleError(error, 'balance-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get transaction history
   * @param address Wallet address
   * @param limit Optional limit of transactions to return
   * @param offset Optional offset for pagination
   */
  getTransactionHistory(address: string, limit: number = 10, offset: number = 0): Observable<Transaction[]> {
    return this.apiService.get<{transactions: Transaction[]}>(`wallet/${address}/transactions`, {
      limit: limit.toString(),
      offset: offset.toString()
    }).pipe(
      map(response => response.transactions || []),
      catchError(error => {
        this.errorService.handleError(error, 'transactions-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Transfer tokens to another address
   * @param fromAddress Sender's address
   * @param toAddress Recipient's address
   * @param amount Amount to transfer
   * @param signature Signed transaction data
   */
  transferTokens(fromAddress: string, toAddress: string, amount: string, signature: string): Observable<TransactionResult> {
    return this.apiService.post<TransactionResult>('wallet/transfer', {
      fromAddress,
      toAddress,
      amount,
      signature
    }).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'token-transfer');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get gas price estimate
   */
  getGasPrice(): Observable<GasPriceEstimate> {
    return this.apiService.get<GasPriceEstimate>('wallet/gas-price')
      .pipe(
        catchError(error => {
          this.errorService.handleError(error, 'gas-price-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get token price in USD
   */
  getTokenPrice(): Observable<number> {
    return this.apiService.get<{price: number}>('wallet/token-price')
      .pipe(
        map(response => response.price),
        catchError(error => {
          this.errorService.handleError(error, 'token-price-fetch');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get the wallet address of the currently logged in user
   * @returns The wallet address or an empty string if not logged in
   */
  getWalletAddress(): string {
    const address = localStorage.getItem(this.WALLET_KEY);
    return address || '';
  }
}
