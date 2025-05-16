import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PronunciationService, AudioRecording } from '../../core/pronunciation/pronunciation.service';
import { DetailedPronunciationResult } from '../../core/pronunciation/pronunciation.model';
import { WalletService } from '../../core/wallet/wallet.service';
import { LearningService, VocabItem } from '../../core/learning/learning.service';
import { Observable, Subscription, of, throwError } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { AlertController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.page.html',
  styleUrls: ['./practice.page.scss'],
})
export class PracticePage implements OnInit, OnDestroy {
  currentVocab: VocabItem | null = null;
  recordingState: 'ready' | 'recording' | 'processing' | 'complete' = 'ready';
  pronunciationResult: DetailedPronunciationResult | null = null;
  recordingBlob: Blob | null = null;
  recordingAudio: HTMLAudioElement | null = null;
  sampleAudio: HTMLAudioElement | null = null;
  languageCode: string = 'en-US';
  loading: HTMLIonLoadingElement | null = null;
  subscriptions: Subscription[] = [];
  
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
    // Get vocabulary item from route params
    this.subscriptions.push(
      this.route.params.pipe(
        switchMap(params => {
          const vocabId = params['id'];
          if (!vocabId) {
            return throwError(() => new Error('No vocabulary ID provided'));
          }
          return this.learningService.getVocabItem(vocabId);
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
          this.showAlert('Error', 'Could not load vocabulary item');
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
  async requestMicrophonePermissions() {
    const hasPermissions = await this.pronunciationService.requestPermissions();
    if (!hasPermissions) {
      this.showAlert(
        'Microphone Access Required', 
        'We need microphone access to check your pronunciation. Please allow microphone access in your device settings.'
      );
    }
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
    
    this.pronunciationService.startRecording().subscribe({
      error: (error) => {
        console.error('Error starting recording:', error);
        this.recordingState = 'ready';
        this.showAlert('Recording Error', 'Could not start recording');
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
      },
      error: (error) => {
        console.error('Error evaluating pronunciation:', error);
        this.recordingState = 'ready';
        this.showAlert('Evaluation Error', 'Could not evaluate your pronunciation');
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
}
