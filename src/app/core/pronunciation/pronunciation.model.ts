/**
 * Models for detailed pronunciation feedback
 */

/**
 * Word-level pronunciation detail
 */
export interface WordPronunciationDetail {
  word: string;
  start_time: number;
  end_time: number;
  score: number;
  issues: string[];
}

/**
 * Phoneme-level pronunciation detail
 */
export interface PhonemePronunciationDetail {
  phoneme: string;
  word: string;
  start_time: number;
  end_time: number;
  score: number;
  issue: string;
}

/**
 * Enhanced pronunciation result with detailed feedback
 */
export interface DetailedPronunciationResult {
  score: number;
  pass: boolean;
  transcript?: string;
  expected: string;
  wordDetails?: WordPronunciationDetail[];
  phonemeDetails?: PhonemePronunciationDetail[];
  feedback?: string[];
  audioUrl?: string;
}

/**
 * Pronunciation history result
 */
export interface PronunciationHistoryItem {
  date: string;
  wordId: string;
  expected: string;
  score: number;
  pass: boolean;
  feedback?: string[];
}
