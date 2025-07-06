import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TokenService, TokenSpendingRequest } from '../../services/token.service';
import { AudioService, AudioTrack } from '../../services/audio.service';
import { AiChatSessionService, AiChatSession } from '../../services/ai-chat-session.service';
import { BlockchainService } from '../../services/blockchain.service';
import { RewardService } from '../../core/reward/reward.service';
import { ProgressService } from '../../services/progress.service';
import { ToastController, ModalController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { trigger, state, style, transition, animate } from '@angular/animations';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  audioTrack?: AudioTrack;
  isAudio?: boolean;
  isGeneratingAudio?: boolean;
  translation?: string;
  suggestedResponses?: SuggestedResponse[];
  pronunciation?: PronunciationAssessment;
  showTranslation?: boolean;
  showSideBySide?: boolean; // New property for side-by-side view
}

export interface SuggestedResponse {
  id: string;
  spanish: string;
  english: string;
  difficulty: 'easy' | 'medium' | 'hard';
  audioUrl?: string;
}

export interface PronunciationAssessment {
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  feedback: string;
  wordScores: WordScore[];
}

export interface WordScore {
  word: string;
  accuracyScore: number;
  errorType?: 'mispronunciation' | 'omission' | 'insertion';
  feedback?: string;
}

export interface ChatWordAnalysis {
  word: string;
  isQuizWorthy: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  frequency: number;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';
  translation?: string;
}

export interface DailyChatCompletion {
  date: string;
  messagesCompleted: number;
  targetMessages: number;
  tokensEarned: number;
  wordsExtracted: ChatWordAnalysis[];
  isCompleted: boolean;
  extendedSessionBonus?: number;
  paidMessagesCount: number;
  sessionTokensSpent: number;
}

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.page.html',
  styleUrls: ['./ai-chat.page.scss'],
  animations: [
    trigger('slideInOut', [
      state('in', style({
        maxHeight: '200px',
        opacity: 1,
        padding: '16px'
      })),
      state('out', style({
        maxHeight: '0px',
        opacity: 0,
        padding: '0 16px'
      })),
      transition('in => out', animate('300ms ease-out')),
      transition('out => in', animate('300ms ease-in'))
    ])
  ]
})
export class AiChatPage implements OnInit, OnDestroy {
  @ViewChild('chatContainer', { static: false }) chatContainer!: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isRecording = false;
  isProcessing = false;
  isConnected = false;
  isInitializing = false;
  
  // Dynamic header
  userLanguage = 'AI Chat';
  
  // Suggestions drawer
  showSuggestionsDrawer = false;
  drawerPosition = 'bottom';
  
  // Session management through singleton service
  private aiChatSession: AiChatSession | null = null;
  
  // Token tracking
  sessionTokensUsed = 0;
  estimatedTokensPerMinute = 5;
  sessionStartTime?: Date;
  
  // AI Chat session
  sessionId?: string;
  userId?: string;
  
  // Audio recording
  mediaRecorder?: MediaRecorder;
  audioChunks: Blob[] = [];
  
  // Enhanced features
  showTranslations = true;  // Always show translations for learning
  isAssessingPronunciation = false;
  lastRecordingBlob?: Blob;
  
  // Learning Modal
  showLearningModal = false;
  selectedMessageForLearning?: ChatMessage;
  isPracticeRecording = false;
  practiceMediaRecorder?: MediaRecorder;
  practiceAudioChunks: Blob[] = [];
  
  // Selected response for practice
  selectedResponseForPractice?: SuggestedResponse;

  // Token earning tracking - Voice-only chat limits
  dailyFreeVoiceLimit = 4; // Reduced for voice-only chats
  currentDailyVoiceCount = 0;
  currentPaidVoiceCount = 0;
  hasEarnedDailyToken = false;
  hasEarnedExtendedSessionBonus = false;
  extractedChatWords: ChatWordAnalysis[] = [];
  
  // Completion tracking
  dailyCompletion: DailyChatCompletion | null = null;
  
  // Voice-specific tracking
  sessionVoiceMessages = 0;
  isUsingFreeAllowance = true;
  
