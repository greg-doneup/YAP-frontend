import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SplashScreenComponent } from './splash-screen.component';

describe('SplashScreenComponent', () => {
  let component: SplashScreenComponent;
  let fixture: ComponentFixture<SplashScreenComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SplashScreenComponent]
    });
    fixture = TestBed.createComponent(SplashScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit animationComplete after timeout', (done) => {
    component.animationComplete.subscribe(() => {
      done();
    });
    
    // Trigger the timeout manually for testing
    component.hideSplash();
  });
});
