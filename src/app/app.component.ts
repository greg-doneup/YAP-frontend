import { Component, OnInit } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { AuthService } from './core/auth/auth.service';
import { Router } from '@angular/router';

// Register Swiper elements globally
register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  showSplash = true;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Use matchMedia to check the user preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    if (prefersDark.matches === true) {
      localStorage.setItem('dt', 'on');
      toggleDarkTheme(prefersDark.matches);

      // Listen for changes to the prefers-color-scheme media query
      prefersDark.addListener((mediaQuery) => toggleDarkTheme(mediaQuery.matches));

      // Add or remove the "dark" class based on if the media query matches
      function toggleDarkTheme(shouldAdd: any) {
        document.body.setAttribute('color-scheme', 'dark');
      }
    } else {
      localStorage.removeItem('dt');
    }

    const isDark = localStorage.getItem('dt');

    if (isDark) {
      toggleDarkTheme(prefersDark.matches);
      
      // Listen for changes to the prefers-color-scheme media query
      prefersDark.addListener((mediaQuery) => toggleDarkTheme(mediaQuery.matches));
      
      // Add or remove the "dark" class based on if the media query matches
      function toggleDarkTheme(shouldAdd: any) {
        document.body.setAttribute('color-scheme', 'dark');
      }
    }
  }

  ngOnInit() {
    // Check if user is authenticated on app startup
    const token = this.authService.authToken;
    if (token) {
      console.log('App initialization - Found auth token, validating...');
      
      this.authService.validateToken(token).subscribe({
        next: (user) => {
          console.log('App initialization - Token validation successful, user authenticated:', user);
          
          // If the user is on the welcome/intro route but is authenticated,
          // redirect them to the dashboard
          if (window.location.pathname === '/welcome' || window.location.pathname === '/') {
            console.log('App initialization - Redirecting authenticated user to dashboard');
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err) => {
          console.error('App initialization - Token validation failed:', err);
          // Token validation failed, clear auth data and stay on current page
          this.authService.logout().subscribe();
        }
      });
    }
    
    // Hide splash screen after 3 seconds
    setTimeout(() => {
      this.showSplash = false;
    }, 3000);
  }

  onSplashComplete() {
    this.showSplash = false;
  }
}
