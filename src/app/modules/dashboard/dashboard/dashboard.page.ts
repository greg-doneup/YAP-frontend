import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../../shared/services/wallet.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  userName = 'Welcome to YAP!';
  isLoading = true;
  isNewUser = true;
  
  // Flag to show sections for new users
  showNewUserGuide = true;
  showAdvancedSections = false; // Initially hide advanced sections for new users
  
  // Dashboard UI properties
  selectedDay = 'Wed';
  userLevel = 'A1 - Beginner';
  activeTab = 'progress'; // Default active tab
  
  // Mock data - in a real app this would come from services
  todaysGoal = {
    title: "Today's goal",
    description: "Complete 5 words and daily quiz",
    progress: 0,
    total: 5,
    reward: "+10YAP"
  };

  earnings = {
    total: 25, // Starting bonus for waitlist users
    currency: '$YAP',
    change: 0,
    changeAmount: 0
  };

  progress = {
    daysStreak: 0,
    wordsLearned: 0,
    nextBadge: {
      requirement: 100,
      current: 0,
      reward: "100$YAP"
    }
  };

  leaderboard = {
    userRank: '-',
    totalUsers: 40,
    topUser: {
      name: "Jacob jones",
      earnings: 2000
    }
  };

  constructor(
    private router: Router,
    private walletService: WalletService,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) { }

  async ngOnInit() {
    await this.loadUserData();
    
    // Set active tab based on current route
    const currentPath = this.router.url.split('/').pop();
    if (currentPath === 'home') {
      this.activeTab = 'home';
    } else if (currentPath === 'practice') {
      this.activeTab = 'learn';
    } else if (currentPath === 'progress') {
      this.activeTab = 'progress';
    } else if (currentPath === 'profile') {
      this.activeTab = 'profile';
    }
  }

  async loadUserData() {
    try {
      console.log('Starting to load dashboard data');
      
      // Use a longer timeout to ensure auth state propagation
      setTimeout(async () => {
        console.log('Loading dashboard data for new user after timeout');
        
        try {
          // Check if user has completed any lessons
          const hasCompletedLessons = false; // In a real app, this would come from a service
          
          // Determine if the user is new based on authentication data
          if (this.authService.currentUserValue) {
            console.log('User is authenticated:', this.authService.currentUserValue);
            
            // For this example, if the user is authenticated but has no completed lessons,
            // we consider them a new user who needs the onboarding experience
            this.isNewUser = !hasCompletedLessons;
            this.showNewUserGuide = this.isNewUser;
            this.showAdvancedSections = !this.isNewUser;
          }
          
          // We're handling a new user (isNewUser is already set to true by default)
          console.log('New user detected, preparing welcome experience');
          
          // Make sure progress data is properly zeroed out for new users
          this.progress = {
            daysStreak: 0,
            wordsLearned: 0,
            nextBadge: {
              requirement: 100,
              current: 0,
              reward: "100$YAP"
            }
          };
          
          // Reset today's goal progress
          this.todaysGoal.progress = 0;
          
          // Set welcome message for new users
          this.userName = 'Welcome to YAP!';
          
          console.log('Dashboard data loaded successfully');
        } catch (innerError) {
          console.error('Error processing dashboard data:', innerError);
        } finally {
          // Always hide the loading spinner after processing
          this.isLoading = false;
        }
      }, 1500); // Increased timeout for better user experience
    } catch (error) {
      console.error('Error in loadUserData method:', error);
      this.isLoading = false;
    }
  }

  continueLearning() {
    this.router.navigate(['/practice']);
  }

  withdraw() {
    this.router.navigate(['/profile']); // Could be wallet page
  }

  viewAllLeaderboard() {
    this.router.navigate(['/leaderboard']);
  }  navigateToHome() {
    this.activeTab = 'home';
    this.router.navigate(['/home']);
  }
  
  navigateToLearn() {
    this.activeTab = 'learn';
    this.router.navigate(['/practice']);
  }
  
  navigateToProgress() {
    this.activeTab = 'progress';
    this.router.navigate(['/progress']);
  }
  
  navigateToProfile() {
    this.activeTab = 'profile';
    this.router.navigate(['/profile']);
  }
  
  // Day selector
  selectDay(day: string) {
    this.selectedDay = day;
    // In a real app, you would load lessons for this day
  }

  // Lesson interactions
  startLesson(type: string) {
    this.router.navigate(['/practice'], { queryParams: { type } });
  }
  
  goToNextLesson() {
    this.router.navigate(['/practice'], { queryParams: { next: true } });
  }
  
  // Listen feature
  async startListening() {
    // Add listen-active class for animation
    const listenButton = document.querySelector('.listen-button');
    if (listenButton) {
      listenButton.classList.add('listen-active');
    }
    
    // Display the toast message
    const toast = await this.toastCtrl.create({
      message: 'Listening feature coming soon!',
      duration: 2000,
      position: 'middle',
      color: 'primary'
    });
    await toast.present();
    
    // Remove the active class after 2 seconds
    setTimeout(() => {
      if (listenButton) {
        listenButton.classList.remove('listen-active');
      }
    }, 2000);
  }
}
