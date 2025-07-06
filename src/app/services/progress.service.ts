import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProgressData {
  cefrLevel?: string;
  language?: string;
  accuracyScore: number;
  pronunciationScore: number;
  grammarScore: number;
  vocabularyMastered: string[];
  timeSpent: number;
  attemptsCount: number;
  hintsUsed: number;
}

export interface SubmitProgressRequest {
  userId: string;
  lessonId: string;
  progressData: ProgressData;
}

export interface ProgressResponse {
  success: boolean;
  signaturePayload?: any;
  messageToSign?: any;
  expectedBatchTime?: string;
  error?: string;
}

export interface SignatureRequest {
  userId: string;
  signaturePayload: any;
  signature: string;
}

export interface AIProgressSubmission {
  userId: string;
  sessionId: string;
  progressType: 'voice_chat_daily_completion' | 'voice_chat_mega_bonus' | 'voice_chat_free_message' | 'token_purchase';
  voiceMessagesUsed: number;
  paidVoiceMessagesUsed: number;
  tokensEarned: number;
  tokensSpent: number;
  sessionData: {
    startTime: number;
    endTime: number;
    messageCount: number;
    paidMessageCount: number;
    achievedDailyCompletion?: boolean;
    achievedMegaBonus?: boolean;
    isFreeMessage?: boolean;
    messageIndex?: number;
    tokensSpentThisSession?: number;
  };
  walletAddress?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private apiUrl = environment.apiUrl;
  private submissionStatus = new BehaviorSubject<{pending: number, processed: number}>({pending: 0, processed: 0});

  constructor(private http: HttpClient) {}

  /**
   * Submit AI chat progress for batched blockchain recording
   */
  submitAIChatProgress(submission: AIProgressSubmission): Observable<ProgressResponse> {
    // Convert AI chat progress to the expected backend format
    const progressData: ProgressData = {
      accuracyScore: 100, // AI chat considered 100% accurate interaction
      pronunciationScore: 100, // Voice-only, assume good pronunciation
      grammarScore: 100, // AI chat interaction quality
      vocabularyMastered: [], // Could be extracted from chat content later
      timeSpent: submission.sessionData.endTime - submission.sessionData.startTime,
      attemptsCount: submission.sessionData.messageCount,
      hintsUsed: 0, // No hints in AI chat
      cefrLevel: 'A1', // Default for now
      language: 'english'
    };

    // Create a lesson-like ID for AI chat sessions
    const lessonId = `ai_chat_${submission.progressType}_${submission.sessionId}`;

    const request: SubmitProgressRequest = {
      userId: submission.userId,
      lessonId: lessonId,
      progressData: progressData
    };

    console.log('Submitting AI chat progress to backend for batching:', request);
    
    return this.http.post<ProgressResponse>(`${this.apiUrl}/progress/submit`, request);
  }

  /**
   * Submit traditional lesson progress for batched blockchain recording
   */
  submitLessonProgress(userId: string, lessonId: string, progressData: ProgressData): Observable<ProgressResponse> {
    const request: SubmitProgressRequest = {
      userId,
      lessonId,
      progressData
    };

    console.log('Submitting lesson progress to backend for batching:', request);
    
    return this.http.post<ProgressResponse>(`${this.apiUrl}/progress/submit`, request);
  }

  /**
   * Submit user signature for progress verification (optional for non-custodial proof)
   */
  submitSignature(signatureRequest: SignatureRequest): Observable<ProgressResponse> {
    console.log('Submitting signature for progress verification:', signatureRequest);
    
    return this.http.post<ProgressResponse>(`${this.apiUrl}/progress/signature`, signatureRequest);
  }

  /**
   * Get user progress status
   */
  getProgressStatus(userId: string, lessonId?: string): Observable<any> {
    const url = lessonId 
      ? `${this.apiUrl}/progress/status/${userId}?lessonId=${lessonId}`
      : `${this.apiUrl}/progress/status/${userId}`;
    
    return this.http.get(url);
  }

