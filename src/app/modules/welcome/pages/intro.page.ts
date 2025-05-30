import { Component, ViewChild, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle';
import { IonContent } from '@ionic/angular';
import { MicPermissionComponent } from '../components/mic-permissio/mic-permission.component';

// Register Swiper custom elements

@Component({
  selector: 'app-intro',
  templateUrl: './intro.page.html',
  styleUrls: ['./intro.page.scss'],
})
export class IntroPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  
  ngOnInit() {
    // Register Swiper custom elements when component initializes
    register();
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
      image: 'assets/images/intro/talk-earn.svg',
      title: 'Talk & Earn',
      description: 'Earn rewards by practicing your speaking skills',
      buttonText: 'Next',
      backgroundClass: 'slide-secondary'
    },
    {
      image: 'assets/images/intro/practice.svg',
      title: 'Daily Practice',
      description: 'Build your vocabulary and improve pronunciation',
      buttonText: 'Next',
      backgroundClass: 'slide-tertiary'
    },
    {
      image: 'assets/images/intro/community.svg',
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

  constructor(private modalCtrl: ModalController, private router: Router) {}

  /** Handle slide change event */
  onSlideChange(event: any) {
    if (event && event.target && event.target.swiper) {
      this.currentSlide = event.target.swiper.activeIndex;
    }
  }

  /** Navigate to next slide */
  nextSlide() {
    if (this.currentSlide === this.totalSlides - 1) {
      this.getStarted();
    } else {
      const swiperEl = document.querySelector('swiper-container');
      swiperEl?.swiper.slideNext();
    }
  }

  /** Navigate to previous slide */
  prevSlide() {
    const swiperEl = document.querySelector('swiper-container');
    swiperEl?.swiper.slidePrev();
  }

  /** Skip intro and go to registration options */
  skipIntro() {
    const swiperEl = document.querySelector('swiper-container');
    if (swiperEl?.swiper) {
      swiperEl.swiper.slideTo(this.totalSlides - 1);
    }
  }

  /** Called from final slide "Get Started" button */
  getStarted() {
    // Navigate to new user registration flow
    console.log('Navigating to registration flow for new users');
    this.router.navigate(['/welcome/waitlist-signup']);
  }

  /** Called when user already has an account */
  loginExisting() {
    // Navigate to waitlist recovery for existing users
    console.log('Navigating to waitlist recovery for existing users');
    this.router.navigate(['/welcome/waitlist-recovery']);
  }
}
