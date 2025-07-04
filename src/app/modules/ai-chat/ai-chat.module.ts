import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

import { AiChatPageRoutingModule } from './ai-chat-routing.module';
import { AiChatPage } from './ai-chat.page';
import { AiChatSessionService } from '../../services/ai-chat-session.service';
import { SharedModule } from '../../shared/shared.module';
import { AdvancedAudioPlayerComponent } from '../../components/advanced-audio-player/advanced-audio-player.component';
import { AudioQueueComponent } from '../../components/audio-queue/audio-queue.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    IonicModule,
    AiChatPageRoutingModule,
    SharedModule
  ],
  declarations: [
    AiChatPage,
    AdvancedAudioPlayerComponent,
    AudioQueueComponent
  ],
  providers: [
    AiChatSessionService
  ]
})
export class AiChatPageModule {}