  /**
   * Get batch processor status
   */
  getBatchStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/progress/batch-status`);
  }

  /**
   * Get current submission status observable
   */
  getSubmissionStatus(): Observable<{pending: number, processed: number}> {
    return this.submissionStatus.asObservable();
  }

  /**
   * Update submission status (for internal tracking)
   */
  private updateSubmissionStatus(pending: number, processed: number) {
    this.submissionStatus.next({pending, processed});
  }

  /**
   * Submit AI chat daily completion for batched processing
   */
  async submitAIChatDailyCompletion(userId: string, sessionData: any): Promise<boolean> {
    try {
      const submission: AIProgressSubmission = {
        userId,
        sessionId: `daily_${Date.now()}`,
        progressType: 'voice_chat_daily_completion',
        voiceMessagesUsed: sessionData.voiceMessagesUsed || 4,
        paidVoiceMessagesUsed: sessionData.paidVoiceMessagesUsed || 0,
        tokensEarned: 1, // Daily completion = 1 token
        tokensSpent: 0,
        sessionData: {
          startTime: sessionData.startTime || Date.now() - 3600000, // 1 hour ago default
          endTime: Date.now(),
          messageCount: sessionData.voiceMessagesUsed || 4,
          paidMessageCount: sessionData.paidVoiceMessagesUsed || 0,
          achievedDailyCompletion: true
        }
      };

      const result = await this.submitAIChatProgress(submission).toPromise();
      return result?.success || false;
    } catch (error) {
      console.error('Error submitting daily completion progress:', error);
      return false;
    }
  }

  /**
   * Submit AI chat mega bonus for batched processing
   */
  async submitAIChatMegaBonus(userId: string, sessionData: any): Promise<boolean> {
    try {
      const submission: AIProgressSubmission = {
        userId,
        sessionId: `mega_${Date.now()}`,
        progressType: 'voice_chat_mega_bonus',
        voiceMessagesUsed: sessionData.voiceMessagesUsed || 4,
        paidVoiceMessagesUsed: sessionData.paidVoiceMessagesUsed || 10,
        tokensEarned: 10, // Mega bonus = 10 tokens
        tokensSpent: sessionData.paidVoiceMessagesUsed * 2 || 20, // 2 tokens per paid message
        sessionData: {
          startTime: sessionData.startTime || Date.now() - 3600000,
          endTime: Date.now(),
          messageCount: sessionData.voiceMessagesUsed + sessionData.paidVoiceMessagesUsed,
          paidMessageCount: sessionData.paidVoiceMessagesUsed || 10,
          achievedMegaBonus: true
        }
      };

      const result = await this.submitAIChatProgress(submission).toPromise();
      return result?.success || false;
    } catch (error) {
      console.error('Error submitting mega bonus progress:', error);
      return false;
    }
  }

  /**
   * Submit token purchase/spending for batched recording
   */
  async submitTokenSpending(userId: string, tokensSpent: number, reason: string): Promise<boolean> {
    try {
      const submission: AIProgressSubmission = {
        userId,
        sessionId: `spend_${Date.now()}`,
        progressType: 'token_purchase',
        voiceMessagesUsed: 0,
        paidVoiceMessagesUsed: 0,
        tokensEarned: 0,
        tokensSpent: tokensSpent,
        sessionData: {
          startTime: Date.now(),
          endTime: Date.now(),
          messageCount: 0,
          paidMessageCount: 0
        }
      };

      const result = await this.submitAIChatProgress(submission).toPromise();
      return result?.success || false;
    } catch (error) {
      console.error('Error submitting token spending progress:', error);
      return false;
    }
  }

  /**
   * Submit individual free voice chat message for batched recording
   */
  async submitFreeVoiceChatMessage(userId: string, messageNumber: number, sessionData: any): Promise<boolean> {
    try {
      const submission: AIProgressSubmission = {
        userId,
        sessionId: `free_voice_${Date.now()}_${messageNumber}`,
        progressType: 'voice_chat_free_message',
        voiceMessagesUsed: messageNumber,
        paidVoiceMessagesUsed: 0,
        tokensEarned: 0, // No tokens for individual free messages
        tokensSpent: 0,
        sessionData: {
          startTime: sessionData.startTime || Date.now() - 600000,
          endTime: Date.now(),
          messageCount: messageNumber,
          paidMessageCount: 0,
          isFreeMessage: true,
          messageIndex: messageNumber
        }
      };

      const result = await this.submitAIChatProgress(submission).toPromise();
      return result?.success || false;
    } catch (error) {
      console.error(`Error submitting free voice chat message ${messageNumber}:`, error);
      return false;
    }
  }

  /**
   * Submit individual paid voice chat message for batched recording
   */
  async submitPaidVoiceChatMessage(userId: string, paidMessageNumber: number, sessionData: any): Promise<boolean> {
    try {
      const submission: AIProgressSubmission = {
        userId,
        sessionId: `paid_voice_${Date.now()}_${paidMessageNumber}`,
        progressType: 'voice_chat_free_message', // Using same type for now, could add 'voice_chat_paid_message' later
        voiceMessagesUsed: sessionData.totalVoiceMessages || 4,
        paidVoiceMessagesUsed: paidMessageNumber,
        tokensEarned: 0, // No tokens for individual paid messages (only for completion bonuses)
        tokensSpent: 2, // Each paid message costs 2 tokens
        sessionData: {
          startTime: sessionData.startTime || Date.now() - 600000,
          endTime: Date.now(),
          messageCount: sessionData.totalVoiceMessages || 4,
          paidMessageCount: paidMessageNumber,
          isFreeMessage: false,
          messageIndex: paidMessageNumber,
          tokensSpentThisSession: sessionData.tokensSpentThisSession || 0
        }
      };

      const result = await this.submitAIChatProgress(submission).toPromise();
      return result?.success || false;
    } catch (error) {
      console.error(`Error submitting paid voice chat message ${paidMessageNumber}:`, error);
      return false;
    }
  }
}
