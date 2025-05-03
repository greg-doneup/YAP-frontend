import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./modules/home/home.module').then( m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then( m => m.AuthPageModule)
  },
  {
    path: 'welcome',
    loadChildren: () => import('./modules/welcome/welcome.module').then( m => m.WelcomePageModule)
  },
  {
    path: 'practice',
    loadChildren: () => import('./modules/practice/practice.module').then( m => m.PracticePageModule)
  },
  {
    path: 'quiz',
    loadChildren: () => import('./modules/quiz/quiz.module').then( m => m.QuizPageModule)
  },
  {
    path: 'reward',
    loadChildren: () => import('./modules/reward/reward.module').then( m => m.RewardPageModule)
  },
  {
    path: 'leaderboard',
    loadChildren: () => import('./modules/leaderboard/leaderboard.module').then( m => m.LeaderboardPageModule)
  },
  {
    path: 'progress',
    loadChildren: () => import('./modules/progress/progress.module').then( m => m.ProgressPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./modules/profile/profile.module').then( m => m.ProfilePageModule)
  },
  {
    path: 'settings',
    loadChildren: () => import('./modules/settings/settings.module').then( m => m.SettingsPageModule)
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