  // Audio management
  private currentAudio: HTMLAudioElement | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private http: HttpClient,
    private tokenService: TokenService,
    private audioService: AudioService,
    private aiChatSessionService: AiChatSessionService,
    private blockchainService: BlockchainService,
    private rewardService: RewardService,
    private progressService: ProgressService,
    private toastController: ToastController,
    private modalController: ModalController,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
  ) {
    const componentId = 'comp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    console.log('� AiChatPage: Constructor called', { componentId });
  }

  async ngOnInit() {
    console.log('🚀 AiChatPage: ngOnInit called');
    
    // Load user language preference
    this.loadUserLanguage();
    
    // Subscribe to the session service
    this.subscriptions.push(
      this.aiChatSessionService.session$.subscribe(session => {
        if (session) {
          console.log('🚀 AiChatPage: Received session from service:', session.sessionId);
          this.aiChatSession = session;
          this.sessionId = session.sessionId;
          this.userId = session.userId;
          this.isConnected = session.isConnected;
          this.messages = [...session.messages]; // Copy messages
        }
      })
    );
    
    // Initialize daily tracking
    await this.initializeDailyTracking();
    
    // Initialize the chat
    await this.initializeChat();
  }

  ngOnDestroy() {
    console.log('🚀 AiChatPage: ngOnDestroy called');
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.disconnectWebSocket();
    this.audioService.dispose(); // Clean up audio resources
    
    // Stop any currently playing audio
    this.stopCurrentAudio();
    
    // Cancel any ongoing speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  /**
   * Load user's language preference from localStorage
   */
  private loadUserLanguage() {
    try {
      console.log('🔄 AI Chat: Loading user language...');
      
      // Try multiple sources for user language data
      let languageToLearn = null;
      
      // First try currentUser in localStorage
      const currentUser = localStorage.getItem('currentUser');
      console.log('AI Chat: currentUser from localStorage:', currentUser);
      
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        languageToLearn = userData.language_to_learn || userData.languageToLearn || userData.initial_language_to_learn;
        console.log('AI Chat: Found user language from currentUser:', languageToLearn, 'from userData:', userData);
      }
      
      // If still no language, try to get it from the registration data
      if (!languageToLearn) {
        const registrationData = localStorage.getItem('registrationData');
        console.log('AI Chat: registrationData from localStorage:', registrationData);
        
        if (registrationData) {
          const regData = JSON.parse(registrationData);
          languageToLearn = regData.language_to_learn || regData.languageToLearn || regData.initial_language_to_learn;
          console.log('AI Chat: Found user language from registrationData:', languageToLearn, 'from regData:', regData);
        }
      }
      
      // Also try direct language_to_learn key
      if (!languageToLearn) {
        languageToLearn = localStorage.getItem('language_to_learn');
        console.log('AI Chat: Found direct language_to_learn:', languageToLearn);
      }

      // Try user profile data from API response if available
      if (!languageToLearn) {
        const userProfile = localStorage.getItem('userProfile');
        if (userProfile) {
          const profileData = JSON.parse(userProfile);
          languageToLearn = profileData.language_to_learn || profileData.initial_language_to_learn;
          console.log('AI Chat: Found user language from userProfile:', languageToLearn);
        }
      }
      
      // If we found a language, format it for display
      if (languageToLearn) {
        // Capitalize first letter and add "Chat" instead of "Practice" for AI chat
        this.userLanguage = languageToLearn.charAt(0).toUpperCase() + 
                           languageToLearn.slice(1) + ' Chat';
        console.log('✅ AI Chat: Set userLanguage to:', this.userLanguage);
      } else {
        console.log('⚠️ AI Chat: No language found, using fallback');
        this.userLanguage = 'AI Chat'; // More specific fallback for AI chat
      }
    } catch (error) {
      console.error('❌ Error loading user language preference:', error);
      this.userLanguage = 'AI Chat'; // More specific fallback for AI chat
    }
  }

  ionViewWillEnter() {
    console.log('🚀 AiChatPage: ionViewWillEnter called');
    
    // Refresh user language preference each time the page is entered
    this.loadUserLanguage();
    
    // Force change detection to ensure the header updates
    this.cdr.detectChanges();
    
    // Show instructions toast
    this.showInstructionsToast();
    // No additional initialization needed - everything is handled by the session service
  }

  /**
   * Show instructions toast on page entry
   */
  private async showInstructionsToast() {
    const toast = await this.toastController.create({
      message: 'Tap AI messages to hear them spoken aloud',
      duration: 3000,
      position: 'top',
      color: 'primary',
      icon: 'volume-high'
    });
    toast.present();
  }

  /**
   * Initialize chat session and check allowances, then token balance
   */
  async initializeChat() {
    console.log('🚀 AiChatPage: initializeChat called');
    
    // Prevent duplicate initialization
    if (this.isInitializing) {
      console.log('🚀 AiChatPage: Already initializing, skipping...');
      return;
    }
    
    this.isInitializing = true;
    
    try {
      // Check if user has free voice messages remaining
      if (this.currentDailyVoiceCount < this.dailyFreeVoiceLimit) {
        console.log(`🚀 AiChatPage: User has ${this.dailyFreeVoiceLimit - this.currentDailyVoiceCount} free voice messages remaining`);
        await this.getOrCreateSession();
        this.sessionStartTime = new Date();
        console.log('🚀 AiChatPage: Initialization completed successfully with free voice allowance');
        return;
      }

      console.log('🚀 AiChatPage: No free voice messages, checking token balance...');
      
      // No free voice messages, check token balance (need 2 tokens per voice message)
      const balance = await this.tokenService.getTokenBalance().toPromise();
      if (!balance || balance.balance < 2) {
        console.log('🚀 AiChatPage: Insufficient token balance for voice chat');
        await this.showInsufficientTokensForVoiceWarning();
        this.router.navigate(['/dashboard']);
        return;
      }

      console.log('🚀 AiChatPage: User has tokens for voice chat, connecting to service...');
      
      // User has tokens, connect to service
      await this.getOrCreateSession();
      this.sessionStartTime = new Date();
      console.log('🚀 AiChatPage: Initialization completed successfully with tokens');
      
    } catch (error) {
      console.error('🚀 AiChatPage: Error initializing chat:', error);
      await this.showErrorToast('Failed to initialize voice chat session');
    } finally {
      this.isInitializing = false;
    }
  }
  
  /**
   * Get or create AI chat session through the singleton service
   */
  private async getOrCreateSession(): Promise<void> {
    try {
      const session = await this.aiChatSessionService.getOrCreateSession();
      console.log('🚀 AiChatPage: Got session from service:', session.sessionId);
      
      // The session will be automatically updated via the subscription in ngOnInit
      this.isConnected = true;
    } catch (error) {
      console.error('🚀 AiChatPage: Error getting session from service:', error);
      throw error;
    }
  }

  /**
   * Get current user ID (placeholder implementation)
   */
  private getCurrentUserId(): string {
    return this.userId || 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Disconnect from AI service
   */
  private disconnectWebSocket() {
    this.isConnected = false;
    console.log('Disconnected from AI chat service');
  }

  /**
   * Send text message - DISABLED for voice-only chat
   */
  async sendMessage() {
    // Voice-only chat - redirect to voice recording
    const alert = await this.alertController.create({
      header: 'Voice Chat Only',
      message: 'This is a voice-only conversation experience. Please use the microphone button to speak!',
      buttons: ['OK']
    });
    await alert.present();
    
    // Clear any text input
    this.currentMessage = '';
  }

  /**
   * Start voice recording
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
        await this.sendAudioMessage(audioBlob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

    } catch (error) {
      console.error('Error starting recording:', error);
      await this.showErrorToast('Could not access microphone');
    }
  }

  /**
   * Stop voice recording
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
   * Send audio message with pronunciation assessment
   */
  private async sendAudioMessage(audioBlob: Blob) {
    this.lastRecordingBlob = audioBlob;
    
    const audioTrack: AudioTrack = {
      id: 'audio-' + Date.now(),
      url: URL.createObjectURL(audioBlob),
      title: 'Voice message',
      type: 'user-recording'
    };

    const audioMessage: ChatMessage = {
      id: 'audio-' + Date.now(),
      content: 'Voice message', // Placeholder - will be updated by AI service response
      isUser: true,
      timestamp: new Date(),
      isAudio: true,
      audioTrack
    };

    // Add message to the session service
    this.aiChatSessionService.addMessage(audioMessage);
    
    // Process the message (this will trigger AI response and speech-to-text)
    await this.processUserMessage(audioMessage);
    this.scrollToBottom();
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:audio/wav;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Process user message and send to AI
   */
  private async processUserMessage(message: ChatMessage) {
    try {
      this.isProcessing = true;
      this.sessionVoiceMessages++;

      // Check if user is still within free voice allowance
      if (this.currentDailyVoiceCount < this.dailyFreeVoiceLimit) {
        // Use free voice allowance
        this.currentDailyVoiceCount++;
        this.isUsingFreeAllowance = true;
        
        // Update daily completion tracking
        if (this.dailyCompletion) {
          this.dailyCompletion.messagesCompleted = this.currentDailyVoiceCount;
          this.saveDailyCompletion();
        }
        
        console.log(`Used free voice message ${this.currentDailyVoiceCount}/${this.dailyFreeVoiceLimit}`);
        
        // Record EVERY free voice chat action for blockchain batching (even if no tokens earned yet)
        try {
          const userId = this.getCurrentUserId();
          await this.recordFreeVoiceChatProgress(userId, this.currentDailyVoiceCount);
          console.log(`Free voice chat ${this.currentDailyVoiceCount} recorded for batching`);
        } catch (progressError) {
          console.error('Error recording free voice chat progress:', progressError);
          // Don't fail the message sending if progress recording fails
        }
        
        await this.sendToAiService(message);
        
        // Check if user has completed daily allowance
        await this.checkDailyVoiceCompletion();
        
        return;
      }

      // Free allowance exhausted, need to spend tokens
      this.isUsingFreeAllowance = false;
      
      const spendingRequest: TokenSpendingRequest = {
        featureId: 'ai-chat-voice',
        amount: 2, // 2 tokens per voice message (more expensive than text)
        action: 'voice_chat_message',
        metadata: {
          messageId: message.id,
          messageType: 'voice',
          sessionId: this.sessionId
        }
      };

      const spendingResult = await this.tokenService.spendTokens(spendingRequest).toPromise();
      
      if (!spendingResult?.success) {
        await this.showInsufficientTokensWarning();
        return;
      }

      this.sessionTokensUsed += 2;
      this.currentPaidVoiceCount++;
      
      // Update daily completion tracking with paid message data
      if (this.dailyCompletion) {
        this.dailyCompletion.paidMessagesCount = this.currentPaidVoiceCount;
        this.dailyCompletion.sessionTokensSpent = this.sessionTokensUsed;
        this.saveDailyCompletion();
      }
      
      console.log(`Spent 2 tokens for voice chat. New balance: ${spendingResult.newBalance}`);
      
      // Record token spending AND paid voice message progress for blockchain batching
      try {
        const userId = this.getCurrentUserId();
        
        // Record the token spending
        await this.progressService.submitTokenSpending(userId, 2, 'voice_chat_message');
        console.log('Token spending recorded for batching');
        
        // Record the paid voice message progress (separate from token spending)
        await this.recordPaidVoiceChatProgress(userId, this.currentPaidVoiceCount);
        console.log(`Paid voice chat ${this.currentPaidVoiceCount} recorded for batching`);
      } catch (progressError) {
        console.error('Error recording paid voice chat progress:', progressError);
        // Don't fail the message sending if progress recording fails
      }
      
      await this.sendToAiService(message);
      
      // Show mega bonus progress
      await this.showMegaBonusProgress();
      
      // Check for extended session bonus
      await this.checkExtendedSessionBonus();

    } catch (error) {
      console.error('Error processing message:', error);
      await this.showErrorToast('Failed to send message');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send message to AI service via HTTP
   */
  private async sendToAiService(message: ChatMessage) {
    try {
      if (!this.sessionId) {
        throw new Error('No active session. Please restart the chat.');
      }

      let response;

      if (message.isAudio && this.lastRecordingBlob) {
        // Handle voice message with pronunciation assessment
        const reader = new FileReader();
        const audioData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1]; // Remove data:audio/wav;base64, prefix
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(this.lastRecordingBlob!);
        });

        const voicePayload = {
          userId: this.getCurrentUserId(),
          sessionId: this.sessionId,
          audioData: audioData,
          language: 'spanish',
          cefrLevel: 'B1',
          conversationMode: 'guided',
          userMessage: '' // Empty for voice-only messages
        };

        console.log('Sending voice message to AI service');
        response = await this.http.post<any>(`${environment.apiUrl}/chat/voice-message`, voicePayload).toPromise();
        
        // Clear the recording blob after sending
        this.lastRecordingBlob = undefined;
      } else {
        // Handle text message
        const payload = {
          userId: this.getCurrentUserId(),
          userMessage: message.content,
          sessionId: this.sessionId,
          language: 'spanish',
          cefrLevel: 'B1',
          conversationMode: 'guided'
        };

        console.log('Sending text message to AI service:', payload);
        response = await this.http.post<any>(`${environment.apiUrl}/chat/message`, payload).toPromise();
      }
      
      console.log('AI service response:', response);
      
      // Handle the response
      await this.handleAiResponse(response, message);

    } catch (error) {
      console.error('Error sending message to AI service:', error);
      
      // Create a fallback response
      const fallbackResponse = {
        aiMessage: "I'm sorry, I'm having trouble connecting right now. Please try again later."
      };
      
      await this.handleAiResponse(fallbackResponse);
    }
  }

  /**
   * Handle AI response with enhanced features
   */
  private async handleAiResponse(response: any, originalMessage?: ChatMessage) {
    // Update the conversationId if provided by the backend
    if (response.conversationId) {
      this.sessionId = response.conversationId;
    }

    // Extract AI message content
    const aiContent = response.aiMessage || response.response || response.text || 'I\'m sorry, I didn\'t understand that.';
    
    // Use suggested responses from backend if available, otherwise generate fallback
    let suggestedResponses: SuggestedResponse[] = [];
    
    // Use translation from backend if available, otherwise generate one
    let translation = '';
    if (response.aiMessageTranslation) {
      // Use backend-provided translation
      translation = response.aiMessageTranslation;
      console.log('Using backend translation:', translation);
    } else {
      // Fallback: generate translation on frontend
      try {
        translation = await this.generateTranslation(aiContent);
        console.log('Generated frontend translation:', translation);
      } catch (error) {
        console.error('Error generating translation:', error);
        translation = `English: ${aiContent.substring(0, 50)}${aiContent.length > 50 ? '...' : ''}`;
      }
    }

    // Use suggested response translations from backend if available
    if (response.suggestedResponsesTranslations && response.suggestedResponsesTranslations.length > 0) {
      // Backend provides suggested responses with translations
      suggestedResponses = response.suggestedResponsesTranslations.slice(0, 3).map((suggestion: any, index: number) => ({
        id: 'backend-suggestion-' + Date.now() + '-' + index,
        spanish: suggestion.original,
        english: suggestion.translation,
        difficulty: 'medium' as const
      }));
      console.log('Using backend suggested responses with translations:', suggestedResponses);
    } else if (response.suggestedResponses && response.suggestedResponses.length > 0) {
      // Backend provides suggested responses as strings, convert to our format
      suggestedResponses = response.suggestedResponses.slice(0, 3).map((suggestion: string, index: number) => ({
        id: 'backend-suggestion-' + Date.now() + '-' + index,
        spanish: suggestion,
        english: '', // Will be generated
        difficulty: 'medium' as const
      }));
      
      // Generate translations for the suggested responses
      for (const suggestion of suggestedResponses) {
        try {
          const sugTranslation = await this.generateTranslation(suggestion.spanish);
          suggestion.english = sugTranslation;
        } catch (error) {
          console.error('Error translating suggestion:', error);
          suggestion.english = 'Translation not available';
        }
      }
      console.log('Using backend suggested responses with frontend translations:', suggestedResponses);
    } else {
      // Always use fallback suggestions to ensure responses are shown
      console.log('No backend suggestions, using fallback');
      suggestedResponses = this.getFallbackSuggestions();
    }

    const aiMessage: ChatMessage = {
      id: 'ai-' + Date.now(),
      content: aiContent,
      isUser: false,
      timestamp: new Date(),
      suggestedResponses,
      translation, // Always set translation immediately
      showTranslation: true,  // Always show translations for AI messages
      showSideBySide: false   // Default to collapsed side-by-side view
    };

    console.log('AI Content:', aiContent);
    console.log('Generated Translation:', translation);
    console.log('Suggested Responses from Backend:', response.suggestedResponses);
    console.log('Final AI Message:', aiMessage);

    // Add AI message to the session service
    this.aiChatSessionService.addMessage(aiMessage);
    
    // Handle pronunciation result if this was a voice message
    if (originalMessage?.isAudio && response.pronunciationResult) {
      // Find the user message and update it with pronunciation assessment
      this.aiChatSessionService.updateMessage(originalMessage.id, {
        pronunciation: {
          overallScore: response.pronunciationResult.overallScore || 85,
          accuracyScore: response.pronunciationResult.accuracyScore || 85,
          fluencyScore: response.pronunciationResult.fluencyScore || 85,
          completenessScore: response.pronunciationResult.completenessScore || 85,
          feedback: response.pronunciationResult.feedback || 'Good pronunciation!',
          wordScores: response.pronunciationResult.wordDetails || []
        }
      });
      console.log('Added pronunciation assessment to user message:', originalMessage.id);
    }
    
    this.scrollToBottom();
  }

  /**
   * Generate suggested responses based on AI message
   */
  private async generateSuggestedResponses(aiMessage: string): Promise<SuggestedResponse[]> {
    try {
      const suggestionsResponse = await this.http.post<any>(`${environment.apiUrl}/learning/suggested-responses`, {
        aiMessage,
        language: 'spanish',
        cefrLevel: 'B1',
        count: 3
      }).toPromise();
      
      if (suggestionsResponse && suggestionsResponse.suggestions) {
        return suggestionsResponse.suggestions.map((suggestion: any, index: number) => ({
          id: 'suggestion-' + Date.now() + '-' + index,
          spanish: suggestion.spanish,
          english: suggestion.english,
          difficulty: suggestion.difficulty || 'medium'
        }));
      }
    } catch (error) {
      console.error('Error generating suggested responses:', error);
    }
    
    // Return fallback suggestions
    return this.getFallbackSuggestions();
  }

  /**
   * Get fallback suggested responses
   */
  getFallbackSuggestions(): SuggestedResponse[] {
    const latestAiMessage = this.getLatestAiMessage();
    const aiContent = latestAiMessage?.content || '';
    
    // Context-aware suggestions based on AI's message
    if (aiContent.includes('conocerte') || aiContent.includes('conversación') || aiContent.includes('tiempo libre')) {
      // Greeting and introduction responses
      return [
        {
          id: 'intro-1',
          spanish: '¡Hola Ana! Me llamo [tu nombre] y estoy emocionado por aprender español.',
          english: 'Hi Ana! My name is [your name] and I\'m excited to learn Spanish.',
          difficulty: 'easy'
        },
        {
          id: 'intro-2',
          spanish: 'Me gusta leer libros y escuchar música. ¿Y tú?',
          english: 'I like to read books and listen to music. And you?',
          difficulty: 'medium'
        }
      ];
    }
    
    // Generic conversational responses
    return [
      {
        id: 'fallback-1',
        spanish: '¿Puedes repetir eso, por favor?',
        english: 'Can you repeat that, please?',
        difficulty: 'easy'
      },
      {
        id: 'fallback-2',
        spanish: 'Eso es muy interesante.',
        english: 'That\'s very interesting.',
        difficulty: 'easy'
      }
    ];
  }

  /**
   * Play audio from message
   */
  async playAudio(message: ChatMessage) {
    if (message.audioTrack) {
      await this.audioService.playTrack(message.audioTrack);
    }
  }

  /**
   * Handle audio track ended
   */
  onAudioTrackEnded(track: AudioTrack) {
    console.log('Audio track ended:', track.id);
  }

  /**
   * Handle audio playback error
   */
  onAudioError(error: { track: AudioTrack; error: string }) {
    console.error('Audio playback error:', error);
    this.showErrorToast('Audio playback failed: ' + error.error);
  }

  /**
   * Scroll chat to bottom
   */
  private scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  /**
   * Show insufficient tokens warning
   */
  private async showInsufficientTokensWarning() {
    const toast = await this.toastController.create({
      message: 'Insufficient tokens to continue chat session',
      duration: 3000,
      color: 'warning',
      position: 'top',
      buttons: [
        {
          text: 'Get Tokens',
          handler: () => {
            this.router.navigate(['/tokens']);
          }
        }
      ]
    });
    await toast.present();
  }

  /**
   * Show insufficient tokens warning for voice chat
   */
  private async showInsufficientTokensForVoiceWarning() {
    const stats = this.getVoiceChatStats();
    const remainingForBonus = Math.max(0, 10 - this.currentPaidVoiceCount);
    
    const alert = await this.alertController.create({
      header: 'Voice Chat Requires Tokens',
      message: `
        <div style="text-align: left;">
          <p>You've used your ${this.dailyFreeVoiceLimit} free voice messages for today!</p>
          <br>
          <p><strong>To continue voice chatting:</strong></p>
          <ul>
            <li>Each voice message costs 2 YAP tokens</li>
            <li>You need at least 2 tokens to continue</li>
          </ul>
          <br>
          ${!this.hasEarnedExtendedSessionBonus && remainingForBonus > 0 ? `
          <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 12px; border-radius: 8px; color: white; margin: 10px 0;">
            <p style="margin: 0; font-weight: bold;">🎯 MEGA BONUS OPPORTUNITY!</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              Just ${remainingForBonus} more paid messages = <strong>10 YAP tokens bonus!</strong><br>
              (That's 50% cashback on your spending!)
            </p>
          </div>
          ` : ''}
          <p><em>💡 Complete lessons and quizzes to earn more tokens!</em></p>
        </div>
      `,
      buttons: [
        {
          text: 'Get Tokens',
          handler: () => {
            this.router.navigate(['/dashboard']);
          }
        },
        {
          text: 'Close',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  /**
   * Exit chat session
   */
  async exitChat() {
    this.disconnectWebSocket();
    
    // Show session summary toast with voice-specific stats
    const sessionDuration = this.sessionStartTime ? 
      Math.round((Date.now() - this.sessionStartTime.getTime()) / 60000) : 0;

    const stats = this.getVoiceChatStats();
    const remainingForBonus = Math.max(0, 10 - this.currentPaidVoiceCount);
    
    // Create a concise toast message
    let toastMessage = `Session: ${sessionDuration}min | Tokens: ${this.sessionTokensUsed}`;
    if (stats.hasEarnedDailyToken) {
      toastMessage += ' | 🎉 Daily Token Earned!';
    }
    if (stats.hasEarnedExtendedBonus) {
      toastMessage += ' | 🌟 Mega Bonus: 10 Tokens!';
    }
    
    const toast = await this.toastController.create({
      message: toastMessage,
      duration: 4000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();

    this.router.navigate(['/dashboard']);
  }

  /**
   * Toggle microphone recording
   */
  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  // Note: Translations are always shown for AI messages to aid learning

  /**
   * Use a suggested response
   */
  async useSuggestedResponse(response: SuggestedResponse) {
    // Add the Spanish text as user message
    const userMessage: ChatMessage = {
      id: 'user-suggested-' + Date.now(),
      content: response.spanish,
      isUser: true,
      timestamp: new Date(),
      translation: response.english
    };

    // Add message to the session service
    this.aiChatSessionService.addMessage(userMessage);
    
    // Process the message
    await this.processUserMessage(userMessage);
    this.scrollToBottom();
  }

  /**
   * Stop any currently playing audio
   */
  private stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  /**
   * Generate audio for a suggested response
   */
  async generateSuggestedResponseAudio(response: SuggestedResponse) {
    try {
      // Call neural TTS service for the Spanish text with different voice
      const audioResponse = await this.http.post<any>(`${environment.apiUrl}/chat/tts`, {
        text: response.spanish,
        language: 'spanish',
        voice: 'nova', // High-quality neural voice for consistency
        options: {
          rate: 0.75, // Slower for pronunciation practice
          emotion: 'friendly',
          pitch: 'medium'
        }
      }).toPromise();

      if (audioResponse && audioResponse.success && audioResponse.audioData) {
        response.audioUrl = `data:audio/wav;base64,${audioResponse.audioData}`;
      }
    } catch (error) {
      console.error('Error generating neural TTS for suggested response:', error);
    }
  }

  /**
   * Play audio for a suggested response
   */
  async playSuggestedResponseAudio(response: SuggestedResponse) {
    // Stop any currently playing audio first
    this.stopCurrentAudio();
    
    if (!response.audioUrl) {
      await this.generateSuggestedResponseAudio(response);
    }
    
    if (response.audioUrl) {
      try {
        const audio = new Audio(response.audioUrl);
        this.currentAudio = audio;
        
        // Set audio properties for better learning experience
        audio.volume = 0.9;
        audio.preload = 'auto';
        
        // Clear reference when audio ends
        audio.addEventListener('ended', () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
        });
        
        await audio.play();
        console.log('Suggested response audio played successfully');
      } catch (error) {
        console.error('Error playing suggested response audio:', error);
        this.currentAudio = null;
      }
    }
  }

  /**
   * Play TTS for an AI message
   */
  async playMessageTTS(message: ChatMessage) {
    if (message.isGeneratingAudio) return;
    
    // Stop any currently playing audio first
    this.stopCurrentAudio();
    
    try {
      message.isGeneratingAudio = true;
      
      // Determine the language from the user's preference
      const currentUser = localStorage.getItem('currentUser');
      let userLanguage = 'spanish';
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser);
          userLanguage = userData.language_to_learn || 'spanish';
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      
      // Call neural TTS service with OpenAI's high-quality model
      const ttsResponse = await this.http.post<any>(`${environment.apiUrl}/chat/tts`, {
        text: message.content,
        language: userLanguage,
        voice: 'nova', // High-quality neural voice (consistent across app)
        options: {
          rate: 0.75, // Slower for language learning comprehension
          emotion: 'neutral',
          pitch: 'medium',
          neural: true // Explicitly request neural processing
        }
      }).toPromise();

      if (ttsResponse && ttsResponse.success && ttsResponse.audioData) {
        // Create and play audio using the high-quality neural TTS
        const audio = new Audio(`data:audio/wav;base64,${ttsResponse.audioData}`);
        this.currentAudio = audio;
        
        // Set audio properties for better experience
        audio.volume = 0.9;
        audio.preload = 'auto';
        
        // Clear reference when audio ends
        audio.addEventListener('ended', () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
        });
        
        // Play the neural audio
        await audio.play();
        console.log('Neural TTS audio played successfully', {
          voice: ttsResponse.voiceUsed,
          duration: ttsResponse.duration,
          model: ttsResponse.metadata?.model,
          language: userLanguage,
          rate: 0.75
        });
        
      } else {
        throw new Error('Invalid TTS response');
      }
    } catch (error) {
      console.error('Error playing neural TTS:', error);
      
      // Try fallback TTS using Web Speech API
      try {
        await this.playTTSWithWebSpeech(message.content);
        console.log('Using device TTS fallback after neural TTS failure');
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError);
        await this.showErrorToast('Unable to play audio');
      }
    } finally {
      message.isGeneratingAudio = false;
    }
  }

  /**
   * Fallback TTS using Web Speech API
   */
  private async playTTSWithWebSpeech(text: string): Promise<void> {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      // Get user's language preference
      const currentUser = localStorage.getItem('currentUser');
      let userLanguage = 'spanish';
      let speechLang = 'es-ES';
      
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser);
          userLanguage = userData.language_to_learn || 'spanish';
          
          // Map language to speech synthesis locale
          if (userLanguage === 'french') {
            speechLang = 'fr-FR';
          } else {
            speechLang = 'es-ES'; // Default to Spanish
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLang;
      utterance.rate = 0.6; // Slower for language learning
      utterance.pitch = 1;
      utterance.volume = 0.9;
      
      // Try to find the best voice for the user's language
      const voices = speechSynthesis.getVoices();
      let targetVoice = voices.find(voice => 
        voice.lang.startsWith(speechLang.split('-')[0]) && 
        voice.name.toLowerCase().includes('neural')
      );
      
      if (!targetVoice) {
        targetVoice = voices.find(voice => voice.lang.startsWith(speechLang.split('-')[0]));
      }
      
      if (targetVoice) {
        utterance.voice = targetVoice;
        console.log('Using voice:', targetVoice.name, 'for language:', userLanguage);
      }
      
      return new Promise<void>((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);
        speechSynthesis.speak(utterance);
      });
    } else {
      throw new Error('Speech synthesis not supported');
    }
  }

  /**
   * Repeat TTS playback
   */
  async repeatMessageTTS(message: ChatMessage) {
    await this.playMessageTTS(message);
  }

  /**
   * Open learning modal for a message
   */
  openLearningModal(message: ChatMessage) {
    this.selectedMessageForLearning = message;
    this.showLearningModal = true;
  }

  /**
   * Close learning modal
   */
  closeLearningModal() {
    this.showLearningModal = false;
    this.selectedMessageForLearning = undefined;
    this.stopPracticeRecording();
  }

  /**
   * Use suggested response from modal
   */
  async useSuggestedResponseFromModal(response: SuggestedResponse) {
    this.closeLearningModal();
    await this.useSuggestedResponse(response);
  }

  /**
   * Start practice recording in modal
   */
  async startPracticeRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.practiceMediaRecorder = new MediaRecorder(stream);
      this.practiceAudioChunks = [];

      this.practiceMediaRecorder.ondataavailable = (event) => {
        this.practiceAudioChunks.push(event.data);
      };

      this.practiceMediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.practiceAudioChunks, { type: 'audio/wav' });
        await this.assessPracticeRecording(audioBlob);
      };

      this.practiceMediaRecorder.start();
      this.isPracticeRecording = true;

    } catch (error) {
      console.error('Error starting practice recording:', error);
      await this.showErrorToast('Could not access microphone');
    }
  }

  /**
   * Stop practice recording
   */
  stopPracticeRecording() {
    if (this.practiceMediaRecorder && this.isPracticeRecording) {
      this.practiceMediaRecorder.stop();
      this.isPracticeRecording = false;
      
      // Stop all tracks to release microphone
      this.practiceMediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Assess practice recording
   */
  async assessPracticeRecording(audioBlob: Blob) {
    if (!this.selectedMessageForLearning) return;

    try {
      // Get the expected text (AI message or selected response)
      const expectedText = this.selectedMessageForLearning.content;
      
      // Assess pronunciation
      const assessment = await this.assessPronunciation(audioBlob, expectedText);
      
      // Show assessment results
      await this.showPronunciationResults(assessment);
      
    } catch (error) {
      console.error('Error assessing practice recording:', error);
      await this.showErrorToast('Failed to assess pronunciation');
    }
  }

  /**
   * Show pronunciation assessment results
   */
  async showPronunciationResults(assessment: PronunciationAssessment) {
    const alert = await this.alertController.create({
      header: 'Pronunciation Assessment',
      subHeader: `Overall Score: ${assessment.overallScore}/100`,
      message: `
        <div style="text-align: left;">
          <p><strong>Accuracy:</strong> ${assessment.accuracyScore}/100</p>
          <p><strong>Fluency:</strong> ${assessment.fluencyScore}/100</p>
          <p><strong>Completeness:</strong> ${assessment.completenessScore}/100</p>
          <br>
          <p><em>${assessment.feedback}</em></p>
        </div>
      `,
      buttons: [
        {
          text: 'Try Again',
          handler: () => {
            this.startPracticeRecording();
          }
        },
        {
          text: 'Continue',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  /**
   * Assess pronunciation of recorded audio
   */
  async assessPronunciation(audioBlob: Blob, expectedText: string): Promise<PronunciationAssessment> {
    try {
      this.isAssessingPronunciation = true;
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const audioData = (reader.result as string).split(',')[1]; // Remove data:audio/wav;base64, prefix
          
          try {
            // Call pronunciation assessment service via chat service
            const assessmentResponse = await this.http.post<any>(`${environment.apiUrl}/chat/pronunciation-assessment`, {
              audioData: audioData,
              expectedText: expectedText,
              language: 'spanish',
              sessionId: this.sessionId
            }).toPromise();

            if (assessmentResponse && assessmentResponse.assessment) {
              resolve(assessmentResponse.assessment as PronunciationAssessment);
            } else {
              resolve(this.createMockAssessment(expectedText));
            }
          } catch (error) {
            console.error('Error assessing pronunciation:', error);
            resolve(this.createMockAssessment(expectedText));
          } finally {
            this.isAssessingPronunciation = false;
          }
        };
        
        reader.onerror = () => {
          this.isAssessingPronunciation = false;
          resolve(this.createMockAssessment(expectedText));
        };
        
        reader.readAsDataURL(audioBlob);
      });
    } catch (error) {
      console.error('Error processing audio for assessment:', error);
      this.isAssessingPronunciation = false;
      return this.createMockAssessment(expectedText);
    }
  }

  /**
   * Create a mock assessment for fallback
   */
  private createMockAssessment(text: string): PronunciationAssessment {
    return {
      overallScore: 75,
      accuracyScore: 80,
      fluencyScore: 70,
      completenessScore: 75,
      feedback: 'Good pronunciation! Keep practicing to improve fluency.',
      wordScores: text.split(' ').map(word => ({
        word,
        accuracyScore: Math.floor(Math.random() * 20) + 70
      }))
    };
  }

  /**
   * Get CSS class for pronunciation score color coding
   */
  getPronunciationScoreClass(score: number): string {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-fair';
    return 'score-poor';
  }

  /**
   * Generate translation for text
   */
  private async generateTranslation(text: string): Promise<string> {
    // For now, use enhanced fallback until translation service is working
    const fallbackTranslation = this.getFallbackTranslation(text);
    
    // Always return a translation, never undefined
    if (fallbackTranslation && fallbackTranslation !== 'Translation not available') {
      console.log('Using fallback translation:', fallbackTranslation);
      return fallbackTranslation;
    }

    // Try the API translation service
    try {
      const translationResponse = await this.http.post<any>(`${environment.apiUrl}/learning/translate`, {
        text: text,
        from: 'es',
        to: 'en'
      }).toPromise();
      
      if (translationResponse && translationResponse.translation) {
        console.log('Using API translation:', translationResponse.translation);
        return translationResponse.translation;
      }
    } catch (error) {
      console.error('Error calling translation API:', error);
    }
    
    // Final fallback - always return something useful
    return `English: ${text} (Translation service unavailable)`;
  }

  /**
   * Get fallback translation (simple mapping for common phrases)
   */
  private getFallbackTranslation(text: string): string {
    const commonTranslations: { [key: string]: string } = {
      // Full sentences/phrases
      '¡Hola! Me alegro de conocerte. Soy Ana y vamos a tener una conversación en español. ¿Qué te gusta hacer en tu tiempo libre?': 
        'Hello! Nice to meet you. I am Ana and we are going to have a conversation in Spanish. What do you like to do in your free time?',
      '¡Hola! Me alegro de conocerte': 'Hello! Nice to meet you',
      'Soy Ana y vamos a tener una conversación en español': 'I am Ana and we are going to have a conversation in Spanish',
      '¿Qué te gusta hacer en tu tiempo libre?': 'What do you like to do in your free time?',
      
      // Individual components
      '¡Hola!': 'Hello!',
      'Me alegro de conocerte': 'Nice to meet you',
      '¿Qué te gusta hacer?': 'What do you like to do?',
      'en tu tiempo libre': 'in your free time',
      'Soy Ana': 'I am Ana',
      'vamos a tener una conversación': 'we are going to have a conversation',
      'en español': 'in Spanish',
      '¿Cómo estás?': 'How are you?',
      '¿De dónde eres?': 'Where are you from?',
      'Me gusta mucho': 'I like it a lot',
      'Muy bien, gracias': 'Very good, thank you',
      'No entiendo': 'I don\'t understand',
      '¿Puedes repetir?': 'Can you repeat?',
      'Eso es interesante': 'That\'s interesting',
      'Cuéntame más': 'Tell me more'
    };
    
    // Check for exact matches first (prioritize full sentences)
    if (commonTranslations[text]) {
      return commonTranslations[text];
    }
    
    // Try to find the longest matching phrase
    let bestMatch = '';
    let bestTranslation = '';
    
    for (const [spanish, english] of Object.entries(commonTranslations)) {
      if (text.includes(spanish) && spanish.length > bestMatch.length) {
        bestMatch = spanish;
        bestTranslation = english;
      }
    }
    
    if (bestTranslation) {
      return bestTranslation;
    }
    
    // Default message that indicates translation is needed
    return `English: [Translation for "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"]`;
  }

  /**
   * Get the latest AI message with suggested responses
   */
  getLatestAiMessage(): ChatMessage | undefined {
    // Find the most recent AI message
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (!this.messages[i].isUser) {
        return this.messages[i];
      }
    }
    return undefined;
  }

  /**
   * Toggle translation visibility for a message
   */
  toggleTranslation(message: ChatMessage) {
    message.showTranslation = !message.showTranslation;
  }

  /**
   * Toggle side-by-side translation view
   */
  toggleSideBySide(message: ChatMessage) {
    message.showSideBySide = !message.showSideBySide;
  }

  /**
   * Select a suggested response for practice
   */
  async selectSuggestedResponse(response: SuggestedResponse) {
    // Play the audio first so user can hear how to pronounce it
    this.playSuggestedResponseAudio(response);
    
    // Store the selected response for recording practice
    this.selectedResponseForPractice = response;
    
    // Show a toast to guide the user
    const toast = await this.toastController.create({
      message: 'Listen to the pronunciation, then hold the mic button to practice saying it!',
      duration: 3000,
      color: 'primary',
      position: 'top'
    });
    await toast.present();
  }

  /**
   * TrackBy function for messages to prevent duplicate rendering
   */
  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  /**
   * Initialize daily tracking for voice chats and token earning
   */
  async initializeDailyTracking() {
    try {
      // Get today's date string
      const today = new Date().toISOString().split('T')[0];
      
      // Load daily completion data from localStorage
      const savedCompletion = localStorage.getItem(`dailyVoiceCompletion_${today}`);
      
      if (savedCompletion) {
        this.dailyCompletion = JSON.parse(savedCompletion);
        this.currentDailyVoiceCount = this.dailyCompletion?.messagesCompleted || 0;
        this.currentPaidVoiceCount = this.dailyCompletion?.paidMessagesCount || 0;
        this.sessionTokensUsed = this.dailyCompletion?.sessionTokensSpent || 0;
        this.hasEarnedDailyToken = this.dailyCompletion?.isCompleted || false;
        this.hasEarnedExtendedSessionBonus = (this.dailyCompletion?.extendedSessionBonus || 0) > 0;
      } else {
        // Initialize new daily completion
        this.dailyCompletion = {
          date: today,
          messagesCompleted: 0,
          targetMessages: this.dailyFreeVoiceLimit,
          tokensEarned: 0,
          wordsExtracted: [],
          isCompleted: false,
          paidMessagesCount: 0,
          sessionTokensSpent: 0
        };
        this.saveDailyCompletion();
      }
      
      console.log('Daily voice tracking initialized:', this.dailyCompletion);
    } catch (error) {
      console.error('Error initializing daily tracking:', error);
    }
  }

  /**
   * Save daily completion to localStorage
   */
  private saveDailyCompletion() {
    if (this.dailyCompletion) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`dailyVoiceCompletion_${today}`, JSON.stringify(this.dailyCompletion));
    }
  }

  /**
   * Check if user has completed daily voice chat allowance and award token
   */
  async checkDailyVoiceCompletion() {
    if (!this.dailyCompletion || this.hasEarnedDailyToken) {
      return;
    }

    // Check if user has used all free voice messages
    if (this.currentDailyVoiceCount >= this.dailyFreeVoiceLimit) {
      try {
        // Award daily voice chat completion token
        await this.awardDailyVoiceCompletionToken();
        
        // Extract words from chat messages for quiz generation
        await this.extractQuizWordsFromChat();
        
        // Mark as completed
        this.dailyCompletion.isCompleted = true;
        this.dailyCompletion.tokensEarned = 1;
        this.hasEarnedDailyToken = true;
        
        this.saveDailyCompletion();
        
        console.log('Daily voice completion achieved!');
      } catch (error) {
        console.error('Error awarding daily voice completion token:', error);
      }
    }
  }

  /**
   * Award daily voice chat completion token
   */
  async awardDailyVoiceCompletionToken() {
    try {
      const walletAddress = this.getCurrentUserWalletAddress();
      if (!walletAddress) {
        console.warn('No wallet address available for token reward');
        return;
      }

      // Submit daily completion progress for batched blockchain recording
      const userId = this.getCurrentUserId();
      const sessionData = {
        voiceMessagesUsed: this.currentDailyVoiceCount,
        paidVoiceMessagesUsed: this.currentPaidVoiceCount,
        startTime: this.sessionStartTime?.getTime() || Date.now() - 3600000, // 1 hour ago default
      };

      const success = await this.progressService.submitAIChatDailyCompletion(userId, sessionData);
      
      if (success) {
        const toast = await this.toastController.create({
          message: `🎉 Daily voice chat completed! You earned 1 YAP token! (Will be processed in next batch)`,
          duration: 4000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
        
        console.log('Daily voice completion progress submitted for batching');
      } else {
        throw new Error('Failed to submit daily completion progress');
      }
    } catch (error) {
      console.error('Error submitting daily voice completion progress:', error);
      
      // Show user-friendly error message
      const toast = await this.toastController.create({
        message: '⚠️ Unable to submit progress. Your tokens will be awarded when connection is restored.',
        duration: 3000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();
    }
  }

  /**
   * Check for extended session bonus (10+ paid voice messages = 10 token bonus!)
   */
  async checkExtendedSessionBonus() {
    if (this.hasEarnedExtendedSessionBonus || this.currentPaidVoiceCount < 10) {
      return;
    }

    try {
      const walletAddress = this.getCurrentUserWalletAddress();
      if (!walletAddress) {
        console.warn('No wallet address available for extended session bonus');
        return;
      }

      // Submit mega bonus progress for batched blockchain recording
      const bonusAmount = 10;
      const userId = this.getCurrentUserId();
      const sessionData = {
        voiceMessagesUsed: this.currentDailyVoiceCount,
        paidVoiceMessagesUsed: this.currentPaidVoiceCount,
        startTime: this.sessionStartTime?.getTime() || Date.now() - 3600000,
      };

      const success = await this.progressService.submitAIChatMegaBonus(userId, sessionData);
      
      if (success) {
        this.hasEarnedExtendedSessionBonus = true;
        
        // Update daily completion tracking
        if (this.dailyCompletion) {
          this.dailyCompletion.extendedSessionBonus = bonusAmount;
          this.saveDailyCompletion();
        }
        
        const alert = await this.alertController.create({
          header: '🎉 MEGA BONUS UNLOCKED!',
          message: `
            <div style="text-align: center;">
              <h3 style="color: #4CAF50; margin: 10px 0;">Congratulations!</h3>
              <p style="font-size: 18px; margin: 15px 0;">
                <strong>You earned ${bonusAmount} YAP tokens!</strong>
              </p>
              <p style="margin: 10px 0;">
                🎯 Extended Session Bonus achieved!<br>
                💰 You spent ~20 tokens and got 10 back!<br>
                🌟 That's 50% cashback for your dedication!
              </p>
              <p style="font-style: italic; color: #666; margin-top: 15px;">
                Keep up the amazing conversation practice!<br>
                <em>Tokens will be awarded in the next batch processing.</em>
              </p>
            </div>
          `,
          buttons: [
            {
              text: '¡Excelente!',
              handler: () => {
                // Optional: trigger celebration animation or sound
              }
            }
          ]
        });
        await alert.present();
        
        console.log('Extended session mega bonus progress submitted for batching');
      } else {
        throw new Error('Failed to submit mega bonus progress');
      }
    } catch (error) {
      console.error('Error submitting extended session bonus progress:', error);
      
      // Show user-friendly error message
      const toast = await this.toastController.create({
        message: '⚠️ Unable to submit mega bonus progress. Your tokens will be awarded when connection is restored.',
        duration: 3000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();
    }
  }

  /**
   * Extract quiz-worthy words from chat messages
   */
  async extractQuizWordsFromChat() {
    try {
      // Get all Spanish words from AI messages (excluding user messages)
      const aiMessages = this.messages.filter(msg => !msg.isUser);
      const allText = aiMessages.map(msg => msg.content).join(' ');
      
      // Extract meaningful words for quiz generation
      const words = this.extractMeaningfulWords(allText);
      
      // Add to daily completion
      if (this.dailyCompletion) {
        this.dailyCompletion.wordsExtracted = words;
        this.saveDailyCompletion();
      }
      
      this.extractedChatWords = words;
      console.log('Extracted chat words for quiz generation:', words);
    } catch (error) {
      console.error('Error extracting chat words:', error);
    }
  }

  /**
   * Extract meaningful words from text for quiz generation
   */
  private extractMeaningfulWords(text: string): ChatWordAnalysis[] {
    // Remove punctuation and split into words
    const words = text.toLowerCase()
      .replace(/[.,¡!¿?;:()"""'']/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Common Spanish words to exclude (articles, prepositions, etc.)
    const fillerWords = [
      'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'en', 'con', 'por', 'para', 'que', 'se', 'es', 'me', 'te', 'le', 'nos', 'os', 'les', 'y', 'o', 'pero', 'si', 'no', 'muy', 'más', 'tan', 'como', 'cuando', 'donde', 'quien', 'cual', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'mi', 'tu', 'su', 'nuestro', 'vuestro', 'mio', 'tuyo', 'suyo', 'nuestros', 'vuestros', 'toda', 'todo', 'todos', 'todas', 'algún', 'alguna', 'algunos', 'algunas', 'ningún', 'ninguna', 'ningunos', 'ningunas'
    ];

    // Filter out filler words and get unique meaningful words
    const meaningfulWords = [...new Set(words)]
      .filter(word => !fillerWords.includes(word))
      .slice(0, 15); // Limit to 15 words

    return meaningfulWords.map(word => ({
      word,
      isQuizWorthy: true,
      difficulty: this.determineDifficulty(word),
      frequency: words.filter(w => w === word).length,
      partOfSpeech: this.guessPartOfSpeech(word),
      translation: undefined // Will be generated later
    }));
  }

  /**
   * Determine difficulty level of a word
   */
  private determineDifficulty(word: string): 'easy' | 'medium' | 'hard' {
    // Simple heuristics for difficulty
    if (word.length <= 4) return 'easy';
    if (word.length <= 7) return 'medium';
    return 'hard';
  }

  /**
   * Guess part of speech (simple heuristics)
   */
  private guessPartOfSpeech(word: string): 'noun' | 'verb' | 'adjective' | 'adverb' | 'other' {
    // Simple Spanish word ending patterns
    if (word.endsWith('ar') || word.endsWith('er') || word.endsWith('ir')) return 'verb';
    if (word.endsWith('mente')) return 'adverb';
    if (word.endsWith('oso') || word.endsWith('osa') || word.endsWith('ivo') || word.endsWith('iva')) return 'adjective';
    return 'noun'; // Default to noun
  }

  /**
   * Get current user wallet address
   */
  private getCurrentUserWalletAddress(): string | null {
    // This would typically come from a wallet service
    // For now, return a placeholder or get from local storage
    return localStorage.getItem('walletAddress') || null;
  }

  /**
   * Get current voice chat statistics for UI display
   */
  getVoiceChatStats() {
    return {
      freeMessagesUsed: this.currentDailyVoiceCount,
      freeMessagesLimit: this.dailyFreeVoiceLimit,
      paidMessagesUsed: this.currentPaidVoiceCount,
      hasEarnedDailyToken: this.hasEarnedDailyToken,
      canEarnExtendedBonus: this.currentPaidVoiceCount >= 10 && !this.hasEarnedExtendedSessionBonus,
      extendedBonusProgress: this.currentPaidVoiceCount < 10 ? this.currentPaidVoiceCount : 10,
      extendedBonusTarget: 10,
      extendedBonusAmount: 10, // Show the enticing 10 token bonus
      extractedWords: this.extractedChatWords.length,
      hasEarnedExtendedBonus: this.hasEarnedExtendedSessionBonus
    };
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
   * Get today's extracted chat words for quiz generation
   * This should be called by the quiz system
   */
  static getTodaysChatWords(): ChatWordAnalysis[] {
    try {
      const today = new Date().toISOString().split('T')[0];
      const savedCompletion = localStorage.getItem(`dailyVoiceCompletion_${today}`);
      
      if (savedCompletion) {
        const completion: DailyChatCompletion = JSON.parse(savedCompletion);
        return completion.wordsExtracted || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting today\'s chat words:', error);
      return [];
    }
  }

  /**
   * Check if user has completed voice chat requirement for quiz access
   */
  static hasCompletedVoiceChatToday(): boolean {
    try {
      const today = new Date().toISOString().split('T')[0];
      const savedCompletion = localStorage.getItem(`dailyVoiceCompletion_${today}`);
      
      if (savedCompletion) {
        const completion: DailyChatCompletion = JSON.parse(savedCompletion);
        return completion.isCompleted || false;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking voice chat completion:', error);
      return false;
    }
  }

  /**
   * Clear old daily completions (cleanup method)
   */
  static clearOldCompletions() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('dailyVoiceCompletion_') && !key.includes(today)
      );
      
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keys.length} old voice completion records`);
    } catch (error) {
      console.error('Error clearing old completions:', error);
    }
  }

  /**
   * Show mega bonus progress notification when user starts paying
   */
  async showMegaBonusProgress() {
    if (this.hasEarnedExtendedSessionBonus) return;
    
    const remainingForBonus = Math.max(0, 10 - this.currentPaidVoiceCount);
    
    // Show progress notifications at certain milestones
    const shouldShowProgress = [9, 7, 5, 3, 1].includes(remainingForBonus);
    
    if (shouldShowProgress) {
      const toast = await this.toastController.create({
        message: remainingForBonus === 1 
          ? `🔥 Just 1 more paid message for your 10 token MEGA BONUS!`
          : `🎯 ${remainingForBonus} more paid messages = 10 token MEGA BONUS! (50% cashback)`,
        duration: remainingForBonus === 1 ? 5000 : 3500,
        color: remainingForBonus <= 3 ? 'warning' : 'primary',
        position: 'top',
        buttons: [
          {
            text: 'Got it!',
            role: 'cancel'
          }
        ]
      });
      await toast.present();
    }
  }

  /**
   * Record individual free voice chat progress for blockchain batching
   */
  async recordFreeVoiceChatProgress(userId: string, messageNumber: number): Promise<void> {
    try {
      const sessionData = {
        startTime: this.sessionStartTime?.getTime() || Date.now() - 600000, // 10 minutes ago default
      };

      const success = await this.progressService.submitFreeVoiceChatMessage(userId, messageNumber, sessionData);
      
      if (success) {
        console.log(`Free voice chat progress recorded: message ${messageNumber}/4`);
      } else {
        console.warn(`Failed to record free voice chat progress for message ${messageNumber}`);
      }
    } catch (error) {
      console.error(`Error recording free voice chat progress for message ${messageNumber}:`, error);
      // Don't throw - we don't want to interrupt the user's chat experience
    }
  }

  /**
   * Record individual paid voice chat progress for blockchain batching
   */
  async recordPaidVoiceChatProgress(userId: string, paidMessageNumber: number): Promise<void> {
    try {
      const sessionData = {
        startTime: this.sessionStartTime?.getTime() || Date.now() - 600000,
        totalVoiceMessages: this.currentDailyVoiceCount + paidMessageNumber,
        tokensSpentThisSession: this.sessionTokensUsed,
      };

      const success = await this.progressService.submitPaidVoiceChatMessage(userId, paidMessageNumber, sessionData);
      
      if (success) {
        console.log(`Paid voice chat progress recorded: paid message ${paidMessageNumber}`);
      } else {
        console.warn(`Failed to record paid voice chat progress for message ${paidMessageNumber}`);
      }
    } catch (error) {
      console.error(`Error recording paid voice chat progress for message ${paidMessageNumber}:`, error);
      // Don't throw - we don't want to interrupt the user's chat experience
    }
  }

  /**
   * Toggle suggestions drawer
   */
  toggleSuggestionsDrawer() {
    this.showSuggestionsDrawer = !this.showSuggestionsDrawer;
  }

  /**
   * Close suggestions drawer
   */
  closeSuggestionsDrawer() {
    this.showSuggestionsDrawer = false;
  }

  /**
   * Open suggestions drawer
   */
  openSuggestionsDrawer() {
    this.showSuggestionsDrawer = true;
  }
}
