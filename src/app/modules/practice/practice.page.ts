import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PronunciationService, AudioRecording } from '../../core/pronunciation/pronunciation.service';
import { DetailedPronunciationResult } from '../../core/pronunciation/pronunciation.model';
import { WalletService } from '../../core/wallet/wallet.service';
import { LearningService, VocabItem } from '../../core/learning/learning.service';
import { Observable, Subscription, of, throwError } from 'rxjs';
import { catchError, finalize, switchMap, tap, map } from 'rxjs/operators';
import { AlertController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.page.html',
  styleUrls: ['./practice.page.scss'],
})
export class PracticePage implements OnInit, OnDestroy {
  currentVocab: VocabItem | null = null;
  pronunciationResult: any = null; // Updated to match new response format
  recordingBlob: Blob | null = null;
  recordingAudio: HTMLAudioElement | null = null;
  sampleAudio: HTMLAudioElement | null = null;
  languageCode: string = 'en-US';
  loading: HTMLIonLoadingElement | null = null;
  subscriptions: Subscription[] = [];
  
  // Flow state management
  flowState: 'initial' | 'recording' | 'processing' | 'results' = 'initial';
  recordingState: 'ready' | 'recording' | 'processing' | 'complete' = 'ready';
  isPlayingAudio: boolean = false;
  showWordAnalysis: boolean = false;
  audioVisualization: number[] = [];
  
  // Lesson context properties
  currentLessonLevel: string = 'A1.1';
  currentLessonNumber: number = 1;
  currentPhraseNumber: number = 1;
  totalPhrasesInLesson: number = 5;
  lessonTitle: string = 'Basic Greetings';
  
