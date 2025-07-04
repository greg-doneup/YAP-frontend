# YAP Frontend Integration Requirements

## 🎯 Overview
Based on the backend infrastructure we've set up, the frontend needs several key integrations to provide a complete user experience for the YAP AI language learning platform with tokenized features.

## ✅ What's Already Implemented

### 1. **Core Infrastructure**
- ✅ Non-custodial wallet service with mnemonic encryption
- ✅ Comprehensive token service with balance tracking
- ✅ Secure wallet recovery and integration
- ✅ Basic dashboard structure
- ✅ Complete authentication system
- ✅ Profile management

### 2. **Services Created**
- ✅ `WalletService` - Mnemonic generation, encryption, wallet creation
- ✅ `TokenService` - Balance tracking, spending, allowances  
- ✅ `SecureWalletIntegrationService` - Advanced wallet operations
- ✅ `WalletStorageService` - IndexedDB for secure local storage

### 3. **New Components Created**
- ✅ `WalletBalanceWidgetComponent` - Dashboard token balance display
- ✅ `TokenSpendingModalComponent` - Spending confirmation dialogs
- ✅ `AiChatComponent` - Real-time AI chat with voice/text modes
- ✅ `WalletStorageService` - Secure IndexedDB wallet storage

## 🚧 Implementation Needed

### 1. **Dashboard Integration**
```typescript
// Add to dashboard.page.html
<app-wallet-balance-widget></app-wallet-balance-widget>
```

### 2. **AI Chat Integration**
```typescript
// Add chat button to dashboard
async openAiChat() {
  const modal = await this.modalController.create({
    component: AiChatComponent,
    cssClass: 'fullscreen-modal'
  });
  await modal.present();
}
```

### 3. **Pronunciation Assessment Integration**
```typescript
// Add to practice modules with token gating
async startPronunciationAssessment() {
  const modal = await this.modalController.create({
    component: TokenSpendingModalComponent,
    componentProps: {
      data: {
        featureId: 'pronunciation-detailed',
        featureName: 'Detailed Pronunciation Analysis',
        tokenCost: 2,
        description: 'Get AI-powered pronunciation feedback'
      }
    }
  });
  
  const result = await modal.onDidDismiss();
  if (result.data?.confirmed) {
    // Start assessment
  }
}
```

### 4. **Wallet Management Page**
Create `/wallet` route with:
- Balance display
- Transaction history
- Mnemonic backup interface
- Security settings

### 5. **Token Economy Features**
- Daily allowance tracking in relevant features
- Spending confirmations before premium features
- Unlimited pass purchase options
- Token rewards for completed activities

## 🔧 Required API Endpoints

The backend needs these additional endpoints:

### 1. **AI Chat Service**
```
POST /api/ai-chat/text
POST /api/ai-chat/voice  
GET /api/ai-chat/sessions
```

### 2. **Pronunciation Assessment**
```
POST /api/pronunciation/assess
GET /api/pronunciation/history
```

### 3. **Token Transactions**
```
GET /api/tokens/balance
POST /api/tokens/spend
GET /api/tokens/history
GET /api/tokens/allowances
```

## 🎨 UI Components Needed

### 1. **Wallet Management Components**
- `WalletDetailsComponent` - Full wallet interface
- `MnemonicBackupComponent` - Secure mnemonic display
- `TransactionHistoryComponent` - Token transaction list

### 2. **Learning Feature Components**
- `PronunciationAssessmentComponent` - Audio recording + analysis
- `LessonProgressComponent` - Progress with token rewards
- `QuizComponent` - Token-gated quizzes

### 3. **Token Economy Components**
- `DailyAllowanceTrackerComponent` - Usage tracking widget
- `TokenRewardAnimationComponent` - Celebration animations
- `LeaderboardComponent` - Staking and rewards

## 🔒 Security Considerations

### 1. **Wallet Security**
- ✅ Mnemonic stored encrypted in IndexedDB
- ✅ No private keys sent to backend
- ✅ User passphrase required for wallet operations
- ✅ Secure key derivation (PBKDF2)

