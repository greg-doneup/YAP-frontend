import { NgModule, NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from "@angular/forms";
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClipboardModule } from '@angular/cdk/clipboard';

//dynamic components
import { PronunciationFeedbackComponent } from './pronunciation-feedback/pronunciation-feedback.component';
import { SplashScreenComponent } from './splash-screen/splash-screen.component';
import { DailyTrackerComponent } from './components/daily-tracker/daily-tracker.component';

//wallet and token components
import { WalletBalanceWidgetComponent } from '../components/wallet-balance-widget.component';
import { TokenSpendingModalComponent } from '../components/token-spending-modal.component';
import { AiChatComponent } from '../components/ai-chat.component';
import { WalletManagementComponent } from '../components/wallet-management.component';

//tools modules
import { FontAwesomeLibraryModule } from './font-awesome-library/font-awesome-library.module';
import { MaterialModule } from './material/material.module';

//directives

//pipes

//modals

@NgModule({
    declarations: [
       PronunciationFeedbackComponent,
       SplashScreenComponent,
       DailyTrackerComponent,
       WalletBalanceWidgetComponent,
       TokenSpendingModalComponent,
       AiChatComponent,
       WalletManagementComponent
    ],
    imports: [
        CommonModule,
        IonicModule,
        FormsModule,
        ReactiveFormsModule,
        FontAwesomeLibraryModule,
        MaterialModule,
        ClipboardModule,
    ],
    exports: [
        CommonModule,
        IonicModule,
        FormsModule,
        ReactiveFormsModule,
        FontAwesomeLibraryModule,
        MaterialModule,
        ClipboardModule,
        PronunciationFeedbackComponent,
        SplashScreenComponent,
        DailyTrackerComponent,
        WalletBalanceWidgetComponent,
        TokenSpendingModalComponent,
        AiChatComponent,
        WalletManagementComponent
    ],
    schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
})
export class SharedModule { }
