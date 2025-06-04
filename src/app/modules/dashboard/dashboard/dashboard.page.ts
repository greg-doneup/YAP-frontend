import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../../shared/services/wallet.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastController } from '@ionic/angular';
import * as moment from 'moment-timezone';
import { LessonService, Lesson } from '../../../shared/services/lesson.service';
import { UserProgressService, UserProgress, LevelHistoryEntry } from '../../../shared/services/user-progress.service';
import { LeaderboardService } from '../../../core/leaderboard/leaderboard.service';
import { ApiService } from '../../../core/api-service.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, OnDestroy {
  userName = 'Welcome to YAP!';
  isLoading = true;
  isNewUser = true;
  isDevMode = true; // Set to true for development features, false for production
  
  // Flag to show sections for new users
  showNewUserGuide = true;
  showAdvancedSections = false; // Initially hide advanced sections for new users
  
  // Dashboard UI properties
  selectedDay: string = '';
  userLevel = 'A1 - Beginner';
  activeTab = 'progress'; // Default active tab
  weekdays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  showingRecommended: boolean = false; // Toggle between daily and recommended lessons
  
  // Lesson properties
  todaysLessons: Lesson[] = [];
  recommendedLessons: Lesson[] = [];
  nextLesson: Lesson | null = null;
  
  // User progress
  userProgress: UserProgress | null = null;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // CEFR Levels structure
  ceferLevels = [
    { level: 'A1.1', title: 'A1.1 - Beginner', description: 'Introduction and Greetings' },
    { level: 'A1.2', title: 'A1.2 - Beginner', description: 'Family and Everyday Objects' },
    { level: 'A1.3', title: 'A1.3 - Beginner', description: 'Daily Life and Habits' },
    { level: 'A2.1', title: 'A2.1 - Elementary', description: 'Routines and Abilities' },
    { level: 'A2.2', title: 'A2.2 - Elementary', description: 'Past Experiences' },
    { level: 'A2.3', title: 'A2.3 - Elementary', description: 'Plans and Transactions' },
    { level: 'B1.1', title: 'B1.1 - Intermediate', description: 'Sharing Experiences' },
    { level: 'B1.2', title: 'B1.2 - Intermediate', description: 'Opinions and Obligations' },
    { level: 'B1.3', title: 'B1.3 - Intermediate', description: 'Hypotheticals and Descriptions' },
    { level: 'B2.1', title: 'B2.1 - Upper Intermediate', description: 'Debating and Discussion' },
    { level: 'B2.2', title: 'B2.2 - Upper Intermediate', description: 'Narratives and Reports' },
    { level: 'B2.3', title: 'B2.3 - Upper Intermediate', description: 'Nuance and Complex Situations' },
    { level: 'C1.1', title: 'C1.1 - Advanced', description: 'Fluency and Emphasis' },
    { level: 'C1.2', title: 'C1.2 - Advanced', description: 'Structured Argumentation' },
    { level: 'C1.3', title: 'C1.3 - Advanced', description: 'Idiomatic Mastery' },
    { level: 'C2.1', title: 'C2.1 - Proficient', description: 'Professional and Casual Fluency' },
    { level: 'C2.2', title: 'C2.2 - Proficient', description: 'Academic and Creative Expression' },
    { level: 'C2.3', title: 'C2.3 - Proficient', description: 'Mastery and Nuance' }
  ];
  
  // For dropdown display/hide
  showLevelDropdown = false;
  
  // Mock data - in a real app this would come from services
  todaysGoal = {
    title: "Today's goal",
    description: "Complete 5 conversation lessons",
    progress: 0,
    total: 5,
    reward: "+5 points"
  };

  earnings = {
    total: 0, // Will be loaded from backend
    currency: 'points',
    change: 0,
    changeAmount: 0
  };

  progress = {
    daysStreak: 0,
    wordsLearned: 0,
    nextBadge: {
      requirement: 100,
      current: 0,
      reward: "100 points"
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
    private toastCtrl: ToastController,
    private lessonService: LessonService,
    private userProgressService: UserProgressService,
    private leaderboardService: LeaderboardService,
    private apiService: ApiService
  ) { 
    if (this.isDevMode) {
      this.setupDevTools();
    }
  }
  
  /**
   * Set up development tools and features
   * For debugging and testing purposes only
   */
  setupDevTools(): void {
    // Track API calls to see which are made
    const apiMethodsToTrack = ['get', 'post', 'put', 'delete'];
    
    // Track calls to the API service
    console.log('Development mode enabled - tracking API calls');
    
    // Add tracking for lesson service events
    this.lessonService.todaysLessons$.subscribe(lessons => {
      console.log('🔄 Lesson Service - Today\'s lessons updated:', lessons);
    });
    
    this.lessonService.recommendedLessons$.subscribe(lessons => {
      console.log('🔄 Lesson Service - Recommended lessons updated:', lessons);
    });
    
    this.lessonService.nextUncompletedLesson$.subscribe(lesson => {
      console.log('🔄 Lesson Service - Next lesson updated:', lesson);
    });
    
    this.userProgressService.userProgress$.subscribe(progress => {
      console.log('🔄 User Progress Service - Progress updated:', progress);
    });
  }

  async ngOnInit() {
    // Set the current day based on user's timezone
    this.setCurrentDayByTimezone();
    
    // Subscribe to user progress updates
    const progressSub = this.userProgressService.userProgress$.subscribe(progress => {
      if (progress) {
        this.userProgress = progress;
        
        // Set the CEFR level from user progress
        const levelObj = this.ceferLevels.find(l => l.level === progress.ceferLevel);
        if (levelObj) {
          this.userLevel = levelObj.title;
          // Update lesson service with the current level
          this.lessonService.setCurrentLevel(progress.ceferLevel);
        }
        
        // Update progress stats
        this.progress.daysStreak = progress.daysStreak;
        this.progress.wordsLearned = progress.wordsLearned;
        
        // Update progress for next badge
        if (progress.levelHistory.length > 0) {
          const currentLevelHistory = progress.levelHistory.find(h => h.level === progress.ceferLevel);
          if (currentLevelHistory) {
            this.progress.nextBadge.current = Math.round(currentLevelHistory.percentComplete);
          }
        }
        
        // Set if the user is new based on lessons completed
        this.isNewUser = progress.lessonsCompleted === 0;
        this.showNewUserGuide = this.isNewUser;
        this.showAdvancedSections = !this.isNewUser;
      }
    });
    this.subscriptions.push(progressSub);
    
    // Subscribe to lessons updates
    const lessonsSub = this.lessonService.todaysLessons$.subscribe(lessons => {
      this.todaysLessons = lessons;
      
      // Update today's goal progress based on lessons
      const completedLessons = lessons.filter(lesson => lesson.progress === 100).length;
      this.todaysGoal.progress = completedLessons;
    });
    this.subscriptions.push(lessonsSub);
    
    // Subscribe to recommended lessons
    const recommendedSub = this.lessonService.recommendedLessons$.subscribe(lessons => {
      this.recommendedLessons = lessons;
    });
    this.subscriptions.push(recommendedSub);
    
    // Subscribe to next lesson
    const nextLessonSub = this.lessonService.nextUncompletedLesson$.subscribe(lesson => {
      this.nextLesson = lesson;
    });
    this.subscriptions.push(nextLessonSub);
    
    await this.loadUserData();
    
    // Load lessons for the current day
    this.lessonService.loadLessonsForDay(this.selectedDay).subscribe();
    
    // Set active tab based on current route
    const currentPath = this.router.url.split('/').pop();
    if (currentPath === 'home' || currentPath === 'dashboard') {
      this.activeTab = 'home';
    } else if (currentPath === 'practice') {
      this.activeTab = 'learn';
    } else if (currentPath === 'progress') {
      this.activeTab = 'progress';
    } else if (currentPath === 'profile') {
      this.activeTab = 'profile';
    }
  }
  
  ngOnDestroy() {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Sets the current day based on user's timezone
   */
  setCurrentDayByTimezone() {
    // Get the current day based on the user's local timezone
    const currentDayIndex = moment().local().day();
    this.selectedDay = this.weekdays[currentDayIndex];
    
    console.log('Current day in user timezone:', this.selectedDay);
  }

  async loadUserData() {
    try {
      console.log('Starting to load dashboard data');
      
      // Use a longer timeout to ensure auth state propagation
      setTimeout(async () => {
        console.log('Loading dashboard data after timeout');
        
        try {
          // Load user data from services
          if (this.authService.currentUserValue) {
            console.log('User is authenticated:', this.authService.currentUserValue);
            
            // Set user name if available
            if (this.authService.currentUserValue.username) {
              this.userName = `Welcome, ${this.authService.currentUserValue.username}!`;
            } else {
              this.userName = 'Welcome to YAP!';
            }
            
            // Load user progress
            this.userProgressService.loadUserProgress();
            
            // Load user earnings data including waitlist bonus
            this.loadUserEarnings();
          } else {
            // Default settings for non-authenticated users
            this.isNewUser = true;
            this.showNewUserGuide = true;
            this.showAdvancedSections = false;
            
            // Make sure progress data is properly zeroed out for new users
            this.progress = {
              daysStreak: 0,
              wordsLearned: 0,
              nextBadge: {
                requirement: 100,
                current: 0,
                reward: "100 points"
              }
            };
            
            // Reset today's goal progress
            this.todaysGoal.progress = 0;
            
            // Set welcome message for new users
            this.userName = 'Welcome to YAP!';
          }
          
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

  /**
   * Load user earnings data including waitlist bonus from backend
   */
  async loadUserEarnings() {
    try {
      const user = this.authService.currentUserValue;
      if (!user || !user.id) {
        console.log('No authenticated user found for earnings data');
        return;
      }

      console.log('Loading user earnings data for user:', user.id);

      // Get user profile data which includes waitlist_bonus
      this.apiService.get<any>(`profile/${user.id}`).subscribe({
        next: (profile: any) => {
          console.log('User profile loaded:', profile);
          
          // Update earnings with waitlist bonus
          this.earnings = {
            total: profile.waitlist_bonus || 0,
            currency: 'points',
            change: 0,
            changeAmount: 0
          };
          
          console.log('Updated earnings:', this.earnings);
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          // Keep default earnings of 0 on error
          this.earnings = {
            total: 0,
            currency: 'points',
            change: 0,
            changeAmount: 0
          };
        }
      });

    } catch (error) {
      console.error('Error in loadUserEarnings:', error);
      // Keep default earnings of 0 on error
      this.earnings = {
        total: 0,
        currency: 'points',
        change: 0,
        changeAmount: 0
      };
    }
  }

  continueLearning() {
    this.showLevelDropdown = false; // Ensure dropdown is closed
    this.router.navigate(['/practice']);
  }

  withdraw() {
    this.router.navigate(['/profile']); // Could be wallet page
  }

  viewAllLeaderboard() {
    this.router.navigate(['/leaderboard']);
  }  navigateToHome() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'home';
    this.router.navigate(['/home']);
  }
  
  navigateToLearn() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'learn';
    this.router.navigate(['/practice']);
  }
  
  navigateToProgress() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'progress';
    this.router.navigate(['/progress']);
  }
  
  navigateToProfile() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'profile';
    this.router.navigate(['/profile']);
  }
  
  /**
   * Select a specific day and load relevant data
   * @param day The day to select (Sun, Mon, Tue, etc.)
   */
  selectDay(day: string) {
    this.selectedDay = day;
    
    // Load lessons for the selected day
    this.lessonService.loadLessonsForDay(day).subscribe(lessons => {
      console.log(`Loaded ${lessons.length} lessons for ${day}`);
    });
  }

  // Lesson interactions
  startLesson(lesson: Lesson) {
    // For development only - option to mark lesson as completed with a long press
    if (this.isDevMode) {
      const element = document.querySelector('.lesson-card[data-id="' + lesson.id + '"]');
      if (element) {
        // Add handler for right-click (development only)
        element.addEventListener('contextmenu', (e: Event) => {
          e.preventDefault();
          this.markLessonAsCompleted(lesson);
          return false;
        });
      }
    }
    
    // Navigate to the lesson
    this.router.navigate(['/practice'], { 
      queryParams: { 
        lessonId: lesson.id, 
        type: lesson.type 
      } 
    });
  }
  
  // Development helper - mark lesson as completed
  async markLessonAsCompleted(lesson: Lesson) {
    lesson.progress = 100;
    
    // Record the completion
    this.userProgressService.recordLessonCompletion(lesson.id, 10).subscribe(progress => {
      console.log('Lesson marked as completed:', lesson.title);
      
      // Show notification
      this.toastCtrl.create({
        message: `Lesson completed: ${lesson.title}`,
        duration: 2000,
        position: 'bottom'
      }).then(toast => toast.present());
      
      // Refresh data
      this.lessonService.loadLessonsForDay(this.selectedDay).subscribe();
      this.lessonService.updateRecommendedLessons();
    });
  }
  
  goToNextLesson() {
    if (this.nextLesson) {
      this.router.navigate(['/practice'], { 
        queryParams: { 
          lessonId: this.nextLesson.id, 
          type: this.nextLesson.type 
        } 
      });
    } else {
      // If no next lesson, go to general practice page
      this.router.navigate(['/practice'], { queryParams: { next: true } });
    }
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

  /**
   * Toggles the visibility of the level dropdown
   */
  toggleLevelDropdown(event: Event) {
    event.stopPropagation(); // Prevent event bubbling
    this.showLevelDropdown = !this.showLevelDropdown;
    
    // Add/remove backdrop and event handlers
    if (this.showLevelDropdown) {
      // Create backdrop if it doesn't exist
      let backdrop = document.querySelector('.level-dropdown-backdrop') as HTMLElement | null;
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'level-dropdown-backdrop';
        document.body.appendChild(backdrop);
        
        // Add click event to close dropdown when backdrop is clicked
        backdrop.addEventListener('click', () => {
          this.closeLevelDropdown();
        });
      }
      
      // Make backdrop visible with a slight delay to ensure smooth animation
      setTimeout(() => {
        if (backdrop) {
          backdrop.classList.add('active');
        }
      }, 10);
      
      // Also close dropdown when window is resized (to avoid UI issues)
      window.addEventListener('resize', this.closeLevelDropdown.bind(this));
    } else {
      this.closeLevelDropdown();
    }
  }
  
  /**
   * Closes the level dropdown
   */
  closeLevelDropdown() {
    this.showLevelDropdown = false;
    
    // Remove backdrop
    const backdrop = document.querySelector('.level-dropdown-backdrop') as HTMLElement | null;
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => {
        // Check both backdrop and parentNode are not null
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }, 300); // Match the CSS transition duration
    }
    
    // Remove resize event listener
    window.removeEventListener('resize', this.closeLevelDropdown.bind(this));
  }
  
  /**
   * Selects a specific CEFR level
   * @param level The selected level object
   */
  selectLevel(level: any, event: Event) {
    event.stopPropagation(); // Prevent event bubbling
    this.userLevel = level.title;
    
    // Use the proper closing method to ensure the backdrop is also removed
    this.closeLevelDropdown();
    
    console.log(`Selected level: ${level.level} - ${level.description}`);
    
    // Update lesson content based on selected level
    this.updateLessonContent(level);
    
    // Show loading state briefly when changing levels
    this.isLoading = true;
    
    // Update the user's current level in the progress service
    this.userProgressService.updateCurrentLevel(level.level).subscribe(progress => {
      console.log('Updated user progress level:', progress.ceferLevel);
      
      // Update the lesson service and load lessons for this level
      this.lessonService.setCurrentLevel(level.level);
      this.lessonService.loadLessonsForDay(this.selectedDay).subscribe(lessons => {
        console.log(`Loaded ${lessons.length} lessons for level ${level.level}`);
        // Hide loading state after lessons are loaded
        this.isLoading = false;
      });
    });
  }
  
  /**
   * Updates lesson content based on the selected level
   * @param level The selected CEFR level
   */
  updateLessonContent(level: any) {
    // Set lesson title based on the selected level's description
    const lessonTitle = document.querySelector('.lessons-section .lesson-title');
    if (lessonTitle) {
      lessonTitle.textContent = level.description;
    }
    
    // Get current user progress
    const userProgress = this.userProgressService.getCurrentProgressValue();
      
    // Find level history for this level
    const levelHistory = userProgress?.levelHistory?.find(
      (h: LevelHistoryEntry) => h.level === level.level
    );
    
    // Customize the goal based on user's progress in this level
    if (levelHistory) {
      const percentComplete = levelHistory.percentComplete || 0;
      const lessonsCompleted = levelHistory.lessonsCompleted || 0;
      const totalLessons = this.getLevelTotalLessons(level.level);
      
      // Calculate remaining lessons
      const remainingLessons = Math.max(1, totalLessons - lessonsCompleted);
      
      // Set different goals based on progress
      if (percentComplete < 25) {
        this.todaysGoal = {
          title: "Today's goal",
          description: `Practice ${level.title} conversation phrases`,
          progress: lessonsCompleted,
          total: Math.min(3, remainingLessons),
          reward: "+5 points"
        };
      } else if (percentComplete < 50) {
        this.todaysGoal = {
          title: "Today's goal",
          description: `Master new ${level.title} conversations`,
          progress: lessonsCompleted % 5,
          total: Math.min(5, remainingLessons),
          reward: "+10 points"
        };
      } else if (percentComplete < 75) {
        this.todaysGoal = {
          title: "Today's goal",
          description: `Enhance your ${level.title} conversation skills`,
          progress: lessonsCompleted % 7,
          total: Math.min(7, remainingLessons),
          reward: "+15 points"
        };
      } else {
        this.todaysGoal = {
          title: "Today's goal",
          description: `Perfect your ${level.title} conversations to earn a certificate`,
          progress: lessonsCompleted % 3,
          total: Math.min(3, remainingLessons),
          reward: "+20 points"
        };
      }
    } else {
      // Default goal for new level
      this.todaysGoal = {
        title: "Today's goal",
        description: `Start your first ${level.title} conversations`,
        progress: 0,
        total: 3,
        reward: "+5 points"
      };
    }
    
    // Also refresh the recommended lessons
    this.lessonService.updateRecommendedLessons();
  }
  
  /**
   * Check if user should move to next CEFR level
   */
  async checkNextLevel() {
    const currentLevel = this.userLevel.split(' - ')[0]; // Extract the level code
    
    const nextLevel = this.userProgressService.getNextLevel(currentLevel);
    if (nextLevel) {
      // Find the corresponding level object
      const nextLevelObj = this.ceferLevels.find(l => l.level === nextLevel);
      if (nextLevelObj) {
        // Show confirmation toast
        const toast = await this.toastCtrl.create({
          header: 'Level Up!',
          message: `Great job! You're ready to move to ${nextLevelObj.title}. Would you like to level up now?`,
          position: 'middle',
          buttons: [
            {
              text: 'Not Yet',
              role: 'cancel'
            },
            {
              text: 'Level Up',
              handler: () => {
                this.selectLevel(nextLevelObj, new Event('click'));
              }
            }
          ],
          cssClass: 'level-up-toast',
          duration: 5000
        });
        
        await toast.present();
      }
    }
  }
  
  /**
   * Helper to get total conversation lessons for a specific CEFR level
   */
  private getLevelTotalLessons(level: string): number {
    if (level.startsWith('A1')) return 12;
    if (level.startsWith('A2')) return 14;
    if (level.startsWith('B1')) return 16;
    if (level.startsWith('B2')) return 18;
    if (level.startsWith('C1')) return 20;
    return 22; // C2 levels
  }
  
  /**
   * Get the current level progress percentage
   */
  getLevelProgress(): number {
    if (!this.userProgress) return 0;
    
    const levelHistory = this.userProgress.levelHistory.find(
      h => h.level === this.userProgress?.ceferLevel
    );
    
    return levelHistory ? Math.round(levelHistory.percentComplete) : 0;
  }
}
