import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { DetailedPronunciationResult, PhonemePronunciationDetail } from '../../core/pronunciation/pronunciation.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-pronunciation-feedback',
  templateUrl: './pronunciation-feedback.component.html',
  styleUrls: ['./pronunciation-feedback.component.scss']
})
export class PronunciationFeedbackComponent implements OnChanges {
  @Input() result: DetailedPronunciationResult | null = null;
  @Input() showDetails = true;
  @Input() languageCode = 'en-US';
  
  @Output() playSample = new EventEmitter<void>();
  @Output() playRecording = new EventEmitter<void>();
  @Output() playPhoneme = new EventEmitter<string>();
  
  visualFeedback: SafeHtml | null = null;
  overallScoreClass: string = 'fair';
  showPhonemeDetails = false;
  phonemeGroups: { [key: string]: PhonemePronunciationDetail[] } = {};
  
  constructor(private sanitizer: DomSanitizer) { }
  
  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['result'] || changes['languageCode']) && this.result) {
      this.processResult();
    }
  }
  
  /**
   * Process pronunciation result for display
   */
  private processResult(): void {
    // Set overall score class
    if (this.result && this.result.score >= 0.8) {
      this.overallScoreClass = 'excellent';
    } else if (this.result && this.result.score >= 0.6) {
      this.overallScoreClass = 'good';
    } else if (this.result && this.result.score >= 0.4) {
      this.overallScoreClass = 'fair';
    } else {
      this.overallScoreClass = 'poor';
    }
    
    // Generate visual feedback HTML
    const htmlFeedback = this.generateVisualFeedback();
    this.visualFeedback = this.sanitizer.bypassSecurityTrustHtml(htmlFeedback);
    
    // Group phonemes by issue type for easier visualization
    this.groupPhonemesByIssue();
  }
  
  /**
   * Generate visual HTML feedback with color coding
   */
  private generateVisualFeedback(): string {
    if (!this.result || !this.result.wordDetails || this.result.wordDetails.length === 0) {
      return this.result?.expected || '';
    }
    
    // Sort word details by time
    const sortedWords = [...this.result.wordDetails].sort((a, b) => a.start_time - b.start_time);
    
    // Generate HTML with color-coded feedback
    return sortedWords.map(word => {
      let colorClass = '';
      let title = `Score: ${Math.round(word.score * 100)}%`;
      
      if (word.score < 0.4) {
        colorClass = 'poor';
      } else if (word.score < 0.6) {
        colorClass = 'fair';
      } else if (word.score < 0.8) {
        colorClass = 'good';
      } else {
        colorClass = 'excellent';
      }
      
      if (word.issues && word.issues.length) {
        title += `\nIssues: ${word.issues.join(', ')}`;
      }
      
      return `<span class="word ${colorClass}" title="${title}" data-word="${word.word}">${word.word}</span>`;
    }).join(' ');
  }
  
  /**
   * Group phonemes by issue type for better visualization
   */
  private groupPhonemesByIssue(): void {
    this.phonemeGroups = {};
    
    if (!this.result || !this.result.phonemeDetails) {
      return;
    }
    
    // Group phonemes by issue type
    this.result.phonemeDetails.forEach(phoneme => {
      if (phoneme.issue && phoneme.score < 0.7) {
        if (!this.phonemeGroups[phoneme.issue]) {
          this.phonemeGroups[phoneme.issue] = [];
        }
        this.phonemeGroups[phoneme.issue].push(phoneme);
      }
    });
  }
  
  /**
   * Toggle phoneme details display
   */
  togglePhonemeDetails(): void {
    this.showPhonemeDetails = !this.showPhonemeDetails;
  }
  
  /**
   * Get a list of issues found in pronunciation
   */
  getIssues(): string[] {
    return Object.keys(this.phonemeGroups);
  }
  
  /**
   * Get phonemes for a specific issue
   */
  getPhonemesByIssue(issue: string): PhonemePronunciationDetail[] {
    return this.phonemeGroups[issue] || [];
  }
  
  /**
   * Format phoneme text with IPA notation
   */
  formatPhoneme(phoneme: string): string {
    // Add IPA formatting if needed
    return `/${phoneme}/`;
  }
  
  /**
   * Play a specific phoneme (emit event to parent)
   */
  onPlayPhoneme(phoneme: string): void {
    this.playPhoneme.emit(phoneme);
  }
  
  /**
   * Handle play sample request
   */
  onPlaySample(): void {
    this.playSample.emit();
  }
  
  /**
   * Handle play recording request
   */
  onPlayRecording(): void {
    this.playRecording.emit();
  }
  
  /**
   * Get feedback tips by issue type
   */
  getFeedbackTips(): string[] {
    if (!this.result?.phonemeDetails || !this.showDetails) {
      return this.result?.feedback || [];
    }
    
    // Group phoneme issues by type
    const issueGroups = new Map<string, string[]>();
    
    this.result.phonemeDetails.forEach(phoneme => {
      if (phoneme.issue && phoneme.score < 0.7) {
        const issues = issueGroups.get(phoneme.issue) || [];
        if (!issues.includes(phoneme.phoneme)) {
          issues.push(`${phoneme.phoneme} in "${phoneme.word}"`);
        }
        issueGroups.set(phoneme.issue, issues);
      }
    });
    
    // Convert to formatted tips
    const tips: string[] = [];
    issueGroups.forEach((phonemes, issue) => {
      tips.push(`${issue}: ${phonemes.join(', ')}`);
    });
    
    return tips.length ? tips : this.result.feedback || [];
  }
  
  /**
   * Get language-specific pronunciation tips
   */
  getLanguageSpecificTips(): string[] {
    const baseLang = this.languageCode.split('-')[0];
    
    switch (baseLang) {
      case 'en':
        return [
          'Focus on the stressed syllables in multi-syllable words',
          'English has many vowel sounds that may not exist in your language',
          'Pay attention to word endings, especially plural -s and past tense -ed'
        ];
      case 'es':
        return [
          'Practice the distinction between B/V sounds',
          'Focus on the H sound which is silent in Spanish',
          'Work on English R sounds which differ from Spanish'
        ];
      case 'fr':
        return [
          'Practice pronouncing H sounds which are silent in French',
          'Avoid adding stress to the last syllable as in French',
          'Focus on pronouncing consonants at the end of words'
        ];
      default:
        return [];
    }
  }
}
