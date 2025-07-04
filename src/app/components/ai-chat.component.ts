import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { TokenService, DailyAllowance } from '../services/token.service';
import { TokenSpendingModalComponent } from './token-spending-modal.component';
import { Subscription } from 'rxjs';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  audioUrl?: string;
  isProcessing?: boolean;
}

export interface ChatSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  tokensSpent: number;
  isUnlimited: boolean;
}

@Component({
  selector: 'app-ai-chat',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>AI Language Chat</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="toggleChatMode()">
            <ion-icon [name]="isVoiceMode ? 'chatbubble-outline' : 'mic-outline'"></ion-icon>
          </ion-button>
          <ion-button (click)="closeChat()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="chat-content">
      <!-- Usage Banner -->
      <div class="usage-banner" [class.warning]="isNearLimit">
        <div class="usage-info">
          <ion-icon [name]="isVoiceMode ? 'mic' : 'chatbubble'" class="mode-icon"></ion-icon>
          <div class="usage-text">
            <span class="usage-label">
              {{ isVoiceMode ? 'Voice Chat' : 'Text Chat' }}
            </span>
            <span class="usage-details">
              {{ getUsageText() }}
            </span>
          </div>
        </div>
        <ion-button 
          *ngIf="isNearLimit || hasExceededLimit"
          size="small"
          fill="outline"
          color="primary"
          (click)="purchaseMoreTime()">
          <ion-icon name="add" slot="start"></ion-icon>
          Get More
        </ion-button>
      </div>

      <!-- Chat Messages -->
      <div class="messages-container" #messagesContainer>
        <div 
          *ngFor="let message of messages" 
          class="message"
          [class.user-message]="message.isUser"
          [class.ai-message]="!message.isUser">
          
          <div class="message-content">
            <div class="message-bubble">
              <p>{{ message.content }}</p>
              
              <!-- Audio Controls for Voice Messages -->
              <div *ngIf="message.audioUrl" class="audio-controls">
                <ion-button 
                  fill="clear" 
                  size="small"
                  (click)="playAudio(message.audioUrl!)">
                  <ion-icon name="play-outline"></ion-icon>
                </ion-button>
              </div>
              
              <!-- Processing Indicator -->
              <div *ngIf="message.isProcessing" class="processing-indicator">
                <ion-spinner name="dots"></ion-spinner>
                <span>AI is thinking...</span>
              </div>
            </div>
            
            <div class="message-time">
              {{ message.timestamp | date:'short' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Blocked Message -->
      <div *ngIf="hasExceededLimit && !isUnlimited" class="blocked-message">
        <ion-icon name="lock-closed-outline"></ion-icon>
        <h3>Daily limit reached</h3>
        <p>You've used your free {{ isVoiceMode ? 'voice chat time' : 'text messages' }} for today.</p>
        <ion-button (click)="purchaseMoreTime()">
          <ion-icon name="diamond" slot="start"></ion-icon>
          Unlock More
        </ion-button>
      </div>
    </ion-content>

    <!-- Input Footer -->
    <ion-footer *ngIf="!hasExceededLimit || isUnlimited">
      <ion-toolbar class="input-toolbar">
        <!-- Voice Mode Input -->
        <div *ngIf="isVoiceMode" class="voice-input">
          <ion-button
            [color]="isRecording ? 'danger' : 'primary'"
            [fill]="isRecording ? 'solid' : 'outline'"
            size="large"
            shape="round"
            (click)="toggleRecording()"
            [disabled]="isProcessing">
            <ion-icon 
              [name]="isRecording ? 'stop' : 'mic'"
              [class.pulse]="isRecording">
            </ion-icon>
          </ion-button>
          <span class="recording-hint">
            {{ isRecording ? 'Recording... Tap to stop' : 'Tap to speak' }}
          </span>
        </div>

        <!-- Text Mode Input -->
        <div *ngIf="!isVoiceMode" class="text-input">
          <ion-item lines="none">
            <ion-textarea
              #messageInput
              placeholder="Type your message..."
              rows="1"
              auto-grow="true"
              maxlength="500"
              [(ngModel)]="currentMessage"
              (keydown.enter)="sendMessage($event)"
              [disabled]="isProcessing">
            </ion-textarea>
            <ion-button
              slot="end"
              fill="clear"
              [disabled]="!currentMessage.trim() || isProcessing"
              (click)="sendMessage()">
              <ion-icon name="send"></ion-icon>
            </ion-button>
          </ion-item>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .chat-content {
      --padding-top: 0;
      --padding-bottom: 0;
      --padding-start: 0;
      --padding-end: 0;
    }

    .usage-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--ion-color-light);
      border-bottom: 1px solid var(--ion-color-light-shade);
    }

    .usage-banner.warning {
      background: var(--ion-color-warning-tint);
      border-bottom-color: var(--ion-color-warning);
    }

    .usage-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .mode-icon {
      font-size: 20px;
      color: var(--ion-color-primary);
    }

    .usage-text {
      display: flex;
      flex-direction: column;
    }

    .usage-label {
      font-weight: 600;
      font-size: 14px;
      color: var(--ion-color-dark);
    }

    .usage-details {
      font-size: 12px;
      color: var(--ion-color-medium);
    }

    .messages-container {
      padding: 16px;
      min-height: calc(100vh - 200px);
    }

    .message {
      margin-bottom: 16px;
      display: flex;
    }

    .user-message {
      justify-content: flex-end;
    }

    .ai-message {
      justify-content: flex-start;
    }

    .message-content {
      max-width: 80%;
    }

    .message-bubble {
      padding: 12px 16px;
      border-radius: 18px;
      position: relative;
    }

    .user-message .message-bubble {
      background: var(--ion-color-primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .ai-message .message-bubble {
      background: var(--ion-color-light);
      color: var(--ion-color-dark);
      border-bottom-left-radius: 4px;
    }

    .message-bubble p {
      margin: 0;
      line-height: 1.4;
    }

    .audio-controls {
      margin-top: 8px;
      display: flex;
      align-items: center;
    }

    .processing-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.7;
    }

    .message-time {
      font-size: 11px;
      color: var(--ion-color-medium);
      margin-top: 4px;
      text-align: right;
    }

    .ai-message .message-time {
      text-align: left;
    }

    .blocked-message {
      text-align: center;
      padding: 40px 20px;
      color: var(--ion-color-medium);
    }

    .blocked-message ion-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .blocked-message h3 {
      margin: 0 0 8px 0;
      color: var(--ion-color-dark);
    }

    .blocked-message p {
      margin: 0 0 24px 0;
    }

    .input-toolbar {
      --padding-start: 16px;
      --padding-end: 16px;
      --padding-top: 8px;
      --padding-bottom: 8px;
    }

    .voice-input {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 16px 0;
    }

    .recording-hint {
      font-size: 14px;
      color: var(--ion-color-medium);
    }

    .pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    .text-input {
      width: 100%;
    }

    .text-input ion-item {
      --border-radius: 24px;
      --background: var(--ion-color-light);
    }
  `]
})
export class AiChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isVoiceMode = false;
  isRecording = false;
  isProcessing = false;
  isUnlimited = false;
  
  // Usage tracking
  voiceTimeUsed = 0; // minutes
  textMessagesUsed = 0;
  voiceTimeLimit = 15; // 15 minutes free per day
  textMessageLimit = 25; // 25 messages free per day
  
  private currentSession: ChatSession | null = null;
  private subscriptions: Subscription[] = [];
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(
    private modalController: ModalController,
    private tokenService: TokenService,
    private toastController: ToastController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.initializeChat();
    this.trackUsage();
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopRecording();
  }

  private initializeChat() {
    // Create welcome message
    this.messages.push({
      id: 'welcome',
      content: "Hello! I'm your AI language partner. Let's practice together! You can switch between voice and text chat using the button in the header.",
      isUser: false,
      timestamp: new Date()
    });

    // Check for existing unlimited passes
    this.tokenService.unlimitedPasses$.subscribe((passes: any[]) => {
      const chatPass = passes.find((p: any) => 
        p.featureId === 'ai-speech-chat' || p.featureId === 'ai-text-chat'
      );
      this.isUnlimited = chatPass?.isActive || false;
    });
  }

  private trackUsage() {
    this.tokenService.dailyAllowances$.subscribe((allowances: DailyAllowance[]) => {
      const voiceAllowance = allowances.find((a: DailyAllowance) => a.featureId === 'ai-speech-chat');
      const textAllowance = allowances.find((a: DailyAllowance) => a.featureId === 'ai-text-chat');

      if (voiceAllowance) {
        this.voiceTimeUsed = voiceAllowance.used;
        this.voiceTimeLimit = voiceAllowance.dailyLimit;
      }

      if (textAllowance) {
        this.textMessagesUsed = textAllowance.used;
        this.textMessageLimit = textAllowance.dailyLimit;
      }
    });
  }

  get isNearLimit(): boolean {
    if (this.isVoiceMode) {
      return this.voiceTimeUsed >= (this.voiceTimeLimit * 0.8);
    } else {
      return this.textMessagesUsed >= (this.textMessageLimit * 0.8);
    }
  }

  get hasExceededLimit(): boolean {
    if (this.isVoiceMode) {
      return this.voiceTimeUsed >= this.voiceTimeLimit;
    } else {
      return this.textMessagesUsed >= this.textMessageLimit;
    }
  }

  getUsageText(): string {
    if (this.isUnlimited) {
      return 'Unlimited access active';
    }

    if (this.isVoiceMode) {
      const remaining = Math.max(0, this.voiceTimeLimit - this.voiceTimeUsed);
      return `${remaining} minutes remaining today`;
    } else {
      const remaining = Math.max(0, this.textMessageLimit - this.textMessagesUsed);
      return `${remaining} messages remaining today`;
    }
  }

  toggleChatMode() {
    this.isVoiceMode = !this.isVoiceMode;
    this.stopRecording();
  }

  async sendMessage(event?: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent && keyboardEvent.shiftKey !== undefined && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
    } else if (keyboardEvent && keyboardEvent.shiftKey) {
      return; // Allow new line with Shift+Enter
    }

    if (!this.currentMessage.trim() || this.isProcessing) {
      return;
    }

    // Check limits
    if (this.hasExceededLimit && !this.isUnlimited) {
      this.purchaseMoreTime();
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: this.currentMessage.trim(),
      isUser: true,
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    this.currentMessage = '';
    this.isProcessing = true;

    // Create AI processing message
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      content: '',
      isUser: false,
      timestamp: new Date(),
      isProcessing: true
    };
    this.messages.push(aiMessage);

    this.scrollToBottom();

    try {
      // Call AI chat API
      const response = await this.http.post<any>('/ai-chat/text', {
        message: userMessage.content,
        sessionId: this.currentSession?.sessionId
      }).toPromise();

      // Update AI message with response
      const messageIndex = this.messages.findIndex(m => m.id === aiMessage.id);
      if (messageIndex !== -1) {
        this.messages[messageIndex] = {
          ...aiMessage,
          content: response.message,
          isProcessing: false
        };
      }

      // Update usage tracking
      this.textMessagesUsed++;

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update AI message with error
      const messageIndex = this.messages.findIndex(m => m.id === aiMessage.id);
      if (messageIndex !== -1) {
        this.messages[messageIndex] = {
          ...aiMessage,
          content: 'Sorry, I encountered an error. Please try again.',
          isProcessing: false
        };
      }
    } finally {
      this.isProcessing = false;
      this.scrollToBottom();
    }
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start();
      this.isRecording = true;

    } catch (error) {
      console.error('Error starting recording:', error);
      const toast = await this.toastController.create({
        message: 'Could not access microphone. Please check permissions.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
    }
  }

  private async processRecording() {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('sessionId', this.currentSession?.sessionId || '');

    try {
      this.isProcessing = true;
      
      const response = await this.http.post<any>('/ai-chat/voice', formData).toPromise();
      
      // Add user message (transcribed)
      this.messages.push({
        id: Date.now().toString(),
        content: response.transcription,
        isUser: true,
        timestamp: new Date(),
        audioUrl: URL.createObjectURL(audioBlob)
      });

      // Add AI response
      this.messages.push({
        id: (Date.now() + 1).toString(),
        content: response.aiResponse,
        isUser: false,
        timestamp: new Date(),
        audioUrl: response.aiAudioUrl
      });

      this.scrollToBottom();

    } catch (error) {
      console.error('Error processing recording:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async playAudio(audioUrl: string) {
    try {
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async purchaseMoreTime() {
    const modal = await this.modalController.create({
      component: TokenSpendingModalComponent,
      componentProps: {
        data: {
          title: `Unlock More ${this.isVoiceMode ? 'Voice Time' : 'Messages'}`,
          featureId: this.isVoiceMode ? 'ai-speech-chat' : 'ai-text-chat',
          featureName: this.isVoiceMode ? 'AI Voice Chat' : 'AI Text Chat',
          description: this.isVoiceMode ? 
            'Get 15 more minutes of voice chat time' : 
            'Get unlimited messages for 1 hour',
          tokenCost: this.isVoiceMode ? 1 : 2,
          duration: this.isVoiceMode ? '15 minutes' : '1 hour',
          benefits: this.isVoiceMode ? '+15 minutes' : 'Unlimited messages',
          icon: this.isVoiceMode ? 'mic-outline' : 'chatbubble-outline',
          action: 'purchase_time',
          metadata: {
            chatMode: this.isVoiceMode ? 'voice' : 'text'
          }
        }
      }
    });

    modal.onDidDismiss().then((result: any) => {
      if (result.data?.confirmed) {
        // Refresh usage data after successful purchase
        this.tokenService.refreshAllData();
      }
    });

    await modal.present();
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  closeChat() {
    this.modalController.dismiss();
  }
}
