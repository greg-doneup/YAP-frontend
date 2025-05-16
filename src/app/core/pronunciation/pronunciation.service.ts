import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorService } from '../error/error.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { VocabItem } from '../learning/learning.service';
import { ApiService } from '../api-service.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { 
  DetailedPronunciationResult,
  WordPronunciationDetail, 
  PhonemePronunciationDetail,
  PronunciationHistoryItem 
} from './pronunciation.model';

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
 * Pronunciation evaluation result (simple version)
 * @deprecated Use DetailedPronunciationResult for more complete feedback
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
  private audioCache = new Map<string, { blob: Blob, timestamp: number }>();
  private readonly CACHE_EXPIRY_MS = 3600000; // 1 hour cache expiry
  
  constructor(
    private apiService: ApiService,
    private errorService: ErrorService,
    private connectivityService: ConnectivityService,
    private http: HttpClient
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
   * Submit audio for pronunciation evaluation with detailed feedback
   * @param walletAddress User's wallet address
   * @param vocabId ID of the vocabulary word being practiced
   * @param audioRecording Audio recording to evaluate
   * @returns Observable with detailed pronunciation result
   */
  evaluatePronunciationDetailed(
    walletAddress: string,
    vocabId: string,
    audioRecording: AudioRecording
  ): Observable<DetailedPronunciationResult> {
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('wallet', walletAddress);
    formData.append('expectedId', vocabId);
    formData.append('audio', this._base64ToBlob(audioRecording.value, audioRecording.mimeType), 'recording.wav');
    formData.append('detailLevel', 'detailed');
    
    return this.apiService.post<DetailedPronunciationResult>('learning/daily/complete', formData).pipe(
      catchError(error => {
        this.errorService.handleError(error, 'pronunciation-evaluation-detailed');
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Get pronunciation history for a user with a specific word
   * @param walletAddress User's wallet address
   * @param wordId ID of the vocabulary word
   * @param detailed Whether to return detailed feedback
   */
  getPronunciationHistory(
    walletAddress: string,
    wordId?: string,
    detailed: boolean = false
  ): Observable<PronunciationHistoryItem[]> {
    let endpoint = `learning/daily/pronunciation/history`;
    
    if (wordId) {
      endpoint += `/${wordId}`;
    }
    
    return this.apiService.get<{attempts: PronunciationHistoryItem[]}>(
      endpoint,
      { 
        wallet: walletAddress,
        detailed: detailed ? 'true' : 'false'
      }
    ).pipe(
      map(response => response.attempts || []),
      catchError(error => {
        this.errorService.handleError(error, 'pronunciation-history');
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Get TTS audio for text
   * @param text Text to generate TTS for
   * @param languageCode Language code (e.g., 'en-US')
   */
  getTTS(text: string, languageCode: string = 'en-US'): Observable<Blob> {
    // Check cache first
    const cacheKey = `${languageCode}:${text}`;
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      const isExpired = (Date.now() - cached.timestamp) > this.CACHE_EXPIRY_MS;
      if (!isExpired) {
        // Return cached blob as observable
        return new Observable<Blob>(observer => {
          observer.next(cached.blob);
          observer.complete();
        });
      } else {
        // Remove expired cache
        this.audioCache.delete(cacheKey);
      }
    }
    
    // Need to handle blob response with a different approach
    const url = `${this.baseUrl}/learning/daily/tts/sentence`;
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      }),
      responseType: 'blob' as 'json'
    };
    
    return this.http.post<Blob>(
      url, 
      { text, languageCode }, 
      options
    ).pipe(
      map(blob => {
        // Cache the audio blob
        this.audioCache.set(cacheKey, { blob, timestamp: Date.now() });
        return blob;
      }),
      catchError(error => {
        this.errorService.handleError(error, 'tts-generation');
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Visualize pronunciation feedback
   * @param result Detailed pronunciation result
   * @returns HTML string with highlighted issues
   */
  visualizePronunciationFeedback(result: DetailedPronunciationResult): string {
    if (!result.wordDetails || result.wordDetails.length === 0) {
      return result.expected;
    }
    
    // Sort word details by time
    const sortedWords = [...result.wordDetails].sort((a, b) => a.start_time - b.start_time);
    
    // Generate HTML with color-coded feedback
    return sortedWords.map(word => {
      let color = 'inherit';
      if (word.score < 0.3) {
        color = '#ff4d4d'; // Red for poor
      } else if (word.score < 0.7) {
        color = '#ffcc00'; // Yellow for adequate
      } else {
        color = '#66cc66'; // Green for good
      }
      
      return `<span style="color: ${color};" title="Score: ${Math.round(word.score * 100)}%${
        word.issues.length ? '\nIssues: ' + word.issues.join(', ') : ''
      }">${word.word}</span>`;
    }).join(' ');
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

  /**
   * Get cached audio blob
   * @private
   * @param key Cache key
   * @returns Blob or null if not found/expired
   */
  private getCachedAudio(key: string): Blob | null {
    const cached = this.audioCache.get(key);
    if (cached) {
      const isExpired = (Date.now() - cached.timestamp) > this.CACHE_EXPIRY_MS;
      if (!isExpired) {
        return cached.blob;
      } else {
        // Remove expired cache
        this.audioCache.delete(key);
      }
    }
    return null;
  }
  
  /**
   * Cache audio blob with timestamp
   * @private
   * @param key Cache key
   * @param blob Audio blob to cache
   */
  private cacheAudio(key: string, blob: Blob): void {
    this.audioCache.set(key, { 
      blob, 
      timestamp: Date.now() 
    });
    
    // Limit cache size (if more than 50 items, remove oldest)
    if (this.audioCache.size > 50) {
      let oldestKey: string | null = null;
      let oldestTimestamp = Date.now();
      
      this.audioCache.forEach((value, mapKey) => {
        if (value.timestamp < oldestTimestamp) {
          oldestTimestamp = value.timestamp;
          oldestKey = mapKey;
        }
      });
      
      if (oldestKey) {
        this.audioCache.delete(oldestKey);
      }
    }
  }
}
