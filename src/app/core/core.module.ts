//vital modules import
import { NgModule, CUSTOM_ELEMENTS_SCHEMA, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// API and auth services
import { ApiService } from './api-service.service';
import { AuthService } from './auth/auth.service';

// Core application services
import { AnalyticsService } from './analytics/analytics.service';
import { ConnectivityService } from './connectivity/connectivity.service';
import { ErrorService } from './error/error.service';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { LearningService } from './learning/learning.service';
import { ProfileService } from './profile/profile.service';
import { PronunciationService } from './pronunciation/pronunciation.service';
import { RateLimiterService } from './rate-limiter/rate-limiter.service';
import { RewardService } from './reward/reward.service';
import { SettingsService } from './settings/settings.service';
import { VoiceService } from './voice/voice.service';
import { WalletService } from './wallet/wallet.service';
import { GrammarService } from './grammar/grammar.service';

// tools
import { GsapService } from './gsap/gsap.service';

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    // SDK services
    ApiService,
    AuthService,
    
    // Core application services
    AnalyticsService,
    ConnectivityService,
    ErrorService,
    GrammarService,
    LeaderboardService,
    LearningService,
    ProfileService,
    PronunciationService,
    RateLimiterService,
    RewardService,
    SettingsService,
    VoiceService,
    WalletService,
    
    // Tools
    GsapService,
  ],
  exports: [
    CommonModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CoreModule {
	static forRoot(): ModuleWithProviders<CoreModule> {
		return {
			ngModule: CoreModule,
			providers: [
				// SDK services
				ApiService,
				AuthService,
				
				// Core application services
				AnalyticsService,
				ConnectivityService,
				ErrorService,
				GrammarService,
				LeaderboardService,
				LearningService,
				ProfileService,
				PronunciationService,
				RateLimiterService,
				RewardService,
				SettingsService,
				VoiceService,
				WalletService,
				
				// Tools
				GsapService
			]
		}
	}
}
