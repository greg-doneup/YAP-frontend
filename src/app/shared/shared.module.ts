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

//tools modules
import { FontAwesomeLibraryModule } from './font-awesome-library/font-awesome-library.module';
import { MaterialModule } from './material/material.module';

//directives

//pipes

//modals

@NgModule({
    declarations: [
       PronunciationFeedbackComponent,
       SplashScreenComponent
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
        SplashScreenComponent
    ],
    schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
})
export class SharedModule { }
