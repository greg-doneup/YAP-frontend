import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController, ModalController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { WalletAuthService } from '../../core/auth/wallet-auth.service';
import { ProfileService } from '../../core/profile/profile.service';
import { WalletService } from '../../services/wallet.service';
import { LeaderboardService } from '../../core/leaderboard/leaderboard.service';
import { CryptoBrowserService } from '../../shared/services/crypto-browser.service';
import { WalletManagementComponent } from '../../components/wallet-management.component';
import { TokenService } from '../../services/token.service';
import { firstValueFrom } from 'rxjs';

interface ProfileData {
  user: any;
  profile: any;
  seiWallet: string;
  evmWallet: string;
  stats: {
    daysPracticed: number;
    highestStreak: number;
    totalYAP: number;
    currentXP: number;
    currentStreak: number;
    userRank: number | null;
  };
}

interface EditForm {
  displayName: string;
  username: string;
  languageToLearn: string;
  nativeLanguage: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  isLoading = true;
  isEditing = false;
  
  profileData: ProfileData = {
    user: null,
    profile: null,
    seiWallet: 'Not connected',
    evmWallet: 'Not connected',
    stats: {
      daysPracticed: 0,
      highestStreak: 0,
      totalYAP: 0,
      currentXP: 0,
      currentStreak: 0,
      userRank: null
    }
  };

  editForm: EditForm = {
    displayName: '',
    username: '',
    languageToLearn: 'spanish',
    nativeLanguage: 'english'
  };

  constructor(
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private authService: AuthService,
    private walletAuthService: WalletAuthService,
    private profileService: ProfileService,
    private walletService: WalletService,
    private leaderboardService: LeaderboardService,
    private cryptoService: CryptoBrowserService,
    private modalController: ModalController,
    private tokenService: TokenService
  ) { }

  ngOnInit() {
    this.loadProfileData();
  }

