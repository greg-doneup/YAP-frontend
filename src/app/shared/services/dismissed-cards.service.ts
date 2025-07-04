import { Injectable } from '@angular/core';

export interface DismissedCard {
  id: string;
  dismissedAt: Date;
  isPersistent: boolean; // true for localStorage, false for sessionStorage
}

@Injectable({
  providedIn: 'root'
})
export class DismissedCardsService {
  private readonly PERSISTENT_STORAGE_KEY = 'yap_dismissed_cards_persistent';
  private readonly SESSION_STORAGE_KEY = 'yap_dismissed_cards_session';

  constructor() { }

  /**
   * Check if a card is dismissed
   */
  isCardDismissed(cardId: string): boolean {
    return this.isPersistentlyDismissed(cardId) || this.isSessionDismissed(cardId);
  }

  /**
   * Dismiss a card with persistence option
   */
  dismissCard(cardId: string, isPersistent: boolean = false): void {
    const dismissedCard: DismissedCard = {
      id: cardId,
      dismissedAt: new Date(),
      isPersistent
    };

    if (isPersistent) {
      this.addToPersistentStorage(dismissedCard);
    } else {
      this.addToSessionStorage(dismissedCard);
    }
  }

  /**
   * Restore a dismissed card (remove from dismissed state)
   */
  restoreCard(cardId: string): void {
    this.removeFromPersistentStorage(cardId);
    this.removeFromSessionStorage(cardId);
  }

  /**
   * Get all dismissed cards
   */
  getAllDismissedCards(): DismissedCard[] {
    const persistent = this.getPersistentlyDismissed();
    const session = this.getSessionDismissed();
    return [...persistent, ...session];
  }

  /**
   * Clear all dismissed cards (useful for testing or reset)
   */
  clearAllDismissed(): void {
    localStorage.removeItem(this.PERSISTENT_STORAGE_KEY);
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
  }

  private isPersistentlyDismissed(cardId: string): boolean {
    const dismissed = this.getPersistentlyDismissed();
    return dismissed.some(card => card.id === cardId);
  }

  private isSessionDismissed(cardId: string): boolean {
    const dismissed = this.getSessionDismissed();
    return dismissed.some(card => card.id === cardId);
  }

  private getPersistentlyDismissed(): DismissedCard[] {
    try {
      const stored = localStorage.getItem(this.PERSISTENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading persistent dismissed cards:', error);
      return [];
    }
  }

  private getSessionDismissed(): DismissedCard[] {
    try {
      const stored = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading session dismissed cards:', error);
      return [];
    }
  }

  private addToPersistentStorage(card: DismissedCard): void {
    try {
      const dismissed = this.getPersistentlyDismissed();
      const updated = dismissed.filter(c => c.id !== card.id); // Remove existing
      updated.push(card);
      localStorage.setItem(this.PERSISTENT_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving to persistent storage:', error);
    }
  }

  private addToSessionStorage(card: DismissedCard): void {
    try {
      const dismissed = this.getSessionDismissed();
      const updated = dismissed.filter(c => c.id !== card.id); // Remove existing
      updated.push(card);
      sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving to session storage:', error);
    }
  }

  private removeFromPersistentStorage(cardId: string): void {
    try {
      const dismissed = this.getPersistentlyDismissed();
      const updated = dismissed.filter(c => c.id !== cardId);
      localStorage.setItem(this.PERSISTENT_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error removing from persistent storage:', error);
    }
  }

  private removeFromSessionStorage(cardId: string): void {
    try {
      const dismissed = this.getSessionDismissed();
      const updated = dismissed.filter(c => c.id !== cardId);
      sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error removing from session storage:', error);
    }
  }
}
