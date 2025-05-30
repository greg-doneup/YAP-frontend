import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss'],
})
export class SplashScreenComponent implements OnInit, OnDestroy {
  isVisible = true;

  constructor(private router: Router) {}

  ngOnInit() {
    // Hide splash screen after animation completes
    setTimeout(() => {
      this.hideSplashScreen();
    }, 2500); // 2s animation + 0.5s buffer
  }

  ngOnDestroy() {
    // Clean up if needed
  }

  private hideSplashScreen() {
    this.isVisible = false;
    
    // Wait for fade-out animation to complete before removing from DOM
    setTimeout(() => {
      // Splash screen will be hidden via *ngIf
    }, 500);
  }
}
