import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface SecurityMetrics {
  totalEvents: number;
  failedEvents: number;
  successRate: number;
  uniqueIps: number;
  rateLimitedEvents: number;
  securityScore: number;
  eventBreakdown: { [key: string]: number };
  timestamp: string;
}

export interface SecurityEvent {
  timestamp: string;
  eventType: string;
  success: boolean;
  clientIp: string;
  details: any;
}

export interface SecurityAuditResult {
  timestamp: string;
  tests: {
    cryptoApi: boolean;
    localStorage: boolean;
    contentSecurityPolicy: boolean;
    sensitiveDataExposure: boolean;
    sessionSecurity: boolean;
  };
  overallStatus: 'pass' | 'partial' | 'fail';
  score: number;
  recommendations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SecurityMonitoringService {

  constructor(private apiService: ApiService) { }

  // Get security metrics from wallet service
  getWalletSecurityMetrics(): Observable<SecurityMetrics> {
    return this.apiService.get<SecurityMetrics>('wallet/security/metrics');
  }

  // Get security events from wallet service
  getWalletSecurityEvents(limit: number = 50, offset: number = 0, eventType?: string): Observable<{
    events: SecurityEvent[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }> {
    const params: any = { limit, offset };
    if (eventType) params.eventType = eventType;
    
    return this.apiService.get('wallet/security/events', params);
  }

  // Test wallet service security features
  testWalletSecurity(): Observable<any> {
    return this.apiService.post('wallet/security/test');
  }

  // Get auth service security metrics
  getAuthSecurityMetrics(): Observable<SecurityMetrics> {
    return this.apiService.get<SecurityMetrics>('auth/security/metrics');
  }

  // Get profile service security metrics
  getProfileSecurityMetrics(): Observable<SecurityMetrics> {
    return this.apiService.get<SecurityMetrics>('profile/security/metrics');
  }

  // Perform comprehensive security audit
  performSecurityAudit(): Observable<SecurityAuditResult> {
    return new Observable(observer => {
      const auditResult: SecurityAuditResult = {
        timestamp: new Date().toISOString(),
        tests: {
          cryptoApi: false,
          localStorage: false,
          contentSecurityPolicy: false,
          sensitiveDataExposure: false,
          sessionSecurity: false
        },
        overallStatus: 'fail',
        score: 0,
        recommendations: []
      };

      // Test 1: Crypto API availability
      try {
        if (window.crypto && window.crypto.subtle) {
          auditResult.tests.cryptoApi = true;
        } else {
          auditResult.recommendations.push('Web Crypto API not available - use HTTPS');
        }
      } catch (error) {
        auditResult.recommendations.push('Error accessing Web Crypto API');
      }

      // Test 2: LocalStorage security
      try {
        const testKey = 'security_test_' + Date.now();
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        // Check for sensitive data in localStorage
        const sensitivePatterns = ['password', 'passphrase', 'private', 'secret', 'key'];
        let foundSensitive = false;
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key || '');
          
          if (key && value) {
            for (const pattern of sensitivePatterns) {
              if (key.toLowerCase().includes(pattern) || value.toLowerCase().includes(pattern)) {
                foundSensitive = true;
                break;
              }
            }
          }
        }
        
        auditResult.tests.localStorage = !foundSensitive;
        if (foundSensitive) {
          auditResult.recommendations.push('Sensitive data found in localStorage - use encrypted storage');
        }
      } catch (error) {
        auditResult.recommendations.push('Error accessing localStorage');
      }

      // Test 3: Content Security Policy
      try {
        const metaTags = document.getElementsByTagName('meta');
        let hasCsp = false;
        
        for (let i = 0; i < metaTags.length; i++) {
          if (metaTags[i].getAttribute('http-equiv') === 'Content-Security-Policy') {
            hasCsp = true;
            break;
          }
        }
        
        auditResult.tests.contentSecurityPolicy = hasCsp;
        if (!hasCsp) {
          auditResult.recommendations.push('Implement Content Security Policy headers');
        }
      } catch (error) {
        auditResult.recommendations.push('Error checking Content Security Policy');
      }

      // Test 4: Check for sensitive data exposure
      try {
        const bodyText = document.body.innerText.toLowerCase();
        const sensitivePatterns = ['api_key', 'secret_key', 'private_key', 'password'];
        let exposedData = false;
        
        for (const pattern of sensitivePatterns) {
          if (bodyText.includes(pattern)) {
            exposedData = true;
            break;
          }
        }
        
        auditResult.tests.sensitiveDataExposure = !exposedData;
        if (exposedData) {
          auditResult.recommendations.push('Sensitive data patterns found in DOM - review data exposure');
        }
      } catch (error) {
        auditResult.recommendations.push('Error checking for sensitive data exposure');
      }

      // Test 5: Session security
      try {
        const authToken = localStorage.getItem('auth_token');
        const refreshToken = localStorage.getItem('refresh_token');
        
        let sessionSecure = true;
        
        if (authToken) {
          // Check if token looks like a JWT (has 3 parts)
          const parts = authToken.split('.');
          if (parts.length !== 3) {
            sessionSecure = false;
            auditResult.recommendations.push('Auth token format appears invalid');
          }
        }
        
        if (!authToken && !refreshToken) {
          auditResult.recommendations.push('No authentication tokens found');
        }
        
        auditResult.tests.sessionSecurity = sessionSecure;
      } catch (error) {
        auditResult.recommendations.push('Error checking session security');
      }

      // Calculate overall score and status
      const passedTests = Object.values(auditResult.tests).filter(Boolean).length;
      const totalTests = Object.keys(auditResult.tests).length;
      auditResult.score = Math.round((passedTests / totalTests) * 100);
      
      if (auditResult.score >= 80) {
        auditResult.overallStatus = 'pass';
      } else if (auditResult.score >= 60) {
        auditResult.overallStatus = 'partial';
      } else {
        auditResult.overallStatus = 'fail';
      }

      if (auditResult.recommendations.length === 0) {
        auditResult.recommendations.push('All security tests passed');
      }

      observer.next(auditResult);
      observer.complete();
    });
  }

