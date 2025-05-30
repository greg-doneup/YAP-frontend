import { Component, OnInit } from '@angular/core';
import { register } from 'swiper/element/bundle';

// Register Swiper elements globally
register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  showSplash = true;

  constructor() {
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
    // Hide splash screen after 3 seconds
    setTimeout(() => {
      this.showSplash = false;
    }, 3000);
  }

  onSplashComplete() {
    this.showSplash = false;
  }
}
