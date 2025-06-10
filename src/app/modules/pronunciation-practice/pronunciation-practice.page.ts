import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { LearningService, VocabItem } from '../../core/learning/learning.service';
import { VoiceService, PronunciationResult, WordAnalysis, PronunciationMetrics, CEFRFeedback } from '../../core/voice/voice.service';

interface Phrase {
  phrase: string;
  translation: string;
  level: string;
  language: string;
}

@Component({
  selector: 'app-pronunciation-practice',
  templateUrl: './pronunciation-practice.page.html',
  styleUrls: ['./pronunciation-practice.page.scss'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(-20px)', opacity: 0 }))
      ])
    ])
  ]
})
export class PronunciationPracticePage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  userLanguage: string = 'spanish';
  currentLevel: string = 'A1.1';
  lessonNumber: number = 1;
  phrases: Phrase[] = [];
  currentPhraseIndex: number = 0;
  totalPhrases: number = 0;
  isLoading: boolean = true;
  isRecording: boolean = false;
  isProcessing: boolean = false;
  phraseCompleted: boolean = false;
  pronunciationScore: number = 0;
  showSuccess: boolean = false;
  showAssessment: boolean = false;
  pronunciationResult: PronunciationResult | null = null;
  
  constructor(
    private router: Router,
    private learningService: LearningService,
    private voiceService: VoiceService
  ) {}

  ngOnInit() {
    this.loadUserLanguageAndPhrases();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUserLanguageAndPhrases() {
    this.isLoading = true;
    
    // Get user's target language from their profile (fallback to Spanish)
    this.userLanguage = 'spanish'; // TODO: Get from user profile service
    
    // Map language names to language codes for API calls
    const languageCode = this.mapLanguageToCode(this.userLanguage);
    
    // Load CEFR-based phrases from lessons instead of individual vocabulary
    this.loadPhrasesFromLessons(languageCode);
  }

  private loadPhrasesFromLessons(languageCode: string) {
    // Load lessons for the user's language and level
    this.learningService.getLessonsByLanguageAndLevel(this.userLanguage, this.currentLevel)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lessons: any[]) => {
          this.extractPhrasesFromLessons(lessons, languageCode);
        },
        error: (error) => {
          console.error('Error loading lessons:', error);
          // Fallback to mock data based on user's language
          this.loadMockPhrasesForLanguage(languageCode);
        }
      });
  }

  private extractPhrasesFromLessons(lessons: any[], languageCode: string) {
    const phrases: Phrase[] = [];
    
    // Extract conversational phrases from lessons
    lessons.forEach(lesson => {
      if (lesson.new_vocabulary) {
        lesson.new_vocabulary.forEach((vocab: any) => {
          // Only include multi-word phrases (not single words)
          if (vocab.term && vocab.term.includes(' ')) {
            phrases.push({
              phrase: vocab.term,
              translation: vocab.translation || 'Practice pronunciation',
              level: lesson.level || this.currentLevel,
              language: languageCode
            });
          }
        });
      }
      
      // Also extract from speaking exercises
      if (lesson.speaking_exercises) {
        lesson.speaking_exercises.forEach((exercise: any) => {
          if (exercise.items) {
            exercise.items.forEach((item: any) => {
              if (item.example_answer && item.example_answer.includes(' ')) {
                phrases.push({
                  phrase: item.example_answer.replace(/\[.*?\]/g, 'Alex'), // Replace placeholders with example name
                  translation: 'Practice conversation phrase',
                  level: lesson.level || this.currentLevel,
                  language: languageCode
                });
              }
            });
          }
        });
      }
    });
    
    // Set the phrases or use fallback
    if (phrases.length > 0) {
      this.phrases = phrases.slice(0, 8); // Limit to 8 phrases for practice session
      this.totalPhrases = this.phrases.length;
      console.log(`Loaded ${this.phrases.length} CEFR phrases for ${this.userLanguage}`);
    } else {
      this.loadMockPhrasesForLanguage(languageCode);
    }
    
    this.isLoading = false;
  }

  private loadMockPhrasesForLanguage(languageCode: string) {
    // Fallback CEFR-appropriate phrases based on language
    const mockPhrases: Record<string, Phrase[]> = {
      'spanish': [
        {
          phrase: 'Me gusta aprender idiomas nuevos',
          translation: 'I like to learn new languages',
          level: 'A1.1',
          language: 'es-ES'
        },
        {
          phrase: 'Hola, ¿cómo estás?',
          translation: 'Hello, how are you?',
          level: 'A1.1',
          language: 'es-ES'
        },
        {
          phrase: '¿De dónde eres?',
          translation: 'Where are you from?',
          level: 'A1.1',
          language: 'es-ES'
        },
        {
          phrase: 'Mucho gusto en conocerte',
          translation: 'Nice to meet you',
          level: 'A1.1',
          language: 'es-ES'
        }
      ],
      'french': [
        {
          phrase: 'Bonjour, comment allez-vous?',
          translation: 'Hello, how are you?',
          level: 'A1.1',
          language: 'fr-FR'
        },
        {
          phrase: 'Je m\'appelle Alex',
          translation: 'My name is Alex',
          level: 'A1.1',
          language: 'fr-FR'
        },
        {
          phrase: 'Enchanté de vous rencontrer',
          translation: 'Nice to meet you',
          level: 'A1.1',
          language: 'fr-FR'
        }
      ],
      'german': [
        {
          phrase: 'Hallo, wie geht es dir?',
          translation: 'Hello, how are you?',
          level: 'A1.1',
          language: 'de-DE'
        },
        {
          phrase: 'Ich heiße Alex',
          translation: 'My name is Alex',
          level: 'A1.1',
          language: 'de-DE'
        },
        {
          phrase: 'Freut mich, dich kennenzulernen',
          translation: 'Nice to meet you',
          level: 'A1.1',
          language: 'de-DE'
        }
      ],
      'italian': [
        {
          phrase: 'Ciao, come stai?',
          translation: 'Hello, how are you?',
          level: 'A1.1',
          language: 'it-IT'
        },
        {
          phrase: 'Mi chiamo Alex',
          translation: 'My name is Alex',
          level: 'A1.1',
          language: 'it-IT'
        },
        {
          phrase: 'Piacere di conoscerti',
          translation: 'Nice to meet you',
          level: 'A1.1',
          language: 'it-IT'
        }
      ]
    };
    
    const fallbackLanguage = this.userLanguage === 'spanish' ? 'spanish' : 'spanish';
    this.phrases = mockPhrases[this.userLanguage] || mockPhrases[fallbackLanguage];
    this.totalPhrases = this.phrases.length;
    
    console.log(`Using fallback phrases for ${this.userLanguage}:`, this.phrases);
    this.isLoading = false;
  }

  private mapLanguageToCode(language: string): string {
    const languageMap: { [key: string]: string } = {
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'german': 'de-DE',
      'italian': 'it-IT',
      'portuguese': 'pt-PT',
      'chinese': 'zh-CN',
      'japanese': 'ja-JP',
      'korean': 'ko-KR'
    };
    
    return languageMap[language.toLowerCase()] || 'es-ES';
  }

  get currentPhrase(): Phrase | null {
    if (this.currentPhraseIndex < this.phrases.length) {
      return this.phrases[this.currentPhraseIndex];
    }
    return null;
  }

  get progressPercentage(): number {
    if (this.totalPhrases === 0) return 0;
    return Math.round(((this.currentPhraseIndex + 1) / this.totalPhrases) * 100);
  }

  playPhrase() {
    if (this.currentPhrase) {
      this.voiceService.speak(this.currentPhrase.phrase, this.currentPhrase.language)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log('TTS started successfully');
          },
          error: (error) => {
            console.error('Error playing phrase:', error);
          }
        });
    }
  }

  playWordByWord() {
    if (this.currentPhrase) {
      const words = this.currentPhrase.phrase.split(' ');
      let currentWordIndex = 0;
      
      const playNextWord = () => {
        if (currentWordIndex < words.length) {
          const word = words[currentWordIndex].trim();
          this.voiceService.speak(word, this.currentPhrase!.language)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                // Wait a bit before next word
                setTimeout(() => {
                  currentWordIndex++;
                  playNextWord();
                }, 800);
              },
              error: (error) => {
                console.error('Error playing word:', error);
              }
            });
        }
      };
      
      playNextWord();
    }
  }

  nextPhrase() {
    if (this.currentPhraseIndex < this.phrases.length - 1) {
      this.currentPhraseIndex++;
      this.resetPhraseState();
    } else {
      // Lesson completed
      this.onLessonComplete();
    }
  }

  previousPhrase() {
    if (this.currentPhraseIndex > 0) {
      this.currentPhraseIndex--;
      this.resetPhraseState();
    }
  }

  private resetPhraseState() {
    this.phraseCompleted = false;
    this.pronunciationScore = 0;
    this.showSuccess = false;
    this.showAssessment = false;
    this.pronunciationResult = null;
    this.isProcessing = false;
  }

  private onLessonComplete() {
    // Handle lesson completion - could navigate to results or next lesson
    console.log('Lesson completed!');
    // For now, navigate back to dashboard
    this.router.navigate(['/dashboard']);
  }

  startRecording() {
    this.isRecording = true;
    this.voiceService.startRecording()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Recording started');
        },
        error: (error) => {
          console.error('Error starting recording:', error);
          this.isRecording = false;
        }
      });
  }

  stopRecording() {
    if (this.isRecording) {
      this.voiceService.stopRecording();
      this.isRecording = false;
      this.isProcessing = true;
      
      // Verify pronunciation and auto-advance if successful
      if (this.currentPhrase) {
        this.voiceService.verifyPronunciation(this.currentPhrase.phrase)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result: PronunciationResult) => {
              this.isProcessing = false;
              this.pronunciationScore = result.score;
              this.pronunciationResult = result;
              
              if (result.pass) {
                // Mark phrase as completed and show detailed assessment
                this.phraseCompleted = true;
                this.showAssessment = true;
              } else {
                // Show assessment for improvement feedback
                this.showAssessment = true;
                this.phraseCompleted = false;
                console.log('Pronunciation needs improvement. Score:', result.score);
              }
            },
            error: (error) => {
              this.isProcessing = false;
              console.error('Error verifying pronunciation:', error);
            }
          });
      }
    }
  }

  goBack() {
    // If assessment is open, close it instead of navigating away
    if (this.showAssessment) {
      this.closeAssessment();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  getRecordingStatusText(): string {
    if (this.phraseCompleted) {
      return 'Phrase completed! Moving to next...';
    }
    if (this.isProcessing) {
      return 'Analyzing pronunciation...';
    }
    if (this.isRecording) {
      return 'Recording in progress...';
    }
    return 'Tap to start recording';
  }

  closeAssessment() {
    this.showAssessment = false;
    if (this.phraseCompleted) {
      // Auto-advance to next phrase after closing assessment
      setTimeout(() => {
        this.nextPhrase();
      }, 300);
    }
  }

  continueToNext() {
    this.showAssessment = false;
    if (this.phraseCompleted) {
      this.nextPhrase();
    }
  }

  tryAgain() {
    this.showAssessment = false;
    // Reset for another attempt
    this.phraseCompleted = false;
    this.pronunciationResult = null;
  }

  playUserRecording() {
    // If we had actual audio data, we would play it here
    // For now, just provide feedback
    console.log('Would play user recording');
  }

  playExpectedAudio() {
    if (this.currentPhrase) {
      this.playPhrase();
    }
  }

  getWordAnalysisClass(word: WordAnalysis): string {
    return word.is_correct ? 'word-correct' : 'word-incorrect';
  }

  getScoreColor(score: number): string {
    if (score >= 90) return '#4CAF50'; // Green
    if (score >= 80) return '#FF9800'; // Orange
    if (score >= 70) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  }

  getScoreIcon(score: number): string {
    if (score >= 90) return 'checkmark-circle';
    if (score >= 80) return 'checkmark-circle-outline';
    if (score >= 70) return 'warning';
    return 'close-circle';
  }

  loadPhrases() {
    this.loadUserLanguageAndPhrases();
  }
}