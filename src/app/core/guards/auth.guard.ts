import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log('AuthGuard checking authentication for route:', state.url);
    console.log('AuthGuard - isLoggedIn:', this.authService.isLoggedIn);
    console.log('AuthGuard - authToken:', !!this.authService.authToken);
    console.log('AuthGuard - currentUser:', this.authService.currentUserValue);
    
    // Check if user is authenticated (has valid JWT token)
    if (this.authService.isLoggedIn && this.authService.authToken) {
      console.log('AuthGuard: User is authenticated, allowing access');
      return true;
    }

    // If not authenticated, redirect to welcome screen
    console.log('AuthGuard: User is not authenticated, redirecting to /welcome');
    this.router.navigate(['/welcome']);
    return false;
  }
}
