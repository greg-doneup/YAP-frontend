import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../../shared/services/wallet.service';
import { TokenService } from '../../../services/token.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastController, ModalController } from '@ionic/angular';
import * as moment from 'moment-timezone';
import { LessonService, Lesson } from '../../../shared/services/lesson.service';
import { UserProgressService, UserProgress, LevelHistoryEntry } from '../../../shared/services/user-progress.service';
import { LeaderboardService } from '../../../core/leaderboard/leaderboard.service';
import { ApiService } from '../../../core/api-service.service';
import { DailyAllowanceService, DailyAllowance, LessonAccess } from '../../../services/daily-allowance.service';
import { DismissedCardsService } from '../../../shared/services/dismissed-cards.service';
import { DailyTrackerData } from '../../../shared/components/daily-tracker/daily-tracker.component';
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
  userLevel = 'A1 - Beginner';
  activeTab = 'progress'; // Default active tab
  
  // Dismissible cards
  showWelcomeCard = true;
  showProgressCard = true;
  
  // Daily tracker data
  dailyTrackerData: DailyTrackerData = {
    level: 'A1 - Beginner',
    levelProgress: 0,
    streak: 0,
    lessonsToday: 0,
    dailyGoal: 5,
    pointsEarned: 0
  };
  
  // Lesson properties
  todaysLessons: Lesson[] = [];
  nextLesson: Lesson | null = null;
  
  // User progress
  userProgress: UserProgress | null = null;
  
  // Daily allowances
  dailyAllowances: DailyAllowance[] = [];
  currentLessonAccess: LessonAccess | null = null;
  
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
    private tokenService: TokenService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private modalController: ModalController,
    private lessonService: LessonService,
    private userProgressService: UserProgressService,
    private leaderboardService: LeaderboardService,
    private apiService: ApiService,
    private dailyAllowanceService: DailyAllowanceService,
    private dismissedCardsService: DismissedCardsService
  ) { 
    if (this.isDevMode) {
      this.setupDevTools();
    }
    
    // Initialize dismissed cards state
    this.initializeDismissedCardsState();
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
    
    this.lessonService.nextUncompletedLesson$.subscribe(lesson => {
      console.log('🔄 Lesson Service - Next lesson updated:', lesson);
    });
    
    this.userProgressService.userProgress$.subscribe(progress => {
      console.log('🔄 User Progress Service - Progress updated:', progress);
    });
  }

  async ngOnInit() {
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
        
        // Update daily tracker data
        this.updateDailyTrackerData();
      }
    });
    this.subscriptions.push(progressSub);
    
    // Subscribe to lessons updates
    const lessonsSub = this.lessonService.todaysLessons$.subscribe(lessons => {
      this.todaysLessons = lessons;
      // Update daily tracker data (will use allowance data, not lesson count)
      this.updateDailyTrackerData();
    });
    this.subscriptions.push(lessonsSub);
    
    // Subscribe to next lesson
    const nextLessonSub = this.lessonService.nextUncompletedLesson$.subscribe(lesson => {
      this.nextLesson = lesson;
    });
    this.subscriptions.push(nextLessonSub);
    
    // Subscribe to daily allowances
    const allowancesSub = this.dailyAllowanceService.dailyAllowances$.subscribe(allowances => {
      this.dailyAllowances = allowances;
      // Update daily tracker when allowances change
      this.updateDailyTrackerData();
    });
    this.subscriptions.push(allowancesSub);
    
    // Get current lesson access status
    const lessonAccessSub = this.dailyAllowanceService.canAccessLesson().subscribe(access => {
      this.currentLessonAccess = access;
    });
    this.subscriptions.push(lessonAccessSub);
    
    await this.loadUserData();
    
    // Load lessons for today
    this.lessonService.loadLessonsForDay('today').subscribe();
    
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
   * Initialize the state of dismissible cards
   */
  initializeDismissedCardsState(): void {
    this.showWelcomeCard = !this.dismissedCardsService.isCardDismissed('welcome-card');
    this.showProgressCard = !this.dismissedCardsService.isCardDismissed('progress-card');
  }
  
  /**
   * Dismiss a card with the specified persistence
   */
  dismissCard(cardId: string, isPersistent: boolean = false): void {
    this.dismissedCardsService.dismissCard(cardId, isPersistent);
    
    // Update local state
    switch (cardId) {
      case 'welcome-card':
        this.showWelcomeCard = false;
        break;
      case 'progress-card':
        this.showProgressCard = false;
        break;
    }
  }
  
  /**
   * Update daily tracker data based on user progress and allowances
   */
  updateDailyTrackerData(): void {
    if (this.userProgress) {
      // Get lessons used today from allowances
      const lessonAllowance = this.dailyAllowances.find(a => a.featureName === 'Daily Lessons');
      const lessonsUsedToday = lessonAllowance ? lessonAllowance.used : 0;
      const dailyGoal = lessonAllowance ? lessonAllowance.dailyLimit : 5;
      
      this.dailyTrackerData = {
        level: this.userLevel,
        levelProgress: this.getLevelProgress(),
        streak: this.userProgress.daysStreak,
        lessonsToday: lessonsUsedToday,
        dailyGoal: dailyGoal,
        pointsEarned: this.earnings.changeAmount
      };
      
      // Also update the todaysGoal to keep it in sync
      this.todaysGoal.progress = lessonsUsedToday;
      this.todaysGoal.total = dailyGoal;
    }
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

      // First attempt: Try to get data from the dashboard endpoint
      this.leaderboardService.getUserDashboard(user.walletAddress || '').subscribe({
        next: (dashboardData) => {
          console.log('Dashboard data loaded:', dashboardData);
          
          // The dashboard doesn't return waitlist_bonus directly, so check from auth service
          const authResponse = this.authService.getAuthResponse();
          const waitlistBonus = authResponse?.starting_points || 0;
          
          this.earnings = {
            total: waitlistBonus,
            currency: 'points',
            change: 0,
            changeAmount: 0
          };
          
          console.log('Updated earnings from auth response:', this.earnings);
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          // Standard registration should have 0 points as fallback
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
      // As a last resort, try to get data directly from the auth response
      const authResponse = this.authService.getAuthResponse();
      const waitlistBonus = authResponse?.starting_points || authResponse?.waitlist_bonus || 0;
      
      this.earnings = {
        total: waitlistBonus,
        currency: 'points',
        change: 0,
        changeAmount: 0
      };
    }
  }

  continueLearning() {
    this.showLevelDropdown = false; // Ensure dropdown is closed
    this.router.navigate(['/vocab-practice']);
  }

  withdraw() {
    this.router.navigate(['/profile']); // Could be wallet page
  }

  viewAllLeaderboard() {
    this.router.navigate(['/leaderboard']);
  }  navigateToHome() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'home';
    // Stay on dashboard for home
  }
  
  navigateToAiChat() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'ai-chat';
    this.openAiChat(); // Use existing AI chat logic
  }
  
  navigateToQuiz() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'quiz';
    this.router.navigate(['/quiz']);
  }
  
  navigateToProfile() {
    this.showLevelDropdown = false; // Close dropdown
    this.activeTab = 'profile';
    this.router.navigate(['/profile']);
  }
  
  /**
   * Open AI Chat with allowance and token verification
   */
  async openAiChat() {
    try {
      // First check if user has free allowances
      const allowanceCheck = await this.tokenService.canUseFeature('ai-chat').toPromise();
      
      if (allowanceCheck?.canUse && (allowanceCheck.allowanceRemaining || 0) > 0) {
        // User has free allowances, can proceed
        this.router.navigate(['/ai-chat']);
        return;
      }

      // No free allowances, check token balance
      const tokenBalance = await this.tokenService.getTokenBalance().toPromise();
      
      if (!tokenBalance || tokenBalance.balance < 5) {
        // Show token spending modal or insufficient balance warning
        const toast = await this.toastCtrl.create({
          message: 'No free AI chat messages remaining today and insufficient tokens. You need at least 5 tokens, or wait for your daily allowance to reset.',
          duration: 4000,
          color: 'warning',
          position: 'top'
        });
        await toast.present();
        return;
      }
      
      // Navigate to AI chat page
      this.router.navigate(['/ai-chat']);
    } catch (error) {
      console.error('Error opening AI chat:', error);
      const toast = await this.toastCtrl.create({
        message: 'Unable to start AI chat. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }
  
  /**
   * Check if user has AI chat time remaining
   */
  hasAIChatTimeRemaining(): boolean {
    const chatAllowance = this.dailyAllowances.find(a => a.featureName === 'AI Chat');
    return chatAllowance ? chatAllowance.remaining > 0 : false;
  }

  /**
   * Get remaining AI chat time
   */
  getAIChatTimeRemaining(): number {
    const chatAllowance = this.dailyAllowances.find(a => a.featureName === 'AI Chat');
    return chatAllowance ? chatAllowance.remaining : 0;
  }

  /**
   * Start AI chat session
   */
  async startAIChat() {
    if (!this.hasAIChatTimeRemaining()) {
      const toast = await this.toastCtrl.create({
        message: 'Daily AI chat limit reached. Purchase more time with YAP tokens!',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    // TODO: Navigate to AI chat interface
    console.log('Starting AI chat session...');
    
    const toast = await this.toastCtrl.create({
      message: 'AI Chat feature coming soon!',
      duration: 2000,
      color: 'success'
    });
    
    await toast.present();
  }

  // Lesson interactions
  async startLesson(lesson: Lesson) {
    // Check lesson access first
    if (!this.currentLessonAccess?.canAccessLesson) {
      await this.showLessonAccessDialog();
      return;
    }
    
    // Use a lesson allowance if available
    if (this.currentLessonAccess.allowanceRemaining > 0) {
      this.dailyAllowanceService.useLessonAllowance();
    }
    
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
    this.router.navigate(['/vocab-practice'], { 
      queryParams: { 
        lessonId: lesson.id, 
        type: lesson.type 
      } 
    });
  }
  
  /**
   * Show dialog when lesson access is restricted
   */
  async showLessonAccessDialog() {
    const alert = await this.toastCtrl.create({
      header: 'Daily Limit Reached',
      message: 'You have used your 5 free lessons today. Purchase unlimited access or wait until tomorrow.',
      buttons: [
        {
          text: 'Wait Until Tomorrow',
          role: 'cancel'
        },
        {
          text: '3 YAP (Today)',
          handler: () => {
            this.purchaseUnlimitedLessons('day');
          }
        },
        {
          text: '20 YAP (Week)',
          handler: () => {
            this.purchaseUnlimitedLessons('week');
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  /**
   * Purchase unlimited lesson access
   */
  async purchaseUnlimitedLessons(duration: 'day' | 'week' | 'month') {
    const cost = duration === 'day' ? 3 : duration === 'week' ? 20 : 75;
    
    // TODO: Integrate with actual token spending
    console.log(`Purchasing unlimited lessons for ${duration} at cost of ${cost} YAP tokens`);
    
    const toast = await this.toastCtrl.create({
      message: `Token spending for unlimited lessons coming soon! (${cost} YAP for ${duration})`,
      duration: 3000,
      color: 'warning'
    });
    
    await toast.present();
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
      this.lessonService.loadLessonsForDay('today').subscribe();
    });
  }
  
  goToNextLesson() {
    if (this.nextLesson) {
      this.router.navigate(['/vocab-practice'], { 
        queryParams: { 
          lessonId: this.nextLesson.id, 
          type: this.nextLesson.type 
        } 
      });
    } else {
      // If no next lesson, go to general practice page
      this.router.navigate(['/vocab-practice'], { queryParams: { next: true } });
    }
  }
  
  goToPronunciationPractice() {
    this.showLevelDropdown = false; // Ensure dropdown is closed
    this.router.navigate(['/practice']);
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
   * Attempts to select a specific CEFR level (with progression validation)
   * @param level The selected level object
   */
  selectLevel(level: any, event: Event) {
    event.stopPropagation(); // Prevent event bubbling
    
    // Check if level is unlocked
    if (!this.isLevelUnlocked(level.level)) {
      this.showLevelUnlockDialog(level);
      return;
    }
    
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
      this.lessonService.loadLessonsForDay('today').subscribe(lessons => {
        console.log(`Loaded ${lessons.length} lessons for level ${level.level}`);
        // Hide loading state after lessons are loaded
        this.isLoading = false;
      });
    });
  }
  
  /**
   * Check if a CEFR level is unlocked for the user
   */
  isLevelUnlocked(level: string): boolean {
    const progress = this.userProgressService.getCurrentProgressValue();
    if (!progress) return level === 'A1.1'; // Only A1.1 unlocked for new users
    
    const levels = [
      'A1.1', 'A1.2', 'A1.3', 
      'A2.1', 'A2.2', 'A2.3',
      'B1.1', 'B1.2', 'B1.3',
      'B2.1', 'B2.2', 'B2.3',
      'C1.1', 'C1.2', 'C1.3',
      'C2.1', 'C2.2', 'C2.3'
    ];
    
    const currentIndex = levels.indexOf(progress.ceferLevel);
    const targetIndex = levels.indexOf(level);
    
    // Can only access current level or previous completed levels
    return targetIndex <= currentIndex;
  }

  /**
   * Show dialog for unlocking a level with tokens
   */
  async showLevelUnlockDialog(level: any) {
    const alert = await this.toastCtrl.create({
      header: 'Level Locked',
      message: `Complete ${this.userLevel} lessons to unlock ${level.title}, or spend 5 YAP tokens to skip ahead.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Spend 5 YAP',
          handler: () => {
            this.purchaseLevelUnlock(level);
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Purchase level unlock with tokens
   */
  async purchaseLevelUnlock(level: any) {
    // TODO: Integrate with token service when ready
    console.log(`Attempting to unlock ${level.level} with 5 YAP tokens`);
    
    // For now, show a toast
    const toast = await this.toastCtrl.create({
      message: 'Token spending feature coming soon!',
      duration: 2000,
      color: 'warning'
    });
    
    await toast.present();
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

  /**
   * Get appropriate icon for lesson type
   */
  getLessonTypeIcon(type: string): string {
    switch (type) {
      case 'practice':
      case 'conversation':
        return 'chatbubbles';
      case 'quiz':
        return 'help-circle';
      case 'pronunciation':
        return 'mic';
      case 'flashcard':
      case 'review':
        return 'library';
      default:
        return 'book';
    }
  }

  /**
   * Get user-friendly label for lesson type
   */
  getLessonTypeLabel(type: string): string {
    switch (type) {
      case 'practice':
        return 'AI Conversation';
      case 'conversation':
        return 'AI Chat';
      case 'quiz':
        return 'Quiz';
      case 'pronunciation':
        return 'Pronunciation';
      case 'flashcard':
        return 'Review';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
}