  // Language variants
  availableLanguageVariants: { code: string, name: string }[] = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'en-AU', name: 'English (Australia)' },
    { code: 'en-CA', name: 'English (Canada)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'es-MX', name: 'Spanish (Mexico)' },
    { code: 'es-AR', name: 'Spanish (Argentina)' },
    { code: 'fr-FR', name: 'French (France)' },
    { code: 'fr-CA', name: 'French (Canada)' },
    { code: 'de-DE', name: 'German' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'pt-PT', name: 'Portuguese (Portugal)' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'ar-SA', name: 'Arabic' },
    { code: 'ru-RU', name: 'Russian' }
  ];
  
  constructor(
    private route: ActivatedRoute,
    private pronunciationService: PronunciationService,
    private walletService: WalletService,
    private learningService: LearningService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    // Get vocabulary item from route params or load daily vocabulary
    this.subscriptions.push(
      this.route.params.pipe(
        switchMap(params => {
          const vocabId = params['id'];
          if (vocabId) {
            // Load specific vocabulary item
            return this.learningService.getVocabItem(vocabId);
          } else {
            // Load daily vocabulary and use the first item
            return this.learningService.getDailyVocab().pipe(
              map(vocabItems => {
                if (vocabItems && vocabItems.length > 0) {
                  // Update lesson context based on loaded vocabulary
                  this.updateLessonContext(vocabItems);
                  return vocabItems[0]; // Use the first item from daily vocabulary
                } else {
                  // Fallback vocabulary if no daily vocab available
                  return {
                    id: 'fallback-1',
                    term: 'hello',
                    translation: 'a greeting used when meeting someone',
                    examples: ['Hello, how are you today?'],
                    difficulty: 1,
                    tags: ['greeting', 'basic']
                  };
                }
              })
            );
          }
        })
      ).subscribe({
        next: (vocab) => {
          this.currentVocab = vocab;
          
          // Set default language code based on vocabulary item or first two characters
          const baseLanguage = vocab.term?.substring(0, 2).toLowerCase();
          this.setLanguageVariant(baseLanguage);
        },
        error: (error) => {
          console.error('Error loading vocabulary item:', error);
          
          // Use fallback vocabulary on error
          this.currentVocab = {
            id: 'fallback-1',
            term: 'hello',
            translation: 'a greeting used when meeting someone',
            examples: ['Hello, how are you today?'],
            difficulty: 1,
            tags: ['greeting', 'basic']
          };
          
          this.showAlert('Info', 'Using default vocabulary for practice. Please check your connection.');
        }
      })
    );
    
    // Request microphone permissions
    this.requestMicrophonePermissions();
  }
  
  /**
   * Set the language variant based on the base language code
   */
  setLanguageVariant(baseLanguage: string = 'en') {
    // Find a matching language variant
    const matchingVariant = this.availableLanguageVariants.find(v => 
      v.code.toLowerCase().startsWith(baseLanguage.toLowerCase())
    );
    
    if (matchingVariant) {
      this.languageCode = matchingVariant.code;
    } else {
      // Default to US English if no match found
      this.languageCode = 'en-US';
    }
    
    // Filter available variants to just show relevant ones for this language
    this.filterLanguageVariants(baseLanguage);
  }
  
  /**
   * Filter the available language variants to just show relevant ones
   */
  filterLanguageVariants(baseLanguage: string) {
    // Show only variants for the current base language
    this.availableLanguageVariants = this.availableLanguageVariants.filter(
      v => v.code.toLowerCase().startsWith(baseLanguage.toLowerCase())
    );
    
    // If no variants found, default to showing all English variants
    if (this.availableLanguageVariants.length === 0) {
      this.availableLanguageVariants = [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'en-AU', name: 'English (Australia)' },
        { code: 'en-CA', name: 'English (Canada)' }
      ];
      this.languageCode = 'en-US';
    }
  }
  
  /**
   * Handle language variant change
   */
  onLanguageVariantChange(event: any) {
    this.languageCode = event.detail.value;
    
    // Clear audio to force reload with new language variant
    if (this.sampleAudio) {
      this.sampleAudio.pause();
      this.sampleAudio.src = '';
      this.sampleAudio = null;
    }
  }
  
  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Stop and release audio resources
    if (this.recordingAudio) {
      this.recordingAudio.pause();
      this.recordingAudio.src = '';
    }
    if (this.sampleAudio) {
      this.sampleAudio.pause();
      this.sampleAudio.src = '';
    }
  }
  
  /**
   * Request microphone permissions if needed
   */
  async requestMicrophonePermissions(): Promise<boolean> {
    const hasPermissions = await this.pronunciationService.requestPermissions();
    if (!hasPermissions) {
      this.showAlert(
        'Microphone Access Required', 
        'We need microphone access to check your pronunciation. Please allow microphone access in your device settings.'
      );
    }
    return hasPermissions;
  }
  
  /**
   * Start recording audio
   */
  startRecording() {
    if (!this.currentVocab) {
      this.showAlert('Error', 'No vocabulary item selected');
      return;
    }
    
    this.recordingState = 'recording';
    this.pronunciationResult = null;
    this.recordingBlob = null;
    
    this.pronunciationService.startRecording().subscribe({
      next: () => {
        // Recording started successfully
        console.log('Recording started');
      },
      error: (error) => {
        console.error('Error starting recording:', error);
        this.recordingState = 'ready';
        this.showAlert('Recording Error', 'Could not start recording. Please check microphone permissions.');
      }
    });
  }
  
  /**
   * Stop recording and evaluate pronunciation
   */
  async stopRecording() {
    if (this.recordingState !== 'recording') return;
    
    this.recordingState = 'processing';
    await this.showLoading('Processing audio...');
    
    this.pronunciationService.stopRecording().pipe(
      tap((audioRecording: AudioRecording) => {
        // Store the recording blob for potential playback
        this.recordingBlob = this.base64ToBlob(audioRecording.value, audioRecording.mimeType);
      }),
      switchMap((audioRecording: AudioRecording) => {
        const walletAddress = this.walletService.getWalletAddress();
        
        // Make sure currentVocab is defined
        if (!this.currentVocab || !this.currentVocab.id) {
          return throwError(() => new Error('No vocabulary ID available'));
        }
        
        return this.pronunciationService.evaluatePronunciationDetailed(
          walletAddress, 
          this.currentVocab.id, 
          audioRecording
        );
      }),
      finalize(() => this.hideLoading())
    ).subscribe({
      next: (result: DetailedPronunciationResult) => {
        this.recordingState = 'complete';
        this.pronunciationResult = result;
        
        // Create audio element for recording playback if available
        if (result.audioUrl) {
          this.recordingAudio = new Audio(result.audioUrl);
        }
        
        // Update audio visualization data
        if (result.audioUrl) {
          this.updateAudioVisualization(result.audioUrl);
        }
      },
      error: (error) => {
        console.error('Error evaluating pronunciation:', error);
        this.recordingState = 'ready';
        this.showAlert('Evaluation Error', 'Could not evaluate your pronunciation. Please try again.');
      }
    });
  }
  
  /**
   * Cancel current recording
   */
  cancelRecording() {
    if (this.recordingState !== 'recording') return;
    
    this.pronunciationService.cancelRecording().subscribe({
      next: () => this.recordingState = 'ready',
      error: () => this.recordingState = 'ready'
    });
  }
  
  /**
   * Play sample pronunciation audio using TTS
   */
  playSample() {
    if (!this.currentVocab) return;
    
    this.pronunciationService.getTTS(this.currentVocab.term, this.languageCode)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          if (this.sampleAudio) {
            this.sampleAudio.pause();
            this.sampleAudio.src = '';
          }
          this.sampleAudio = new Audio(url);
          this.sampleAudio.play();
          
          // Release the object URL after playback
          this.sampleAudio.onended = () => URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Error playing sample:', error);
          this.showAlert('Playback Error', 'Could not play pronunciation sample');
        }
      });
  }
  
  /**
   * Play recording audio
   */
  playRecording() {
    if (this.recordingAudio) {
      this.recordingAudio.play();
    }
  }
  
  /**
   * Play a specific phoneme sound
   * @param phoneme The phoneme to play
   */
  playPhoneme(phoneme: string) {
    // Create a sound for the phoneme by wrapping it in a word
    // This helps TTS produce better phoneme sounds
    const phonemeExamples: {[key: string]: string} = {
      // English phoneme examples
      'æ': 'cat',
      'ɑ': 'father',
      'ʌ': 'cup',
      'ɔ': 'caught',
      'ə': 'about',
      'ɛ': 'bed',
      'i': 'see',
      'ɪ': 'sit',
      'u': 'blue',
      'ʊ': 'book',
      'eɪ': 'say',
      'oʊ': 'go',
      'aɪ': 'five',
      'aʊ': 'now',
      'ɔɪ': 'boy',
      'p': 'pen',
      'b': 'big',
      't': 'top',
      'd': 'dog',
      'k': 'cat',
      'g': 'get',
      'tʃ': 'chair',
      'dʒ': 'jump',
      'f': 'fall',
      'v': 'very',
      'θ': 'think',
      'ð': 'this',
      's': 'see',
      'z': 'zoo',
      'ʃ': 'she',
      'ʒ': 'vision',
      'h': 'hat',
      'm': 'man',
      'n': 'no',
      'ŋ': 'sing',
      'l': 'leg',
      'r': 'red',
      'j': 'yes',
      'w': 'we'
    };
    
    // Get an example word containing the phoneme or use the phoneme itself
    const exampleWord = phonemeExamples[phoneme] || phoneme;
    
    // Play the example word to demonstrate the phoneme
    this.pronunciationService.getTTS(exampleWord, this.languageCode)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play();
          
          // Release the object URL after playback
          audio.onended = () => URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Error playing phoneme:', error);
          this.showAlert('Playback Error', 'Could not play phoneme sample');
        }
      });
  }
  
  /**
   * Update audio visualization data
   */
  updateAudioVisualization(audioUrl: string) {
    // For now, generate dummy data for visualization
    // Replace this with real audio analysis data in the future
    this.audioVisualization = Array.from({ length: 100 }, () => Math.random());
  }
  
  /**
   * Show an alert dialog
   */
  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
  
  /**
   * Show a loading indicator
   */
  async showLoading(message: string) {
    this.loading = await this.loadingController.create({
      message,
      spinner: 'circles'
    });
    await this.loading.present();
  }

  /**
   * Hide the loading indicator
   */
  async hideLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }

  // New methods for improved UI

  /**
   * Get word segments for pronunciation breakdown
   */
  getWordSegments(phrase: string): Array<{text: string, status?: string}> {
    if (!phrase) return [];
    
    const words = phrase.split(' ');
    return words.map(word => ({
      text: word,
      status: this.pronunciationResult ? this.getWordStatus(word) : undefined
    }));
  }

  /**
   * Get pronunciation status for a word
   */
  private getWordStatus(word: string): string {
    if (!this.pronunciationResult) return '';
    
    // Mock word-level scoring - replace with real data from backend
    const score = Math.random();
    if (score >= 0.8) return 'correct';
    if (score >= 0.6) return 'partial';
    return 'incorrect';
  }

  // New Flow Methods
  
  /**
   * Play the phrase audio for listening
   */
  async playPhraseAudio() {
    if (!this.currentVocab) return;
    
    this.isPlayingAudio = true;
    
    try {
      // Generate or get TTS audio for the phrase
      const ttsResponse = await this.learningService.generateTTS(
        this.currentVocab.term, 
        this.languageCode
      ).toPromise();
      
      if (ttsResponse && ttsResponse.audioUrl) {
        const audio = new Audio(ttsResponse.audioUrl);
        audio.onended = () => {
          this.isPlayingAudio = false;
        };
        audio.onerror = () => {
          this.isPlayingAudio = false;
          console.error('Error playing TTS audio');
        };
        await audio.play();
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      this.isPlayingAudio = false;
    }
  }

  /**
   * Start the new recording flow
   */
  async startRecordingFlow() {
    // Check microphone permissions first
    const hasPermissions = await this.requestMicrophonePermissions();
    if (!hasPermissions) {
      this.showAlert('Permission Required', 'Microphone access is required for pronunciation practice.');
      return;
    }

    this.flowState = 'recording';
    this.startRecording();
  }

  /**
   * Stop recording and submit for analysis
   */
  async stopAndSubmitRecording() {
    this.flowState = 'processing';
    await this.stopRecording();
  }

  /**
   * Submit recorded audio for pronunciation analysis
   */
  async submitPronunciationAssessment() {
    if (!this.recordingBlob || !this.currentVocab) {
      console.error('No recording blob or current vocab available');
      return;
    }

    try {
      this.flowState = 'processing';
      
      // Convert blob to base64 for submission
      const base64Audio = await this.blobToBase64(this.recordingBlob);
      
      const analysisData = {
        userId: 'waitlist-user-main', // Get from auth service
        lessonId: `${this.currentLessonLevel.toLowerCase()}-lesson-${this.currentLessonNumber}`,
        wordId: this.currentVocab.id,
        audio: base64Audio,
        transcript: this.currentVocab.term,
        detailLevel: 'detailed',
        languageCode: this.languageCode
      };

      const result = await this.learningService.submitPronunciationAssessment(analysisData).toPromise();
      this.pronunciationResult = result;
      this.flowState = 'results';
      
    } catch (error) {
      console.error('Error submitting pronunciation assessment:', error);
      this.showAlert('Assessment Error', 'Could not analyze your pronunciation. Please try again.');
      this.flowState = 'initial';
    }
  }

  /**
   * Generate TTS audio for current phrase
   */
  async generateTTS() {
    if (!this.currentVocab) return;

    try {
      this.isPlayingAudio = true;
      
      const result = await this.learningService.generateTTS(
        this.currentVocab.term, 
        this.languageCode
      ).toPromise();
      
      if (result?.audioUrl) {
        this.sampleAudio = new Audio(result.audioUrl);
        await this.sampleAudio.play();
        
        this.sampleAudio.addEventListener('ended', () => {
          this.isPlayingAudio = false;
        });
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      this.isPlayingAudio = false;
    }
  }

  /**
   * Retry recording
   */
  retryRecording() {
    this.flowState = 'initial';
    this.pronunciationResult = null;
    this.recordingBlob = null;
  }

  /**
   * Continue to next phrase
   */
  continueToNext() {
    if (this.currentPhraseNumber < this.totalPhrasesInLesson) {
      this.currentPhraseNumber++;
      this.loadNext();
    } else {
      // Lesson complete - navigate back or to next lesson
      this.showAlert('Lesson Complete!', 'Great job! You\'ve completed this lesson.');
      // Could navigate to lesson complete screen or next lesson
    }
    
    this.flowState = 'initial';
    this.pronunciationResult = null;
    this.recordingBlob = null;
  }

  /**
   * Load next phrase in the lesson
   */
  private loadNext() {
    // Trigger loading the next phrase
    this.subscriptions.push(
      this.learningService.getDailyVocab().pipe(
        map(vocabItems => {
          if (vocabItems && vocabItems.length > this.currentPhraseNumber - 1) {
            return vocabItems[this.currentPhraseNumber - 1];
          }
          return vocabItems?.[0] || null;
        })
      ).subscribe({
        next: (vocab) => {
          this.currentVocab = vocab;
        },
        error: (error) => {
          console.error('Error loading next phrase:', error);
        }
      })
    );
  }

  /**
   * Update lesson context based on loaded vocabulary
   */
  private updateLessonContext(vocabItems: VocabItem[]) {
    if (vocabItems && vocabItems.length > 0) {
      // Update total phrases in lesson
      this.totalPhrasesInLesson = vocabItems.length;
      
      // Update lesson title based on vocabulary content
      const firstItem = vocabItems[0];
      if (firstItem?.id?.includes('greetings')) {
        this.lessonTitle = 'Basic Greetings';
      } else if (firstItem?.id?.includes('intro')) {
        this.lessonTitle = 'Introductions';
      } else if (firstItem?.id?.includes('conversation')) {
        this.lessonTitle = 'Conversations';
      } else {
        this.lessonTitle = 'Daily Practice';
      }
      
      // Determine current phrase number (assume it's the first for now)
      this.currentPhraseNumber = 1;
    }
  }

  // Lesson context methods for improved UI
  getCurrentLessonLevel(): string {
    return this.currentLessonLevel;
  }

  getCurrentLessonNumber(): number {
    return this.currentLessonNumber;
  }

  getCurrentPhraseNumber(): number {
    return this.currentPhraseNumber;
  }

  getTotalPhrasesInLesson(): number {
    return this.totalPhrasesInLesson;
  }

  getCurrentLessonTitle(): string {
    return this.lessonTitle;
  }

  getLessonProgress(): number {
    return Math.round((this.currentPhraseNumber / this.totalPhrasesInLesson) * 100);
  }

  /**
   * Convert Blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert base64 to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  }

  /**
   * Get score level class for styling
   */
  getScoreClass(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    return 'needs-improvement';
  }

  /**
   * Get word feedback icon
   */
  getWordFeedbackIcon(status: string): string {
    switch (status) {
      case 'correct': return 'checkmark-circle';
      case 'partial': return 'warning';
      case 'incorrect': return 'close-circle';
      default: return 'help-circle';
    }
  }

  /**
   * Play audio (either TTS or recording)
   */
  async playAudio(type: 'sample' | 'recording') {
    try {
      if (type === 'sample') {
        await this.generateTTS();
      } else if (type === 'recording' && this.recordingBlob) {
        const audioUrl = URL.createObjectURL(this.recordingBlob);
        const audio = new Audio(audioUrl);
        await audio.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  /**
   * Get word analysis for display
   */
  getWordAnalysis(): Array<{text: string, score: number}> {
    if (!this.pronunciationResult || !this.currentVocab) {
      return [];
    }
    
    // Mock implementation - replace with real data from pronunciation result
    const words = this.currentVocab.term.split(' ');
    return words.map(word => ({
      text: word,
      score: Math.random() * 100 // Replace with actual scores
    }));
  }

  /**
   * Get color for word based on pronunciation score
   */
  getWordColor(score: number): string {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FFC107'; // Yellow
    return '#f44336'; // Red
  }

  /**
   * Get color for audio visualization bar
   */
  getBarColor(index: number): string {
    // Gradient from blue to green based on position
    const ratio = index / this.audioVisualization.length;
    const red = Math.floor(67 + (76 - 67) * ratio);
    const green = Math.floor(114 + (175 - 114) * ratio);
    const blue = Math.floor(196 + (80 - 196) * ratio);
    return `rgb(${red}, ${green}, ${blue})`;
  }

  /**
   * Get feedback title based on pronunciation result
   */
  getFeedbackTitle(): string {
    if (!this.pronunciationResult) return '';
    
    const score = this.pronunciationResult.overallScore || 0;
    if (score >= 90) return '¡Excelente!';
    if (score >= 80) return '¡Muy bien!';
    if (score >= 70) return '¡Bien!';
    if (score >= 60) return 'Good effort!';
    return 'Keep practicing!';
  }

  /**
   * Get feedback message based on pronunciation result
   */
  getFeedbackMessage(): string {
    if (!this.pronunciationResult) return '';
    
    const score = this.pronunciationResult.overallScore || 0;
    if (score >= 90) return 'Your pronunciation is excellent! You sound very natural.';
    if (score >= 80) return 'Great pronunciation! Minor improvements in highlighted words.';
    if (score >= 70) return 'Good job! Focus on the yellow highlighted words.';
    if (score >= 60) return 'Nice try! Practice the red highlighted words more.';
    return 'Keep practicing! Listen to the example and try to match the pronunciation.';
  }

  /**
   * Skip current lesson (placeholder)
   */
  skipLesson() {
    this.showAlert('Skip Lesson', 'Are you sure you want to skip this lesson?');
  }
}