  async loadProfileData() {
    console.log('=== LOADING PROFILE DATA (WALLET-FIRST) ===');
    
    try {
      this.isLoading = true;

      // 🚀 CRITICAL: Wait for wallet authentication to fully initialize
      console.log('🔄 Ensuring wallet authentication is fully initialized...');
      await this.walletAuthService.refreshWalletAuth();
      console.log('✅ Wallet authentication initialization completed');

      // 🚀 NEW: Primary check - wallet-based authentication
      const walletUser = this.walletAuthService.currentWalletUser;
      console.log('Current wallet user from WalletAuthService:', walletUser);
      
      let currentUser;
      
      if (walletUser && walletUser.isAuthenticated) {
        console.log('✅ Using wallet-first authentication');
        // Convert wallet user to legacy format for compatibility
        currentUser = this.walletAuthService.toLegacyUser();
        console.log('Converted wallet user to legacy format:', currentUser);
      } else {
        // Fallback: Get current user with fallback to localStorage (legacy method)
        currentUser = this.authService.currentUserValue;
        console.log('Current user from AuthService (legacy):', currentUser);
        
        // If AuthService doesn't have user, try localStorage fallback (same as AuthGuard)
        if (!currentUser) {
          console.log('No current user from AuthService, checking localStorage fallback...');
          const isUserAuthenticated = localStorage.getItem('user_authenticated') === 'true';
          const userStr = localStorage.getItem('currentUser');
          const userWallet = localStorage.getItem('user_wallet');
          
          if (isUserAuthenticated && userStr) {
            try {
              currentUser = JSON.parse(userStr);
              console.log('Recovered user from localStorage:', currentUser);
              // Reload AuthService state
              this.authService.loadUserFromStorage();
              // Also try to refresh wallet auth
              this.walletAuthService.refreshWalletAuth();
            } catch (error) {
              console.error('Failed to parse user from localStorage:', error);
            }
          }
        }
      }
      
      // If still no user after all checks, redirect to welcome
      if (!currentUser) {
        console.log('❌ No current user found after wallet-first and legacy checks, redirecting to welcome');
        this.router.navigate(['/welcome']);
        return;
      }

      console.log('✅ Authentication successful, proceeding with profile load for user:', currentUser.email);
      this.profileData.user = currentUser;

      // Check wallet addresses from current user
      console.log('User wallet addresses:');
      console.log('- SEI wallet:', currentUser.walletAddress);
      console.log('- EVM wallet:', currentUser.ethWalletAddress);

      // Try to get wallet metadata from secure storage
      console.log('Attempting to load wallet metadata from secure storage...');
      try {
        const walletMetadata = await this.cryptoService.getWalletMetadata(currentUser.email);
        console.log('Wallet metadata from secure storage:', walletMetadata);
        
        if (walletMetadata) {
          this.profileData.seiWallet = walletMetadata.sei_address || 'Not connected';
          this.profileData.evmWallet = walletMetadata.eth_address || 'Not connected';
          console.log('Updated wallet addresses from secure storage');
        }
      } catch (error) {
        console.error('Error loading from secure storage:', error);
      }

      // Also check localStorage for wallet addresses
      console.log('Checking localStorage for wallet addresses...');
      const walletAddressesStr = localStorage.getItem('wallet_addresses');
      if (walletAddressesStr) {
        try {
          const walletAddresses = JSON.parse(walletAddressesStr);
          console.log('Wallet addresses from localStorage:', walletAddresses);
          
          if (walletAddresses.sei_address && !this.profileData.seiWallet.includes('sei')) {
            this.profileData.seiWallet = walletAddresses.sei_address;
          }
          if (walletAddresses.eth_address && !this.profileData.evmWallet.includes('0x')) {
            this.profileData.evmWallet = walletAddresses.eth_address;
          }
        } catch (error) {
          console.error('Error parsing wallet addresses from localStorage:', error);
        }
      }

      // Set wallet addresses from user data (primary source)
      if (currentUser.walletAddress) {
        this.profileData.seiWallet = currentUser.walletAddress;
      }
      if (currentUser.ethWalletAddress) {
        this.profileData.evmWallet = currentUser.ethWalletAddress;
      }

      console.log('Final wallet addresses:');
      console.log('- SEI:', this.profileData.seiWallet);
      console.log('- EVM:', this.profileData.evmWallet);

      // Load profile data
      try {
        if (currentUser.walletAddress) {
          const profile = await firstValueFrom(this.profileService.getUserProfile(currentUser.walletAddress));
          console.log('Profile data loaded:', profile);
          this.profileData.profile = profile;
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        this.profileData.profile = null;
      }

      // Load real statistics from backend
      try {
        if (currentUser.id) {
          const offchainProfile = await firstValueFrom(this.profileService.getOffchainProfile(currentUser.id));
          console.log('Offchain profile loaded:', offchainProfile);
          
          // Calculate additional stats from XP history if wallet address is available
          let daysPracticed = 0;
          let totalYAP = 0;
          
          if (currentUser.walletAddress) {
            try {
              const xpHistory = await firstValueFrom(this.profileService.getXpHistory(currentUser.walletAddress, 100));
              console.log('XP history loaded:', xpHistory);
              
              // Calculate days practiced (unique dates with XP gains)
              const uniqueDates = new Set(xpHistory.map(entry => entry.date.split('T')[0]));
              daysPracticed = uniqueDates.size;
              
              // Calculate total YAP earned (sum of all positive XP gains)
              totalYAP = xpHistory
                .filter(entry => entry.amount > 0)
                .reduce((sum, entry) => sum + entry.amount, 0);
              
              console.log(`Calculated stats: ${daysPracticed} days practiced, ${totalYAP} total YAP`);
            } catch (historyError) {
              console.error('Error loading XP history for stats calculation:', historyError);
            }
          }
          
          this.profileData.stats = {
            daysPracticed: daysPracticed,
            highestStreak: offchainProfile?.streak || 0, // Use current streak as highest for now
            totalYAP: totalYAP,
            currentXP: offchainProfile?.xp || 0,
            currentStreak: offchainProfile?.streak || 0,
            userRank: null // Will be updated below from leaderboard service
          };
        } else {
          // Fallback to zeros if no user ID
          this.profileData.stats = {
            daysPracticed: 0,
            highestStreak: 0,
            totalYAP: 0,
            currentXP: 0,
            currentStreak: 0,
            userRank: null
          };
        }
      } catch (error) {
        console.error('Error loading statistics:', error);
        // Fallback to zeros on error
        this.profileData.stats = {
          daysPracticed: 0,
          highestStreak: 0,
          totalYAP: 0,
          currentXP: 0,
          currentStreak: 0,
          userRank: null
        };
      }

      // Load leaderboard rank
      try {
        if (currentUser.walletAddress) {
          const rankData = await firstValueFrom(this.leaderboardService.getUserRank(currentUser.walletAddress));
          console.log('User rank loaded:', rankData);
          this.profileData.stats.userRank = rankData?.rank || null;
        }
      } catch (error) {
        console.error('Error loading user rank:', error);
        // Keep mock rank
      }

      console.log('Final profile data:', this.profileData);

    } catch (error) {
      console.error('Error loading profile data:', error);
      this.showToast('Failed to load profile data', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    
    if (this.isEditing) {
      // Initialize edit form with current data from both profile and user objects
      this.editForm.displayName = this.profileData.profile?.displayName || 
                                  this.profileData.user?.displayName || 
                                  this.profileData.user?.name || '';
      this.editForm.username = this.profileData.profile?.username || 
                               this.profileData.user?.username || '';
      this.editForm.languageToLearn = this.profileData.user?.language_to_learn || 'spanish';
      this.editForm.nativeLanguage = this.profileData.user?.nativeLanguage || 
                                     this.profileData.user?.native_language || 'english';
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.editForm = {
      displayName: '',
      username: '',
      languageToLearn: 'spanish',
      nativeLanguage: 'english'
    };
  }

  async saveProfile() {
    try {
      if (!this.profileData.user?.walletAddress) {
        this.showToast('No wallet address found', 'danger');
        return;
      }

      const updateData = {
        displayName: this.editForm.displayName,
        username: this.editForm.username
      };

      // Update backend profile
      await firstValueFrom(this.profileService.updateUserProfile(this.profileData.user.walletAddress, updateData));
      
      // Update local profile data
      if (this.profileData.profile) {
        this.profileData.profile.displayName = this.editForm.displayName;
        this.profileData.profile.username = this.editForm.username;
      }

      // Update the current user object in localStorage
      const currentUser = this.profileData.user;
      if (currentUser) {
        // Update the user object with new profile data
        currentUser.displayName = this.editForm.displayName;
        currentUser.username = this.editForm.username;
        currentUser.language_to_learn = this.editForm.languageToLearn;
        currentUser.nativeLanguage = this.editForm.nativeLanguage;
        currentUser.native_language = this.editForm.nativeLanguage; // Support both formats
        
        // Save updated user to localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Update the profileData.user reference
        this.profileData.user = currentUser;
        
        // Also update the AuthService and WalletAuthService if they have the user
        this.authService.loadUserFromStorage();
        await this.walletAuthService.refreshWalletAuth();
      }

      this.isEditing = false;
      this.showToast('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      this.showToast('Failed to update profile', 'danger');
    }
  }

  async copyWalletAddress(walletType: 'sei' | 'evm') {
    const address = walletType === 'sei' ? this.profileData.seiWallet : this.profileData.evmWallet;
    
    if (address && address !== 'Not connected') {
      try {
        // Use the browser clipboard API
        await navigator.clipboard.writeText(address);
        this.showToast(`${walletType.toUpperCase()} wallet address copied`, 'success');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        this.showToast('Failed to copy address', 'danger');
      }
    }
  }

  /**
   * Open the wallet management modal
   */
  async openWalletManagement() {
    const modal = await this.modalController.create({
      component: WalletManagementComponent,
      cssClass: 'wallet-management-modal',
      backdropDismiss: true
    });

    await modal.present();

    // Trigger a refresh of wallet data when modal is opened
    // This is especially important for newly registered users
    try {
      const component = (modal as any).component;
      if (component && component.refreshWalletInfo) {
        // Add a small delay to allow IndexedDB operations to complete
        setTimeout(() => {
          component.refreshWalletInfo();
        }, 500);
      }
    } catch (error) {
      console.log('Could not access modal component for refresh, modal will use initial load');
    }

    const { data } = await modal.onWillDismiss();
    if (data?.refreshNeeded) {
      // Refresh token data and reload profile data
      this.tokenService.refreshAllData();
      this.loadProfileData();
    }
  }

  // Navigation methods for Others section
  showAboutApp() {
    // TODO: Implement about app modal/page
    this.showToast('About App - Coming Soon', 'primary');
  }

  showHelp() {
    // TODO: Implement help & support page
    this.showToast('Help & Support - Coming Soon', 'primary');
  }

  showTerms() {
    // TODO: Implement terms & conditions page
    this.showToast('Terms & Conditions - Coming Soon', 'primary');
  }

  navigateToLeaderboard() {
    this.router.navigate(['/leaderboard']);
  }

  navigateToSettings() {
    // TODO: Implement settings page
    this.showToast('Settings - Coming Soon', 'primary');
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: () => {
            this.authService.logout().subscribe(() => {
              this.router.navigate(['/welcome']);
            });
          }
        }
      ]
    });

    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    toast.present();
  }
}
