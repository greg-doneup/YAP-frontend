import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { WelcomeGuard } from './core/guards/welcome.guard';
import { WalletAuthGuard } from './core/guards/wallet-auth.guard';
import { WalletWelcomeGuard } from './core/guards/wallet-welcome.guard';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./modules/home/home.module').then( m => m.HomePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then( m => m.AuthPageModule)
  },
  {
    path: 'welcome',
    loadChildren: () => import('./modules/welcome/welcome.module').then( m => m.WelcomePageModule),
    canActivate: [WalletWelcomeGuard]
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./modules/dashboard/dashboard.module').then( m => m.DashboardModule),
    canActivate: [WalletAuthGuard]
  },
  {
    path: 'vocab-practice',
    loadChildren: () => import('./modules/practice/practice.module').then( m => m.PracticePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'practice',
    loadChildren: () => import('./modules/pronunciation-practice/pronunciation-practice.module').then( m => m.PronunciationPracticePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'quiz',
    loadChildren: () => import('./modules/quiz/quiz.module').then( m => m.QuizPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'reward',
    loadChildren: () => import('./modules/reward/reward.module').then( m => m.RewardPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'leaderboard',
    loadChildren: () => import('./modules/leaderboard/leaderboard.module').then( m => m.LeaderboardPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'progress',
    loadChildren: () => import('./modules/progress/progress.module').then( m => m.ProgressPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    loadChildren: () => import('./modules/profile/profile.module').then( m => m.ProfilePageModule),
    canActivate: [WalletAuthGuard]
  },
  {
    path: 'settings',
    loadChildren: () => import('./modules/settings/settings.module').then( m => m.SettingsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'ai-chat',
    loadChildren: () => import('./modules/ai-chat/ai-chat.module').then( m => m.AiChatPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'error',
    loadChildren: () => import('./modules/error/error.module').then( m => m.ErrorPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
