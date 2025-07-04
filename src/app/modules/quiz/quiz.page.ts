import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { UserProgressService } from '../../shared/services/user-progress.service';
import { TokenService } from '../../services/token.service';
import { QuizService, QuizQuestion, QuizResult, DailyQuizStatus } from '../../services/quiz.service';

export interface QuizAttempt {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  feedback: string;
  audioUrl?: string;
}

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.page.html',
  styleUrls: ['./quiz.page.scss'],
})
export class QuizPage implements OnInit, OnDestroy {
  // Quiz state
  currentQuestion: QuizQuestion | null = null;
  currentQuestionIndex = 0;
  totalQuestions = 0;
  isLoading = false;
  isProcessing = false;
  userAnswer = '';
  
  // Quiz session data
  sessionAttempts: QuizAttempt[] = [];
  sessionScore = 0;
  sessionTokensEarned = 0;
  showResults = false;
  
  // Daily quiz tracking
  dailyStatus: DailyQuizStatus | null = null;
  canTakeQuiz = true;
  
  // User data
  userCefrLevel = 'A1';
  
  // Audio recording for pronunciation
  isRecording = false;
  mediaRecorder?: MediaRecorder;
  audioChunks: Blob[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private userProgressService: UserProgressService,
    private tokenService: TokenService,
    private quizService: QuizService
  ) {}

  ngOnInit() {
    this.initializeQuiz();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopRecording();
  }

