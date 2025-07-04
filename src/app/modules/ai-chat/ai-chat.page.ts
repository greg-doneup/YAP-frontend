import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TokenService, TokenSpendingRequest } from '../../services/token.service';
import { AudioService, AudioTrack } from '../../services/audio.service';
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
  isSessionInitialized = false;  // Add guard to prevent duplicate session initialization
  
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

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private http: HttpClient,
    private tokenService: TokenService,
    private audioService: AudioService,
    private toastController: ToastController,
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.initializeChat();
    // Welcome message is now handled by the backend initial AI message
    // this.addWelcomeMessage();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.disconnectWebSocket();
    this.audioService.dispose(); // Clean up audio resources
  }

  ionViewWillEnter() {
    // Reconnect when user returns to this page, but only if not already initialized
    if (!this.isConnected && !this.isSessionInitialized) {
      console.log('Reconnecting to AI chat service...');
      this.initializeChat();
    }
  }

  /**
   * Initialize chat session and check allowances, then token balance
   */
  async initializeChat() {
    // Prevent duplicate initialization
    if (this.isSessionInitialized) {
      console.log('Chat already initialized, skipping...');
      return;
    }

    try {
      // First check if user has free allowances for AI chat
      const allowanceCheck = await this.tokenService.canUseFeature('ai-chat').toPromise();
      
      if (allowanceCheck?.canUse) {
        console.log('User has free AI chat allowance available');
        await this.connectToAiService();
        this.sessionStartTime = new Date();
        return;
      }

      // No free allowances, check token balance
      const balance = await this.tokenService.getTokenBalance().toPromise();
      if (!balance || balance.balance < 5) {
        await this.showInsufficientTokensWarning();
        this.router.navigate(['/dashboard']);
        return;
      }

      // User has tokens, connect to service
      await this.connectToAiService();
      this.sessionStartTime = new Date();
      
    } catch (error) {
      console.error('Error initializing chat:', error);
      await this.showErrorToast('Failed to initialize chat session');
    }
  }

  /**
   * Add welcome message to chat
   */
  private async addWelcomeMessage() {
    // Check current allowance status
    const allowance = await this.tokenService.getFeatureAllowance('ai-chat').toPromise();
    
    let welcomeContent = 'Hello! I\'m your AI language tutor. You can practice speaking with me by typing or using voice messages.';
    
    if (allowance && allowance.remaining > 0) {
      welcomeContent += ` You have ${allowance.remaining} free messages remaining today. After that, messages will cost 1 token each.`;
    } else {
      welcomeContent += ' Messages cost 1 token each.';
    }

    const welcomeMessage: ChatMessage = {
      id: 'welcome-' + Date.now(),
      content: welcomeContent,
      isUser: false,
      timestamp: new Date()
    };
    this.messages.push(welcomeMessage);
  }

  /**
   * Get current user ID (placeholder implementation)
   */
  private getCurrentUserId(): string {
    // TODO: Replace with actual user ID from authentication service
    // For now, generate a simple session-based ID
    if (!this.userId) {
      this.userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    return this.userId;
  }

  /**
   * Connect to AI chat service (HTTP fallback)
   */
  private async connectToAiService() {
    // Prevent duplicate session initialization
    if (this.isSessionInitialized) {
      console.log('Session already initialized, skipping...');
      return;
    }

    try {
      // Start a new chat session with the AI service
      const sessionResponse = await this.http.post<any>(`${environment.apiUrl}/chat/start-session`, {
        userId: this.getCurrentUserId(),
        language: 'spanish',
        cefrLevel: 'B1',
        conversationMode: 'free' as const
      }).toPromise();

      if (sessionResponse && sessionResponse.success && sessionResponse.session) {
        this.sessionId = sessionResponse.session.sessionId;
        this.userId = this.getCurrentUserId();
        this.isConnected = true;
        console.log('Connected to AI chat service with sessionId:', this.sessionId);
        
        // Add the initial AI message if provided
        if (sessionResponse.session.initialMessage) {
          const initialMessage: ChatMessage = {
            id: 'ai-initial-' + Date.now(),
            content: sessionResponse.session.initialMessage,
            isUser: false,
            timestamp: new Date(),
            translation: sessionResponse.session.initialMessageTranslation,
            showTranslation: true,  // Always show translations for AI messages
            showSideBySide: false   // Default to collapsed side-by-side view
          };
          this.messages.push(initialMessage);
          this.isSessionInitialized = true;  // Mark session as initialized
        }
      } else {
        throw new Error('Failed to get session ID from AI service');
      }
    } catch (error) {
      console.error('Error connecting to AI service:', error);
      throw error;
    }
  }

  /**
   * Disconnect from AI service
   */
  private disconnectWebSocket() {
    this.isConnected = false;
    console.log('Disconnected from AI chat service');
  }

  /**
   * Send text message
   */
  async sendMessage() {
    if (!this.currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      content: this.currentMessage,
      isUser: true,
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    this.currentMessage = '';

    // Spend tokens and send to AI
    await this.processUserMessage(userMessage);
    this.scrollToBottom();
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

    this.messages.push(audioMessage);
    
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

      // First try to use daily allowance
      const allowanceCheck = await this.tokenService.canUseFeature('ai-chat').toPromise();
      
      if (allowanceCheck?.canUse && (allowanceCheck.allowanceRemaining || 0) > 0) {
        // Use free allowance
        const allowanceResult = await this.tokenService.useAllowance('ai-chat', 1).toPromise();
        
        if (allowanceResult?.success) {
          console.log(`Used free allowance for AI chat. Remaining: ${allowanceResult.remaining}`);
          await this.sendToAiService(message);
          return;
        }
      }

      // No free allowances available, try spending tokens
      const spendingRequest: TokenSpendingRequest = {
        featureId: 'ai-chat',
        amount: 1, // 1 token per message
        action: 'chat_message',
        metadata: {
          messageId: message.id,
          messageType: message.isAudio ? 'audio' : 'text'
        }
      };

      const spendingResult = await this.tokenService.spendTokens(spendingRequest).toPromise();
      
      if (!spendingResult?.success) {
        await this.showInsufficientTokensWarning();
        return;
      }

      this.sessionTokensUsed += 1;
      console.log(`Spent 1 token for AI chat. New balance: ${spendingResult.newBalance}`);
      
      await this.sendToAiService(message);

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
    if (response.suggestedResponses && response.suggestedResponses.length > 0) {
      // Backend provides suggested responses as strings, convert to our format
      suggestedResponses = response.suggestedResponses.slice(0, 3).map((suggestion: string, index: number) => ({
        id: 'backend-suggestion-' + Date.now() + '-' + index,
        spanish: suggestion,
        english: '', // Will be generated
        difficulty: 'medium' as const
      }));
      
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

    this.messages.push(aiMessage);
    
    // Handle pronunciation result if this was a voice message
    if (originalMessage?.isAudio && response.pronunciationResult) {
      // Find the user message and add pronunciation assessment
      const userMessage = this.messages.find(msg => msg.id === originalMessage.id);
      if (userMessage) {
        userMessage.pronunciation = {
          overallScore: response.pronunciationResult.overallScore || 85,
          accuracyScore: response.pronunciationResult.accuracyScore || 85,
          fluencyScore: response.pronunciationResult.fluencyScore || 85,
          completenessScore: response.pronunciationResult.completenessScore || 85,
          feedback: response.pronunciationResult.feedback || 'Good pronunciation!',
          wordScores: response.pronunciationResult.wordDetails || []
        };
        console.log('Added pronunciation assessment to user message:', userMessage.pronunciation);
      }
    }
    
    this.scrollToBottom();
  }
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
   * Exit chat session
   */
  async exitChat() {
    this.disconnectWebSocket();
    
    // Show session summary
    const sessionDuration = this.sessionStartTime ? 
      Math.round((Date.now() - this.sessionStartTime.getTime()) / 60000) : 0;

    const toast = await this.toastController.create({
      message: `Chat session ended. Duration: ${sessionDuration} min, Tokens used: ${this.sessionTokensUsed}`,
      duration: 4000,
      color: 'success',
      position: 'top'
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

    this.messages.push(userMessage);
    
    // Process the message
    await this.processUserMessage(userMessage);
    this.scrollToBottom();
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
        voice: 'onyx', // Different voice for suggested responses (male voice)
        options: {
          rate: 0.85, // Slightly slower for learning pronunciation
          emotion: 'friendly'
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
    if (!response.audioUrl) {
      await this.generateSuggestedResponseAudio(response);
    }
    
    if (response.audioUrl) {
      const audio = new Audio(response.audioUrl);
      await audio.play();
    }
  }

  /**
   * Play TTS for an AI message
   */
  async playMessageTTS(message: ChatMessage) {
    if (message.isGeneratingAudio) return;
    
    try {
      message.isGeneratingAudio = true;
      
      // Call neural TTS service with OpenAI's high-quality model
      const ttsResponse = await this.http.post<any>(`${environment.apiUrl}/chat/tts`, {
        text: message.content,
        language: 'spanish',
        voice: 'nova', // High-quality Spanish neural voice
        options: {
          rate: 0.9, // Slightly slower for language learning
          emotion: 'neutral'
        }
      }).toPromise();

      if (ttsResponse && ttsResponse.success && ttsResponse.audioData) {
        // Create and play audio using the high-quality neural TTS
        const audio = new Audio(`data:audio/wav;base64,${ttsResponse.audioData}`);
        
        // Set audio properties for better experience
        audio.volume = 0.8;
        audio.preload = 'auto';
        
        // Play the neural audio
        await audio.play();
        console.log('Neural TTS audio played successfully', {
          voice: ttsResponse.voiceUsed,
          duration: ttsResponse.duration,
          model: ttsResponse.metadata?.model
        });
        
        // Show success feedback (optional, remove to reduce noise)
        // await this.showSuccessToast('Neural voice audio played');
      } else {
        throw new Error('Invalid TTS response');
      }
    } catch (error) {
      console.error('Error playing neural TTS:', error);
      
      // Try fallback TTS using Web Speech API
      try {
        await this.playTTSWithWebSpeech(message.content);
        console.log('Using device TTS fallback after neural TTS failure');
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
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.8;
      utterance.pitch = 1;
      
      // Try to find a Spanish voice
      const voices = speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
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
}