  // Get aggregated security dashboard data
  getSecurityDashboard(): Observable<{
    walletMetrics: SecurityMetrics;
    authMetrics: SecurityMetrics;
    profileMetrics: SecurityMetrics;
    overallScore: number;
    criticalIssues: string[];
  }> {
    return new Observable(observer => {
      const promises = [
        this.getWalletSecurityMetrics().toPromise(),
        this.getAuthSecurityMetrics().toPromise(),
        this.getProfileSecurityMetrics().toPromise()
      ];

      Promise.allSettled(promises).then(results => {
        const walletMetrics = results[0].status === 'fulfilled' ? results[0].value : null;
        const authMetrics = results[1].status === 'fulfilled' ? results[1].value : null;
        const profileMetrics = results[2].status === 'fulfilled' ? results[2].value : null;

        // Calculate overall security score
        const scores = [walletMetrics?.securityScore, authMetrics?.securityScore, profileMetrics?.securityScore]
          .filter(score => score !== undefined) as number[];
        
        const overallScore = scores.length > 0 
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0;

        // Identify critical issues
        const criticalIssues: string[] = [];
        
        if (walletMetrics && walletMetrics.securityScore < 70) {
          criticalIssues.push('Wallet service security score below threshold');
        }
        if (authMetrics && authMetrics.securityScore < 70) {
          criticalIssues.push('Auth service security score below threshold');
        }
        if (profileMetrics && profileMetrics.securityScore < 70) {
          criticalIssues.push('Profile service security score below threshold');
        }

        observer.next({
          walletMetrics: walletMetrics || {} as SecurityMetrics,
          authMetrics: authMetrics || {} as SecurityMetrics,
          profileMetrics: profileMetrics || {} as SecurityMetrics,
          overallScore,
          criticalIssues
        });
        observer.complete();
      }).catch(error => {
        console.error('Error fetching security dashboard data:', error);
        observer.error(error);
      });
    });
  }
}
