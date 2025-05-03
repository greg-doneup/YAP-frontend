import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { VocabItem } from '../learning/learning.service';
import { ApiService } from '../api-service.service';

// Import Capacitor core
import { Capacitor } from '@capacitor/core';

// Define VoiceRecorder interface to avoid importing the missing package
interface VoiceRecorderPlugin {
  hasAudioRecordingPermission(): Promise<{ value: boolean }>;
  requestAudioRecordingPermission(): Promise<{ value: boolean }>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<{ value: { recordDataBase64: string; mimeType: string } }>;
}

// Mock plugin for development/testing
const mockVoiceRecorder: VoiceRecorderPlugin = {
  hasAudioRecordingPermission: () => Promise.resolve({ value: true }),
  requestAudioRecordingPermission: () => Promise.resolve({ value: true }),
  startRecording: () => Promise.resolve(),
  stopRecording: () => Promise.resolve({ 
    value: { 
      recordDataBase64: '', 
      mimeType: 'audio/wav' 
    } 
  })
};

// Use plugin if available, otherwise use mock
const VoiceRecorder: VoiceRecorderPlugin = (Capacitor.isPluginAvailable('VoiceRecorder') ? 
  (Capacitor as any).Plugins?.VoiceRecorder : mockVoiceRecorder);

/**
 * Pronunciation evaluation result
 */
export interface PronunciationResult {
  score: number;
  pass: boolean;
  transcript?: string;
  expected: string;
}

/**
 * Audio recording format
 */
export interface AudioRecording {
  value: string;         // Base64 encoded audio data
  mimeType: string;      // Audio MIME type (e.g., 'audio/wav')
  format?: string;       // Format information (e.g., '16kHz mono')
  size?: number;         // Size in bytes
}

/**
 * Service for managing pronunciation evaluations and audio recordings
 * Provides methods to record audio, evaluate pronunciation, and manage pronunciation exercises
 */
@Injectable({
  providedIn: 'root'
})
export class PronunciationService {
  private baseUrl = `${environment.apiUrl}`;
  private isRecording = false;
  
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService
  ) { }

  /**
   * Check if the device supports audio recording
   */
  isAudioSupported(): boolean {
    return Capacitor.isPluginAvailable('VoiceRecorder');
  }

  /**
   * Request audio recording permissions from the user
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isAudioSupported()) {
      return false;
    }
    
    try {
      const { value } = await VoiceRecorder.hasAudioRecordingPermission();
      if (!value) {
        const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
        return granted;
      }
      return value;
    } catch (error) {
      this.errorService.handleError(error, 'audio-permissions');
      return false;
    }
  }

  /**
   * Start recording audio
   */
  startRecording(): Observable<boolean> {
    if (this.isRecording) {
      return throwError(() => new Error('Already recording'));
    }
    
    return from(VoiceRecorder.startRecording()).pipe(
      map(() => {
        this.isRecording = true;
        return true;
      }),
      catchError(error => {
        this.errorService.handleError(error, 'start-recording');
        return throwError(() => error);
      })
    );
  }

  /**
   * Stop recording and get the recorded audio
   */
  stopRecording(): Observable<AudioRecording> {
    if (!this.isRecording) {
      return throwError(() => new Error('Not currently recording'));
    }
    
    return from(VoiceRecorder.stopRecording()).pipe(
      map(result => {
        this.isRecording = false;
        return {
          value: result.value.recordDataBase64,
          mimeType: result.value.mimeType,
          format: '16kHz mono',
          size: this._calculateBase64Size(result.value.recordDataBase64)
        };
      }),
      catchError(error => {
        this.isRecording = false;
        this.errorService.handleError(error, 'stop-recording');
        return throwError(() => error);
      })
    );
  }

  /**
   * Cancel the current recording
   */
  cancelRecording(): Observable<boolean> {
    if (!this.isRecording) {
      return throwError(() => new Error('Not currently recording'));
    }
    
    return from(VoiceRecorder.stopRecording()).pipe(
      map(() => {
        this.isRecording = false;
        return true;
      }),
      catchError(error => {
        this.isRecording = false;
        this.errorService.handleError(error, 'cancel-recording');
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Submit audio for pronunciation evaluation
   * @param walletAddress User's wallet address
   * @param vocabId ID of the vocabulary word being practiced
   * @param audioRecording Audio recording to evaluate
   */
  evaluatePronunciation(
    walletAddress: string,
    vocabId: string,
    audioRecording: AudioRecording
  ): Observable<PronunciationResult> {
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('wallet', walletAddress);
    formData.append('expectedId', vocabId);
    formData.append('audio', this._base64ToBlob(audioRecording.value, audioRecording.mimeType), 'recording.wav');
    
    return this.apiService.post<PronunciationResult>('learning/daily/complete', formData).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'pronunciation-evaluation');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get sample audio for a specific vocabulary item
   * @param item Vocabulary item
   */
  getSampleAudio(item: VocabItem): Observable<string> {
    if (item.audioUrl) {
      // If the vocab item already has an audio URL, use it
      return this.apiService.get<Blob>(item.audioUrl, {}, undefined, 'blob').pipe(
        map(blob => URL.createObjectURL(blob)),
        catchError(error => {
          this.errorService.handleError(error, 'sample-audio-fetch');
          return throwError(() => error);
        })
      );
    }
    
    // Otherwise, request from the TTS service
    return this.apiService.get<{url: string}>(
      `learning/tts`, { text: item.term }
    ).pipe(
      map(response => response.url),
      catchError(error => {
        this.errorService.handleError(error, 'tts-audio-fetch');
        return throwError(() => error);
      })
    );
  }

  /**
   * Play audio from a URL or base64 string
   * @param audioSource URL or base64 string of the audio
   */
  playAudio(audioSource: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(audioSource);
        audio.onended = () => resolve();
        audio.onerror = (e) => reject(e);
        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get pronunciation history for a user
   * @param walletAddress User's wallet address
   */
  getPronunciationHistory(walletAddress: string): Observable<PronunciationResult[]> {
    return this.apiService.get<{results: PronunciationResult[]}>(
      `${this.baseUrl}/learning/daily/results?wallet=${walletAddress}`
    ).pipe(
      map(response => response.results || []),
      catchError(error => {
        this.errorService.handleError(error, 'pronunciation-history');
        return throwError(() => error);
      })
    );
  }

  /**
   * Calculate the size of a base64 string in bytes
   * @private
   * @param base64String Base64 encoded string
   */
  private _calculateBase64Size(base64String: string): number {
    // Remove data URL prefix if present
    const base64Data = base64String.split(',')[1] || base64String;
    
    // Calculate size: (string length * 3/4) - padding chars
    return Math.floor((base64Data.length * 3) / 4) - 
      (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
  }

  /**
   * Convert a base64 string to a Blob
   * @private
   * @param base64 Base64 encoded string
   * @param mimeType MIME type of the blob
   */
  private _base64ToBlob(base64: string, mimeType: string): Blob {
    // Remove data URL prefix if present
    const base64Data = base64.split(',')[1] || base64;
    
    // Convert base64 to binary
    const byteCharacters = atob(base64Data);
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
}