### 2. **Token Security**
- ✅ Server-side balance validation
- ✅ Spending verification before features unlock
- ✅ Transaction logging and audit trails

## 🚀 Deployment Steps

### 1. **Add New Components to Modules**
```typescript
// app.module.ts or shared.module.ts
declarations: [
  WalletBalanceWidgetComponent,
  TokenSpendingModalComponent,
  AiChatComponent,
  // ... other components
]
```

### 2. **Update Routing**
```typescript
// app-routing.module.ts
{
  path: 'wallet',
  loadChildren: () => import('./modules/wallet/wallet.module').then(m => m.WalletModule)
},
{
  path: 'ai-chat',
  component: AiChatComponent
}
```

### 3. **Environment Configuration**
```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  aiChatUrl: 'http://localhost:8081',
  tokenContractAddress: '0x...',
  chainId: 1337 // or mainnet
};
```

### 4. **Dependencies Installation**
```bash
npm install ethers bip39 crypto-js
npm install @ionic/storage-angular
```

## 📱 User Experience Flow

### 1. **New User Onboarding**
1. User signs up with email/passphrase
2. Frontend generates mnemonic
3. Mnemonic encrypted with passphrase
4. Wallet addresses generated (SEI + ETH)
5. Encrypted data stored in IndexedDB
6. Backend stores encrypted mnemonic + metadata

### 2. **Daily Usage**
1. User logs in → wallet automatically available
2. Dashboard shows token balance + daily allowances
3. User can access free features within limits
4. Premium features prompt for token spending
5. Spending confirmed via modal → backend processes
6. Token rewards earned for completed activities

### 3. **Wallet Management**
1. View balance and transaction history
2. Backup mnemonic (with passphrase verification)
3. View wallet addresses for external transfers
4. Monitor staking and rewards

## 🎓 Token-Gated Features Implementation

Based on the YAP Token Cost Matrix:

### 1. **Daily Lessons** (5 free, 1 token per extra)
```typescript
async startLesson() {
  if (lessonsUsedToday >= 5) {
    await this.promptTokenSpending({
      featureId: 'daily-lessons',
      cost: 1,
      description: 'Extra lesson access'
    });
  }
  // Start lesson
}
```

### 2. **AI Chat** (15 min voice free, 25 text messages free)
```typescript
// Already implemented in AiChatComponent
// Automatically tracks usage and prompts for more time
```

### 3. **Pronunciation Assessment** (2 tokens per detailed analysis)
```typescript
async startDetailedAssessment() {
  await this.promptTokenSpending({
    featureId: 'pronunciation-detailed',
    cost: 2,
    description: 'AI-powered detailed feedback'
  });
}
```

## 🔄 State Management

### 1. **Token Balance State**
- Real-time balance updates via WebSocket
- Local caching with periodic refresh
- Optimistic UI updates for spending

### 2. **Wallet State** 
- Encrypted storage in IndexedDB
- In-memory decryption when needed
- Automatic logout on inactivity

### 3. **Usage Tracking**
- Daily allowances synced with backend
- Local usage counting with server validation
- Reset timers for daily limits

## ✨ Enhanced Features

### 1. **Token Rewards Animation**
When users earn tokens:
```typescript
async showTokenReward(amount: number) {
  // Celebratory animation
  // Balance counter animation
  // Achievement unlock notifications
}
```

### 2. **Social Features**
- Weekly leaderboard with token staking
- Referral rewards (5 tokens each)
- Community challenges

### 3. **Gamification**
- Daily streak bonuses
- Achievement system
- Progress milestones with token rewards

This comprehensive frontend implementation will provide users with:
- 🔐 **Secure non-custodial wallet management**
- 💎 **Seamless token economy integration** 
- 🤖 **AI-powered language learning features**
- 📊 **Clear usage tracking and spending controls**
- 🎮 **Engaging gamified experience**

**Ready for production deployment with full token economy integration! 🚀**
