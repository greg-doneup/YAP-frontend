import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { IonicModule } from '@ionic/angular';
import { MaterialModule } from '../../shared/material/material.module';

import { WelcomePageRoutingModule } from './welcome-routing.module';

import { WelcomePage } from './welcome.page';
import { CarouselPage } from './pages/carousel.page';
import { IntroPage } from './pages/intro.page';
import { MicPermissionComponent } from './components/mic-permissio/mic-permission.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    IonicModule,
    MaterialModule,
    WelcomePageRoutingModule
  ],
  declarations: [
    WelcomePage,
    CarouselPage,
    IntroPage,
    MicPermissionComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class WelcomePageModule {}
