import { Component, ViewChild, OnInit, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle';
import { IonContent } from '@ionic/angular';
import { MicPermissionComponent } from '../components/mic-permissio/mic-permission.component';

// Register Swiper custom elements
register();

@Component({
  selector: 'app-intro',
  templateUrl: './intro.page.html',
  styleUrls: ['./intro.page.scss'],
})
export class IntroPage implements OnInit, AfterViewInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('swiperContainer', { static: false }) swiperContainer!: ElementRef;
  
  private swiperInstance: any = null;
  private isInitialized = false;

  ngOnInit() {
    console.log('IntroPage initialized');
  }

  ngAfterViewInit() {
    console.log('IntroPage AfterViewInit - setting up Swiper');
    this.initializeSwiper();
  }

  private async initializeSwiper() {
    return new Promise<void>((resolve) => {
      // Use longer timeout to ensure DOM is ready
      setTimeout(async () => {
        const swiperEl = this.swiperContainer?.nativeElement || document.querySelector('swiper-container');
        
        if (swiperEl) {
          this.swiperInstance = swiperEl;
          console.log('Swiper element found:', this.swiperInstance);
          
          // Configure Swiper parameters
          Object.assign(swiperEl, {
            slidesPerView: 1,
            spaceBetween: 0,
            effect: 'fade',
            speed: 800,
            allowTouchMove: true,
            centeredSlides: true,
            loop: false,
            grabCursor: true,
            simulateTouch: true,
            fadeEffect: {
              crossFade: true
            }
          });
          
          // Initialize Swiper
          swiperEl.initialize();
          
          // Set up event listeners for slide changes
          swiperEl.addEventListener('swiperslidechange', (event: any) => {
            console.log('Swiper slide change event:', event);
            this.handleSlideChange(event);
          });

          swiperEl.addEventListener('slidechange', (event: any) => {
            console.log('Generic slide change event:', event);
            this.handleSlideChange(event);
          });

          // Wait for Swiper to be ready
          const checkSwiper = () => {
            if (swiperEl.swiper) {
              console.log('Swiper ready!', swiperEl.swiper);
              this.isInitialized = true;
              resolve();
            } else {
              setTimeout(checkSwiper, 50);
            }
          };
          
          checkSwiper();
        } else {
          console.error('Swiper element not found');
          setTimeout(() => this.initializeSwiper(), 500);
        }
      }, 300);
    });
  }

  private handleSlideChange(event: any) {
    let newIndex = this.currentSlide;
    
    // Try multiple ways to get the active index
    if (event?.detail?.[0]?.activeIndex !== undefined) {
      newIndex = event.detail[0].activeIndex;
    } else if (event?.target?.swiper?.activeIndex !== undefined) {
      newIndex = event.target.swiper.activeIndex;
    } else if (this.swiperInstance?.swiper?.activeIndex !== undefined) {
      newIndex = this.swiperInstance.swiper.activeIndex;
    }
    
    if (newIndex !== this.currentSlide) {
      console.log('Slide changed from', this.currentSlide, 'to', newIndex);
      this.currentSlide = newIndex;
      
      // Trigger animations for Daily Practice slide (slide 3, index 2)
      if (newIndex === 2) {
        this.triggerDailyPracticeAnimation();
      }
      
      this.cdr.detectChanges();
    }
  }

  /** Trigger animations for Daily Practice slide */
  private triggerDailyPracticeAnimation() {
    console.log('Triggering Daily Practice animations');
    
    // Add a small delay to ensure the slide DOM is ready
    setTimeout(() => {
      const dailyPracticeContainer = document.querySelector('.daily-practice-container .pronunciation-practice');
      if (dailyPracticeContainer) {
        dailyPracticeContainer.classList.add('slide-active');
        console.log('Added slide-active class to Daily Practice container');
      } else {
        console.warn('Daily Practice container not found');
      }
    }, 100);
  }

  // Track current slide
  currentSlide = 0;
  totalSlides = 5;

  // Language data for animated orbs
  languages = [
    { code: 'ES', hello: 'Hola', country: 'Spanish' },
    { code: 'ZH', hello: '你好', country: 'Chinese' },
    { code: 'AR', hello: 'مرحبا', country: 'Arabic' },
    { code: 'FR', hello: 'Bonjour', country: 'French' },
    { code: 'DE', hello: 'Hallo', country: 'German' }
  ];

  // Pronunciation practice data for Daily Practice slide
  practiceData = {
    spanish: {
      sentence: ['Me', 'gusta', 'aprender', 'idiomas', 'nuevos'],
      translation: 'I like to learn new languages',
      feedback: [
        { word: 'Me', correct: true, delay: 0.8, duration: 0.4 },
        { word: 'gusta', correct: false, delay: 1.5, duration: 0.5 },
        { word: 'aprender', correct: true, delay: 2.3, duration: 0.6 },
        { word: 'idiomas', correct: true, delay: 3.2, duration: 0.5 },
        { word: 'nuevos', correct: false, delay: 4.0, duration: 0.5 }
      ]
    }
  };

  // Community data for Join the Community slide
  communityData = {
    users: [
      { id: 1, name: 'Maria', country: 'ES', flag: '🇪🇸', learning: 'English', badge: '🏆' },
      { id: 2, name: 'Zhang', country: 'CN', flag: '🇨🇳', learning: 'Spanish', badge: '⭐' },
      { id: 3, name: 'Ahmed', country: 'EG', flag: '🇪🇬', learning: 'French', badge: '🎯' },
      { id: 4, name: 'Sophie', country: 'FR', flag: '🇫🇷', learning: 'Arabic', badge: '💎' },
      { id: 5, name: 'Raj', country: 'IN', flag: '🇮🇳', learning: 'German', badge: '🚀' },
      { id: 6, name: 'Emma', country: 'US', flag: '🇺🇸', learning: 'Chinese', badge: '🔥' }
    ],
    exchanges: [
      { from: 'Hola', to: 'Hello', languages: ['ES', 'EN'] },
      { from: 'Bonjour', to: 'مرحبا', languages: ['FR', 'AR'] },
      { from: '你好', to: 'Namaste', languages: ['CN', 'IN'] }
    ]
  };

  // Slide data based on intro screens from YAP design
  introSlides = [
    {
      image: 'assets/images/landing/yap-landing-transparent.png',
      title: 'Welcome to YAP!',
      description: 'Start your language learning journey today',
      buttonText: 'Next',
      backgroundClass: 'slide-primary'
    },
    {
      image: 'assets/images/talk-to-earn/talk-to-earn-transparent.png',
      title: 'Talk & Earn',
      description: 'Practice speaking, earn real rewards',
      buttonText: 'Next',
      backgroundClass: 'slide-secondary'
    },
    {
      image: 'assets/images/practice/practice.svg',
      title: 'Daily Practice',
      description: 'Real-time pronunciation feedback helps you improve',
      buttonText: 'Next',
      backgroundClass: 'slide-tertiary'
    },
    {
      image: 'assets/images/community/community.svg',
      title: 'Join the Community',
      description: 'Connect with other language learners around the world',
      buttonText: 'Next',
      backgroundClass: 'slide-quaternary'
    },
    {
      image: 'assets/logo/YAP-LOGO.png',
      title: 'Learn. Talk. Earn.',
      description: '',
      buttonText: 'GET STARTED',
      secondButtonText: 'I WAS ON THE WAITLIST',
      backgroundClass: 'slide-primary',
      isLastSlide: true
    }
  ];

  constructor(private modalCtrl: ModalController, private router: Router, private cdr: ChangeDetectorRef) {}

  /** Handle slide change event */
  onSlideChange(event: any) {
    console.log('onSlideChange called with:', event);
    this.handleSlideChange(event);
  }

  /** Navigate to next slide */
  async nextSlide() {
    console.log('Next slide clicked, current slide:', this.currentSlide);
    
    if (this.currentSlide === this.totalSlides - 1) {
      this.getStarted();
      return;
    }

    // Ensure Swiper is initialized before proceeding
    if (!this.isInitialized) {
      console.log('Swiper not initialized, waiting...');
      await this.initializeSwiper();
    }

    // Try multiple methods to advance the slide
    const success = await this.trySlideNext();
    
    if (!success) {
      console.log('All slide methods failed, using manual fallback');
      // Manual fallback - update currentSlide and trigger change detection
      this.currentSlide = Math.min(this.currentSlide + 1, this.totalSlides - 1);
      this.cdr.detectChanges();
      
      // Force Swiper to go to the correct slide
      setTimeout(() => {
        this.forceSlideUpdate();
      }, 100);
    }
  }

  private async trySlideNext(): Promise<boolean> {
    // Method 1: Use stored instance
    if (this.swiperInstance?.swiper) {
      console.log('Using stored Swiper instance for slideNext()');
      try {
        this.swiperInstance.swiper.slideNext();
        return true;
      } catch (error) {
        console.warn('Stored instance failed:', error);
      }
    }
    
    // Method 2: Try ViewChild reference
    if (this.swiperContainer?.nativeElement?.swiper) {
      console.log('Using ViewChild reference for slideNext()');
      try {
        this.swiperContainer.nativeElement.swiper.slideNext();
        return true;
      } catch (error) {
        console.warn('ViewChild reference failed:', error);
      }
    }
    
    // Method 3: Fallback to querySelector
    const swiperEl = document.querySelector('swiper-container') as any;
    if (swiperEl?.swiper) {
      console.log('Using querySelector, calling slideNext()');
      try {
        swiperEl.swiper.slideNext();
        return true;
      } catch (error) {
        console.warn('querySelector method failed:', error);
      }
    }
    
    return false;
  }

  private forceSlideUpdate() {
    const swiperEl = this.swiperInstance || this.swiperContainer?.nativeElement || document.querySelector('swiper-container');
    if (swiperEl?.swiper) {
      console.log('Force updating slide to:', this.currentSlide);
      swiperEl.swiper.slideTo(this.currentSlide);
    }
  }

  /** Navigate to previous slide */
  prevSlide() {
    if (this.swiperInstance?.swiper) {
      this.swiperInstance.swiper.slidePrev();
    } else {
      const swiperEl = document.querySelector('swiper-container') as any;
      swiperEl?.swiper?.slidePrev();
    }
  }

  /** Skip intro and go to registration options */
  skipIntro() {
    if (this.swiperInstance?.swiper) {
      this.swiperInstance.swiper.slideTo(this.totalSlides - 1);
    } else {
      const swiperEl = document.querySelector('swiper-container') as any;
      if (swiperEl?.swiper) {
        swiperEl.swiper.slideTo(this.totalSlides - 1);
      }
    }
  }

  /** Called from final slide "Get Started" button */
  getStarted() {
    // Navigate to standard registration flow for new users
    console.log('Navigating to standard registration flow for new users');
    this.router.navigate(['/welcome/registration/standard']);
  }

  /** Called when user already has an account */
  loginExisting() {
    // Navigate to waitlist registration for existing users
    console.log('Navigating to waitlist registration for existing users');
    this.router.navigate(['/welcome/registration/waitlist']);
  }
}
