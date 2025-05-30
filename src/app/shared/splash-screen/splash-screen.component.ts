import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss']
})
export class SplashScreenComponent implements OnInit {
  @Output() animationComplete = new EventEmitter<void>();

  constructor() { }

  ngOnInit() {
    // Auto-hide splash screen after animation completes
    setTimeout(() => {
      this.hideSplash();
    }, 2500); // 2s animation + 0.5s buffer
  }

  hideSplash() {
    this.animationComplete.emit();
  }
}
