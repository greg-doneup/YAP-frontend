import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { PronunciationService, AudioRecording } from '../../core/pronunciation/pronunciation.service';
import { DetailedPronunciationResult } from '../../core/pronunciation/pronunciation.model';
import { LearningService, VocabItem } from '../../core/learning/learning.service';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from '../../core/profile/profile.service';

interface PracticePhrase {
  id: string;
  targetText: string;
  translation: string;
  languageCode: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  lessonId?: string;
  lessonTitle?: string;
  language?: string;
}

@Component({
  selector: 'app-pronunciation-practice',
  templateUrl: './pronunciation-practice.page.html',
  styleUrls: ['./pronunciation-practice.page.scss'],
})
export class PronunciationPracticePage implements OnInit, OnDestroy {
  // Current practice state
  currentPhrase: PracticePhrase | null = null;
  currentLanguageCode = '';
  userLanguageToLearn = '';
  currentLessonLevel = 'A1.1';
  currentLessonNumber = 1;
  
  // Practice phrases from current lesson
  lessonPhrases: PracticePhrase[] = [];
  currentPhraseIndex = 0;
  totalPhrases = 0;

  // Recording state
  recordingState: 'ready' | 'recording' | 'processing' | 'complete' = 'ready';
  recordingAudio: HTMLAudioElement | null = null;
  
  // Pronunciation results
  pronunciationResult: DetailedPronunciationResult | null = null;
  showWordAnalysis = false;
  
  // TTS Audio
  nativeAudio: HTMLAudioElement | null = null;
  isPlayingNative = false;
  isPlayingRecording = false;

