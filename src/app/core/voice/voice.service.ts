import { Injectable } from '@angular/core';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, map, finalize, share } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { SettingsService } from '../settings/settings.service';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';
import { Platform } from '@ionic/angular';
import { ApiService } from '../api-service.service';

export enum RecordingState {
  READY = 'ready',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  PLAYBACK = 'playback',
}

export interface PronunciationResult {
  score: number;
  transcript: string;
  pass: boolean;
  expected: string;
  corrected?: string;
}

export interface VoiceCapabilities {
  recording: boolean;
  playback: boolean;
  tts: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private baseUrl = `${environment.apiUrl}/learning`;
  private recordingStateSubject = new BehaviorSubject<RecordingState>(RecordingState.READY);
  private audioContext: AudioContext | null = null; // Initialize as null to fix TS error
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioUrl: string | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ttsVoices: SpeechSynthesisVoice[] = [];
  
  // Audio settings
  private recordingTimeMS = 10000; // Default 10 seconds max
  private sampleRate = 16000;      // 16kHz required by backend
  private channelCount = 1;        // Mono required by backend
  
  // Rate limiter keys
  private static readonly RL_TTS = 'voice_tts';
  private static readonly RL_VERIFY = 'voice_verification';
  
  // Observable for recording state
  recordingState$ = this.recordingStateSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService,
    private settingsService: SettingsService,
    private rateLimiter: RateLimiterService,
    private platform: Platform
  ) {
    this.initializeAudioContext();
    this.loadTtsVoices();
    
    // Initialize audio element
    this.audioElement = new Audio();
    this.audioElement.addEventListener('ended', () => {
      this.recordingStateSubject.next(RecordingState.READY);
    });
  }

  /**
   * Initialize audio context according to platform
   */
  private initializeAudioContext(): void {
    try {
      // Safari sometimes requires this additional step
      window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContext();
    } catch (error) {
      console.error('AudioContext is not supported in this browser', error);
      this.audioContext = null;
    }
  }

  /**
   * Load available TTS voices
   */
  private loadTtsVoices(): void {
    if ('speechSynthesis' in window) {
      // Get the voices when they're loaded (they might not be immediately available)
      const voicesLoaded = () => {
        this.ttsVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.removeEventListener('voiceschanged', voicesLoaded);
      };

      // Event might fire immediately in some browsers or later in others
      window.speechSynthesis.addEventListener('voiceschanged', voicesLoaded);
      
      // Also try to get them immediately
      this.ttsVoices = window.speechSynthesis.getVoices();
    }
  }

  /**
   * Check if the device supports the necessary voice capabilities
   */
  checkCapabilities(): VoiceCapabilities {
    return {
      recording: 'MediaRecorder' in window && this.audioContext !== null, // Updated to check for null
      playback: 'Audio' in window,
      tts: 'speechSynthesis' in window
    };
  }

  /**
   * Start recording audio
   * @returns Observable that completes when recording starts
   */
  startRecording(): Observable<void> {
    return new Observable(observer => {
      if (this.recordingStateSubject.value !== RecordingState.READY) {
        observer.error(new Error('Cannot start recording, not in ready state'));
        return;
      }
      
      // Set state to recording
      this.recordingStateSubject.next(RecordingState.RECORDING);
      this.audioChunks = [];
      
      // Get microphone access
      navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: this.channelCount,
        sampleRate: this.sampleRate
      }})
      .then(stream => {
        // Create media recorder
        this.mediaRecorder = new MediaRecorder(stream);
        
        // Set up event handlers
        this.mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        });
        
        this.mediaRecorder.addEventListener('error', (event) => {
          observer.error(new Error('Error recording audio'));
          this.stopRecording();
        });
        
        this.mediaRecorder.addEventListener('stop', () => {
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          
          // Clean up old audio URL if it exists
          if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
          }
          
          // Create new audio blob
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
          this.audioUrl = URL.createObjectURL(audioBlob);
          
          if (this.audioElement) {
            this.audioElement.src = this.audioUrl;
          }
          
          this.recordingStateSubject.next(RecordingState.READY);
        });
        
        // Start recording with a time limit
        this.mediaRecorder.start();
        
        // Set timeout to automatically stop recording
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.stopRecording();
          }
        }, this.recordingTimeMS);
        
        observer.next();
        observer.complete();
      })
      .catch(error => {
        console.error('Error accessing microphone', error);
        this.recordingStateSubject.next(RecordingState.READY);
        observer.error(new Error('Failed to access microphone'));
      });
    });
  }

  /**
   * Stop the current recording
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    } else {
      this.recordingStateSubject.next(RecordingState.READY);
    }
  }

  /**
   * Play the recorded audio
   * @returns Observable that completes when playback starts
   */
  playRecording(): Observable<void> {
    return new Observable(observer => {
      if (!this.audioUrl || !this.audioElement) {
        observer.error(new Error('No recording available'));
        return;
      }
      
      this.recordingStateSubject.next(RecordingState.PLAYBACK);
      this.audioElement.play()
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => {
          console.error('Error playing audio', error);
          this.recordingStateSubject.next(RecordingState.READY);
          observer.error(new Error('Failed to play audio'));
        });
    });
  }

  /**
   * Speak text using TTS
   * @param text Text to speak
   * @param language Language code (e.g., 'en-US')
   * @returns Observable that resolves when speech starts
   */
  speak(text: string, language: string = 'en-US'): Observable<void> {
    return this.rateLimiter.executeIfAllowed(
      VoiceService.RL_TTS,
      () => new Observable(observer => {
        if (!('speechSynthesis' in window)) {
          observer.error(new Error('Text-to-speech not supported'));
          return;
        }
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        
        // Try to find a voice for the language
        const voices = this.ttsVoices.filter(voice => voice.lang.startsWith(language.split('-')[0]));
        if (voices.length > 0) {
          utterance.voice = voices[0];
        }
        
        // Handle events
        utterance.onstart = () => {
          observer.next();
          observer.complete();
        };
        
        utterance.onerror = (event) => {
          observer.error(new Error('Text-to-speech error'));
        };
        
        window.speechSynthesis.speak(utterance);
      }),
      // Limit to 50 TTS operations per minute
      {
        maxOperations: 50,
        windowMs: 60000,
        message: 'Too many text-to-speech requests. Please try again later.'
      }
    );
  }

  /**
   * Verify pronunciation against expected text
   * @param expectedText The text that should have been spoken
   * @returns Observable<PronunciationResult>
   */
  verifyPronunciation(expectedText: string): Observable<PronunciationResult> {
    return this.rateLimiter.executeIfAllowed(
      VoiceService.RL_VERIFY,
      () => {
        if (!this.audioChunks.length) {
          return throwError(() => new Error('No recording available for verification'));
        }
        
        this.recordingStateSubject.next(RecordingState.PROCESSING);
        
        // Create audio blob from chunks
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        
        // Create form data with audio file and expected text
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        formData.append('expected', expectedText);
        
        // Send to backend for verification using ApiService
        return this.apiService.post<PronunciationResult>('learning/verify-pronunciation', formData).pipe(
          tap(result => console.log('Pronunciation verification result:', result)),
          finalize(() => this.recordingStateSubject.next(RecordingState.READY)),
          catchError(error => {
            this.errorService.handleError(error, 'pronunciation-verify');
            return throwError(() => error);
          }),
          share()
        );
      },
      // Limit to 20 verifications per minute
      {
        maxOperations: 20,
        windowMs: 60000,
        message: 'Too many pronunciation verification requests. Please try again later.'
      }
    );
  }

  /**
   * Get audio blob from current recording
   * @returns Blob or null if no recording
   */
  getAudioBlob(): Blob | null {
    if (!this.audioChunks.length) {
      return null;
    }
    return new Blob(this.audioChunks, { type: 'audio/wav' });
  }

  /**
   * Set maximum recording time
   * @param milliseconds Maximum recording time in milliseconds
   */
  setMaxRecordingTime(milliseconds: number): void {
    this.recordingTimeMS = milliseconds;
  }

  /**
   * Check if there is a current recording
   * @returns True if there is a recording available
   */
  hasRecording(): boolean {
    return this.audioChunks.length > 0 && this.audioUrl !== null;
  }
  
  /**
   * Clear the current recording
   */
  clearRecording(): void {
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
    this.audioChunks = [];
    if (this.audioElement) {
      this.audioElement.src = '';
    }
  }

  /**
   * Request microphone permission
   * @returns Promise<boolean> True if permission granted, false otherwise
   */
  async requestPermission(): Promise<boolean> {
    try {
      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not supported');
        return false;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: this.channelCount,
          sampleRate: this.sampleRate
        }
      });
      
      // Permission granted, clean up the stream
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied or error:', error);
      return false;
    }
  }
}
