import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  audioTrack?: any;
  isAudio?: boolean;
  isGeneratingAudio?: boolean;
  translation?: string;
  suggestedResponses?: any[];
  pronunciation?: any;
  showTranslation?: boolean;
  showSideBySide?: boolean;
}

export interface AiChatSession {
  sessionId: string;
  userId: string;
  isConnected: boolean;
  messages: ChatMessage[];
  isInitialized: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatSessionService {
  private static readonly SINGLETON_KEY = '__YAP_AI_CHAT_SESSION_SERVICE_SINGLETON__';
  
  private sessionSubject = new BehaviorSubject<AiChatSession | null>(null);
  public session$ = this.sessionSubject.asObservable();
  
  private initializationPromise: Promise<AiChatSession> | null = null;
  
  constructor(private http: HttpClient) {
    // Ensure singleton pattern
    if ((window as any)[AiChatSessionService.SINGLETON_KEY]) {
      return (window as any)[AiChatSessionService.SINGLETON_KEY];
    }
    (window as any)[AiChatSessionService.SINGLETON_KEY] = this;
    
    console.log('🎯 AiChatSessionService: Singleton instance created');
  }
  
  /**
   * Get or create the AI chat session - guaranteed to only create one session
   */
  async getOrCreateSession(): Promise<AiChatSession> {
    const currentSession = this.sessionSubject.value;
    
    // If we already have an initialized session, return it
    if (currentSession && currentSession.isInitialized) {
      console.log('🎯 AiChatSessionService: Returning existing session:', currentSession.sessionId);
      return currentSession;
    }
    
    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      console.log('🎯 AiChatSessionService: Waiting for existing initialization to complete');
      return this.initializationPromise;
    }
    
    // Start new initialization
    console.log('🎯 AiChatSessionService: Starting new session initialization');
    this.initializationPromise = this.createNewSession();
    
    try {
      const session = await this.initializationPromise;
      console.log('🎯 AiChatSessionService: Session initialization completed:', session.sessionId);
      return session;
    } finally {
      // Clear the promise so future calls can create a new session if needed
      this.initializationPromise = null;
    }
  }
  
  /**
   * Create a new AI chat session
   */
  private async createNewSession(): Promise<AiChatSession> {
    console.log('🎯 AiChatSessionService: Creating new AI chat session');
    
    try {
      const userId = this.generateUserId();
      
      const sessionResponse = await this.http.post<any>(`${environment.apiUrl}/chat/start-session`, {
        userId,
        language: 'spanish',
        cefrLevel: 'B1',
        conversationMode: 'free' as const
      }).toPromise();
      
      if (!sessionResponse?.success || !sessionResponse?.session) {
        throw new Error('Failed to create AI chat session');
      }
      
      const initialMessages: ChatMessage[] = [];
      
      // Add initial message if provided
      if (sessionResponse.session.initialMessage) {
        const initialMessage: ChatMessage = {
          id: 'ai-initial-' + Date.now(),
          content: sessionResponse.session.initialMessage,
          isUser: false,
          timestamp: new Date(),
          translation: sessionResponse.session.initialMessageTranslation,
          showTranslation: true,
          showSideBySide: false
        };
        initialMessages.push(initialMessage);
      }
      
      const session: AiChatSession = {
        sessionId: sessionResponse.session.sessionId,
        userId,
        isConnected: true,
        messages: initialMessages,
        isInitialized: true
      };
      
      // Update the subject
      this.sessionSubject.next(session);
      
      console.log('🎯 AiChatSessionService: New session created successfully:', session.sessionId);
      return session;
      
    } catch (error) {
      console.error('🎯 AiChatSessionService: Error creating session:', error);
      throw error;
    }
  }
  
  /**
   * Add a message to the current session
   */
  addMessage(message: ChatMessage): void {
    const currentSession = this.sessionSubject.value;
    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        messages: [...currentSession.messages, message]
      };
      this.sessionSubject.next(updatedSession);
      console.log('🎯 AiChatSessionService: Added message to session:', message.id);
    }
  }
  
  /**
   * Update a message in the current session
   */
  updateMessage(messageId: string, updates: Partial<ChatMessage>): void {
    const currentSession = this.sessionSubject.value;
    if (currentSession) {
      const updatedMessages = currentSession.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      const updatedSession = {
        ...currentSession,
        messages: updatedMessages
      };
      this.sessionSubject.next(updatedSession);
      console.log('🎯 AiChatSessionService: Updated message:', messageId);
    }
  }
  
  /**
   * Clear the current session
   */
  clearSession(): void {
    this.sessionSubject.next(null);
    this.initializationPromise = null;
    console.log('🎯 AiChatSessionService: Session cleared');
  }
  
  /**
   * Get the current session (synchronous)
   */
  getCurrentSession(): AiChatSession | null {
    return this.sessionSubject.value;
  }
  
  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
}