  // Component state
  isLoading = true;
  currentUser: any = null;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pronunciationService: PronunciationService,
    private learningService: LearningService,
    private authService: AuthService,
    private profileService: ProfileService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.loadUserLanguageAndPhrases();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopAudio();
  }

  /**
   * Load user's language preference and current lesson phrases
   */
  async loadUserLanguageAndPhrases() {
    this.isLoading = true;
    
    try {
      // Get current user
      const currentUser = this.authService.currentUserValue;
      if (!currentUser?.id) {
        // Use fallback user for development
        this.userLanguageToLearn = 'spanish';
        this.currentLanguageCode = 'es-ES';
      } else {
        try {
          // Get user profile to determine language preference
          const userProfile = await this.profileService.getUserProfile(currentUser.id).toPromise();
          // Map language to language code - use fallback since this UserProfile doesn't have language preference
          this.userLanguageToLearn = 'spanish'; // Fallback since profile doesn't include language preference
          this.currentLanguageCode = this.getLanguageCode(this.userLanguageToLearn);
        } catch (error) {
          console.log('Using fallback user and language for development');
          this.userLanguageToLearn = 'spanish';
          this.currentLanguageCode = 'es-ES';
        }
      }
      
      // Load vocabulary for the user's current lesson
      await this.loadCurrentLessonPhrases();
      
    } catch (error) {
      console.error('Error loading user language:', error);
      // Fallback to Spanish for development
      this.userLanguageToLearn = 'spanish';
      this.currentLanguageCode = 'es-ES';
      await this.loadCurrentLessonPhrases();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load phrases from user's current lesson based on CEFR progression
   */
  async loadCurrentLessonPhrases() {
    try {
      // Get vocabulary items from the learning service (which provides CEFR-based content)
      const vocabulary = await this.learningService.getDailyVocab().toPromise();
      
      if (vocabulary && vocabulary.length > 0) {
        // Convert vocabulary items to practice phrases
        this.lessonPhrases = vocabulary.map(item => ({
          id: item.id || `vocab-${Date.now()}-${Math.random()}`,
          targetText: item.term,
          translation: item.translation,
          languageCode: this.currentLanguageCode,
          difficulty: 'beginner' as const,
          category: 'vocabulary',
          lessonId: 'daily-vocab',
          lessonTitle: 'Daily Vocabulary',
          language: this.userLanguageToLearn
        }));
        
        this.totalPhrases = this.lessonPhrases.length;
        this.currentPhraseIndex = 0;
        this.currentPhrase = this.lessonPhrases[0];
        
        // Update lesson info based on loaded data
        console.log('Loaded vocabulary for pronunciation practice');
      } else {
        // No vocabulary available, show error
        this.currentPhrase = null;
      }
    } catch (error) {
      console.error('Error loading lesson phrases:', error);
      this.currentPhrase = null;
    }
  }

  /**
   * Update lesson level and number based on vocabulary data
   */
  updateLessonInfo(vocabItem: any) {
    // Set default CEFR level based on user's progress
    this.currentLessonLevel = 'A1.1';
    this.currentLessonNumber = 1;
    
    // If we have lesson metadata, use it
    if (vocabItem.lessonTitle) {
      // Extract lesson info from title if available
      const lessonMatch = vocabItem.lessonTitle.match(/(\w+)\s+(\d+)/);
      if (lessonMatch) {
        this.currentLessonNumber = parseInt(lessonMatch[2], 10);
      }
    }
  }

  /**
   * Map language name to language code
   */
  getLanguageCode(language: string): string {
    const languageMap: { [key: string]: string } = {
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'german': 'de-DE',
      'italian': 'it-IT',
      'portuguese': 'pt-BR',
      'japanese': 'ja-JP',
      'korean': 'ko-KR',
      'english': 'en-US'
    };
    
    return languageMap[language.toLowerCase()] || 'es-ES';
  }

  /**
   * Get current lesson level for display
   */
  getCurrentLessonLevel(): string {
    return this.currentLessonLevel;
  }

  /**
   * Get current lesson number for display
   */
  getCurrentLessonNumber(): number {
    return this.currentLessonNumber;
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage(): number {
    if (this.totalPhrases === 0) return 0;
    return ((this.currentPhraseIndex + 1) / this.totalPhrases) * 100;
  }

  /**
   * Skip to next phrase
   */
  skipToNextPhrase() {
    this.loadNextPhrase();
  }

  /**
   * Load next phrase in the lesson
   */
  loadNextPhrase() {
    if (this.currentPhraseIndex < this.lessonPhrases.length - 1) {
      this.currentPhraseIndex++;
      this.currentPhrase = this.lessonPhrases[this.currentPhraseIndex];
      this.resetRecordingState();
    } else {
      // Lesson completed, show completion message or load next lesson
      this.showLessonCompletionAlert();
    }
  }

  /**
   * Show lesson completion alert
   */
  async showLessonCompletionAlert() {
    const alert = await this.alertController.create({
      header: 'Lesson Complete!',
      message: `Great job! You've completed all ${this.totalPhrases} phrases in this lesson.`,
      buttons: [
        {
          text: 'Back to Dashboard',
          handler: () => {
            this.router.navigate(['/dashboard']);
          }
        },
        {
          text: 'Practice Again',
          handler: () => {
            this.currentPhraseIndex = 0;
            this.currentPhrase = this.lessonPhrases[0];
            this.resetRecordingState();
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Reset recording state
   */
  resetRecordingState() {
    this.recordingState = 'ready';
    this.pronunciationResult = null;
    this.showWordAnalysis = false;
    this.stopAudio();
  }

  /**
   * Load a new random phrase (reload current lesson)
   */
  async loadNewPhrase() {
    await this.loadCurrentLessonPhrases();
  }

  /**
   * Start recording pronunciation
   */
  async startRecording() {
    try {
      if (!this.currentPhrase) {
        await this.showErrorAlert('No phrase selected for practice');
        return;
      }

      // Check permissions first
      if (!await this.checkMicrophonePermissions()) {
        return;
      }

      this.recordingState = 'recording';
      
      const subscription = this.pronunciationService.startRecording().subscribe({
        next: (success) => {
          if (!success) {
            this.recordingState = 'ready';
          }
        },
        error: async (error) => {
          console.error('Error starting recording:', error);
          this.recordingState = 'ready';
          await this.showErrorAlert('Failed to start recording');
        }
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.recordingState = 'ready';
      await this.showErrorAlert('Failed to start recording');
    }
  }

  /**
   * Stop recording and evaluate pronunciation
   */
  async stopRecording() {
    try {
      this.recordingState = 'processing';
      
      const subscription = this.pronunciationService.stopRecording().subscribe({
        next: (audioRecording: AudioRecording) => {
          this.evaluatePronunciation(audioRecording);
        },
        error: async (error) => {
          console.error('Error stopping recording:', error);
          this.recordingState = 'ready';
          await this.showErrorAlert('Failed to stop recording');
        }
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.recordingState = 'ready';
      await this.showErrorAlert('Failed to stop recording');
    }
  }

  /**
   * Cancel current recording
   */
  async cancelRecording() {
    try {
      const subscription = this.pronunciationService.cancelRecording().subscribe({
        next: () => {
          this.recordingState = 'ready';
        },
        error: async (error) => {
          console.error('Error canceling recording:', error);
          this.recordingState = 'ready';
        }
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Error canceling recording:', error);
      this.recordingState = 'ready';
    }
  }

  /**
   * Evaluate pronunciation using the backend service
   */
  private async evaluatePronunciation(audioRecording: AudioRecording) {
    try {
      if (!this.currentPhrase) {
        throw new Error('Missing phrase data');
      }

      // Use the learning service to submit pronunciation assessment
      const currentUser = this.authService.currentUserValue;
      const userId = currentUser?.id || 'waitlist-user-main';

      // Use the base64 audio data directly from AudioRecording
      const base64Audio = audioRecording.value;
        
      try {
        const assessmentData = {
          userId: userId,
          lessonId: this.currentPhrase?.lessonId || 'pronunciation-practice',
          wordId: this.currentPhrase?.id || 'phrase-1',
          audio: base64Audio,
          transcript: this.currentPhrase?.targetText,
          languageCode: this.currentLanguageCode
        };

        const result = await this.learningService.submitPronunciationAssessment(assessmentData).toPromise();
        
        this.recordingState = 'complete';
        this.pronunciationResult = result;
        this.showWordAnalysis = true;
        
        // Create audio element for recording playback if available
        if (result.audioUrl) {
          this.recordingAudio = new Audio(result.audioUrl);
        }
      } catch (error) {
        console.error('Error evaluating pronunciation:', error);
        this.recordingState = 'ready';
        await this.showErrorAlert('Could not evaluate your pronunciation');
      }
      
    } catch (error) {
      console.error('Error in pronunciation evaluation:', error);
      this.recordingState = 'ready';
      await this.showErrorAlert('Failed to evaluate pronunciation');
    }
  }

  /**
   * Play native TTS audio for the current phrase
   */
  async playNativeAudio() {
    try {
      if (!this.currentPhrase) {
        return;
      }

      this.isPlayingNative = true;
      
      // Use the learning service to generate TTS
      const subscription = this.learningService.generateTTS(
        this.currentPhrase.targetText,
        this.currentLanguageCode
      ).subscribe({
        next: (response) => {
          if (response.audioUrl) {
            this.nativeAudio = new Audio(response.audioUrl);
            
            this.nativeAudio.onended = () => {
              this.isPlayingNative = false;
            };
            
            this.nativeAudio.onerror = () => {
              this.isPlayingNative = false;
            };
            
            this.nativeAudio.play();
          }
        },
        error: async (error) => {
          console.error('Error playing native audio:', error);
          this.isPlayingNative = false;
          await this.showErrorAlert('Failed to play native audio');
        }
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Error in native audio playback:', error);
      this.isPlayingNative = false;
    }
  }

  /**
   * Play user's recorded audio
   */
  async playRecordingAudio() {
    try {
      if (!this.recordingAudio) {
        return;
      }

      this.isPlayingRecording = true;
      
      this.recordingAudio.onended = () => {
        this.isPlayingRecording = false;
      };
      
      this.recordingAudio.onerror = () => {
        this.isPlayingRecording = false;
      };
      
      await this.recordingAudio.play();
      
    } catch (error) {
      console.error('Error playing recording:', error);
      this.isPlayingRecording = false;
    }
  }

  /**
   * Play TTS for a specific word/phoneme
   */
  async playPhoneme(phoneme: string) {
    try {
      const subscription = this.learningService.generateTTS(
        phoneme,
        this.currentLanguageCode
      ).subscribe({
        next: (response) => {
          if (response.audioUrl) {
            const audio = new Audio(response.audioUrl);
            audio.play();
          }
        },
        error: (error) => {
          console.error('Error playing phoneme audio:', error);
        }
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Error in phoneme audio playback:', error);
    }
  }

  /**
   * Get word analysis for pronunciation feedback
   */
  getWordAnalysis(): any[] {
    if (!this.pronunciationResult || !this.pronunciationResult.wordDetails) {
      return [];
    }

    return this.pronunciationResult.wordDetails.map(word => ({
      text: word.word,
      score: word.score,
      startTime: word.start_time,
      endTime: word.end_time
    }));
  }

  /**
   * Get color for word based on pronunciation score
   */
  getWordColor(score: number): string {
    if (score >= 0.8) return '#4CAF50'; // Green - good
    if (score >= 0.6) return '#FF9800'; // Orange - needs work
    return '#F44336'; // Red - poor
  }

  /**
   * Stop all audio playback
   */
  stopAudio() {
    if (this.nativeAudio) {
      this.nativeAudio.pause();
      this.nativeAudio = null;
    }
    
    if (this.recordingAudio) {
      this.recordingAudio.pause();
      this.recordingAudio = null;
    }
    
    this.isPlayingNative = false;
    this.isPlayingRecording = false;
  }

  /**
   * Check and request microphone permissions
   */
  private async checkMicrophonePermissions(): Promise<boolean> {
    if (!this.pronunciationService.isAudioSupported()) {
      await this.showErrorAlert('Audio recording is not supported on this device');
      return false;
    }

    const hasPermission = await this.pronunciationService.requestPermissions();
    if (!hasPermission) {
      await this.showErrorAlert('Microphone permission is required for pronunciation practice');
      return false;
    }
    
    return true;
  }

  /**
   * Show error alert
   */
  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK']
    });
    
    await alert.present();
  }

  /**
   * Show success toast
   */
  private async showSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: 'success'
    });
    
    await toast.present();
  }
}