  /**
   * Initialize quiz session
   */
  async initializeQuiz() {
    this.isLoading = true;
    
    try {
      // Get user's CEFR level
      const userProgress = await this.getUserProgress();
      if (userProgress) {
        this.userCefrLevel = userProgress.ceferLevel;
      }
      
      // Check daily quiz status
      this.dailyStatus = await this.quizService.getDailyQuizStatus();
      
      if (this.dailyStatus.remainingQuizzes <= 0) {
        this.canTakeQuiz = false;
        await this.showDailyLimitReached();
        return;
      }
      
      // Load quiz questions based on user's level and recent chat words
      await this.loadQuizQuestions();
      
    } catch (error) {
      console.error('Error initializing quiz:', error);
      await this.showErrorToast('Failed to load quiz. Please try again.');
      this.router.navigate(['/dashboard']);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get user progress including CEFR level
   */
  private async getUserProgress() {
    return new Promise<any>((resolve) => {
      const sub = this.userProgressService.userProgress$.subscribe(progress => {
        resolve(progress);
      });
      this.subscriptions.push(sub);
    });
  }

  /**
   * Load quiz questions based on user's CEFR level and recent chat words
   */
  private async loadQuizQuestions() {
    const questions = await this.quizService.generateCefrBasedQuiz({
      cefrLevel: this.userCefrLevel,
      includeRecentChatWords: true,
      questionCount: 5
    });
    
    if (questions && questions.length > 0) {
      this.totalQuestions = questions.length;
      this.currentQuestionIndex = 0;
      this.currentQuestion = questions[0];
    } else {
      throw new Error('No quiz questions available');
    }
  }

  /**
   * Submit text answer
   */
  async submitTextAnswer() {
    if (!this.userAnswer.trim() || !this.currentQuestion) return;
    
    this.isProcessing = true;
    
    try {
      const result = await this.quizService.submitAnswer({
        questionId: this.currentQuestion.id,
        userAnswer: this.userAnswer.trim(),
        questionType: 'text',
        cefrLevel: this.userCefrLevel
      });
      
      await this.processAnswerResult(result);
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      await this.showErrorToast('Failed to submit answer. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start audio recording for pronunciation quiz
   */
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        await this.submitAudioAnswer(audioBlob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

    } catch (error) {
      console.error('Error starting recording:', error);
      await this.showErrorToast('Could not access microphone');
    }
  }

  /**
   * Stop audio recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Stop all tracks to release microphone
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Submit audio answer for pronunciation assessment
   */
  private async submitAudioAnswer(audioBlob: Blob) {
    if (!this.currentQuestion) return;
    
    this.isProcessing = true;
    
    try {
      const result = await this.quizService.submitAnswer({
        questionId: this.currentQuestion.id,
        audioData: audioBlob,
        questionType: 'pronunciation',
        cefrLevel: this.userCefrLevel
      });
      
      await this.processAnswerResult(result);
      
    } catch (error) {
      console.error('Error submitting audio answer:', error);
      await this.showErrorToast('Failed to process audio. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process the result of an answer submission
   */
  private async processAnswerResult(result: QuizResult) {
    const attempt: QuizAttempt = {
      questionId: this.currentQuestion!.id,
      userAnswer: result.userAnswer,
      correctAnswer: result.correctAnswer,
      isCorrect: result.isCorrect,
      points: result.pointsEarned,
      feedback: result.feedback,
      audioUrl: result.audioUrl
    };
    
    this.sessionAttempts.push(attempt);
    this.sessionScore += result.pointsEarned;
    
    // Show immediate feedback
    await this.showAnswerFeedback(result);
    
    // Move to next question or show results
    if (this.currentQuestionIndex < this.totalQuestions - 1) {
      this.nextQuestion();
    } else {
      await this.completeQuiz();
    }
  }

  /**
   * Show feedback for the current answer
   */
  private async showAnswerFeedback(result: QuizResult) {
    const alert = await this.alertController.create({
      header: result.isCorrect ? '✓ Correct!' : '✗ Incorrect',
      message: `
        <p><strong>Your answer:</strong> ${result.userAnswer}</p>
        <p><strong>Correct answer:</strong> ${result.correctAnswer}</p>
        <p><strong>Points earned:</strong> ${result.pointsEarned}</p>
        <br>
        <p>${result.feedback}</p>
      `,
      buttons: ['Continue'],
      cssClass: result.isCorrect ? 'quiz-feedback-correct' : 'quiz-feedback-incorrect'
    });
    
    await alert.present();
  }

  /**
   * Move to the next question
   */
  private async nextQuestion() {
    this.currentQuestionIndex++;
    this.userAnswer = '';
    
    const questions = await this.quizService.getQuizQuestions();
    if (questions && questions[this.currentQuestionIndex]) {
      this.currentQuestion = questions[this.currentQuestionIndex];
    }
  }

  /**
   * Complete the quiz and show results
   */
  private async completeQuiz() {
    const loading = await this.loadingController.create({
      message: 'Processing quiz results...'
    });
    await loading.present();
    
    try {
      // Submit final quiz results and get tokens
      const finalResult = await this.quizService.completeQuiz({
        attempts: this.sessionAttempts,
        totalScore: this.sessionScore,
        cefrLevel: this.userCefrLevel
      });
      
      this.sessionTokensEarned = finalResult.tokensEarned;
      this.showResults = true;
      
      // Update daily quiz status
      this.dailyStatus = await this.quizService.getDailyQuizStatus();
      
      await this.showCompletionToast();
      
    } catch (error) {
      console.error('Error completing quiz:', error);
      await this.showErrorToast('Failed to save quiz results');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Show daily limit reached message
   */
  private async showDailyLimitReached() {
    const alert = await this.alertController.create({
      header: 'Daily Quiz Limit Reached',
      message: `You've completed all your quizzes for today! You can take up to ${this.dailyStatus?.maxDailyQuizzes || 4} quizzes per day. Come back tomorrow for more quiz challenges.`,
      buttons: [
        {
          text: 'View Progress',
          handler: () => {
            this.router.navigate(['/dashboard']);
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Show completion toast
   */
  private async showCompletionToast() {
    const toast = await this.toastController.create({
      message: `Quiz completed! You earned ${this.sessionTokensEarned} tokens and ${this.sessionScore} points.`,
      duration: 3000,
      color: 'success',
      position: 'top'
    });
    
    await toast.present();
  }

  /**
   * Show error toast
   */
  private async showErrorToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    
    await toast.present();
  }

  /**
   * Return to dashboard
   */
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Take another quiz (if daily limit allows)
   */
  async takeAnotherQuiz() {
    if (this.dailyStatus && this.dailyStatus.remainingQuizzes > 0) {
      // Reset quiz state
      this.currentQuestion = null;
      this.currentQuestionIndex = 0;
      this.sessionAttempts = [];
      this.sessionScore = 0;
      this.sessionTokensEarned = 0;
      this.showResults = false;
      this.userAnswer = '';
      
      // Initialize new quiz
      await this.initializeQuiz();
    } else {
      await this.showDailyLimitReached();
    }
  }

  /**
   * Get progress percentage
   */
  get progressPercentage(): number {
    if (this.totalQuestions === 0) return 0;
    return ((this.currentQuestionIndex) / this.totalQuestions) * 100;
  }

  /**
   * Get current question number display
   */
  get currentQuestionNumber(): number {
    return this.currentQuestionIndex + 1;
  }

  /**
   * Get icon for current question type
   */
  getQuestionIcon(): string {
    if (!this.currentQuestion) return 'help-circle';
    
    switch (this.currentQuestion.type) {
      case 'pronunciation': return 'mic';
      case 'multiple_choice': return 'radio-button-on';
      case 'translation': return 'language';
      case 'text': return 'create';
      default: return 'help-circle';
    }
  }

  /**
   * Get title for current question type
   */
  getQuestionTypeTitle(): string {
    if (!this.currentQuestion) return 'Quiz Question';
    
    switch (this.currentQuestion.type) {
      case 'pronunciation': return 'Pronunciation Practice';
      case 'multiple_choice': return 'Multiple Choice';
      case 'translation': return 'Translation';
      case 'text': return 'Text Answer';
      default: return 'Quiz Question';
    }
  }

  /**
   * Play question audio
   */
  playQuestionAudio() {
    if (this.currentQuestion?.audioUrl) {
      const audio = new Audio(this.currentQuestion.audioUrl);
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        this.showErrorToast('Could not play audio');
      });
    }
  }

  /**
   * Get accuracy percentage from session attempts
   */
  getAccuracyPercentage(): number {
    if (this.sessionAttempts.length === 0) return 0;
    
    const correctAnswers = this.sessionAttempts.filter(attempt => attempt.isCorrect).length;
    return Math.round((correctAnswers / this.sessionAttempts.length) * 100);
  }
}
