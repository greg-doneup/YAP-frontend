import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from '../../core/profile/profile.service';
import { WalletService } from '../../services/wallet.service';
import { LeaderboardService } from '../../core/leaderboard/leaderboard.service';
import { CryptoBrowserService } from '../../shared/services/crypto-browser.service';
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
    username: ''
  };

  constructor(
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private authService: AuthService,
    private profileService: ProfileService,
    private walletService: WalletService,
    private leaderboardService: LeaderboardService,
    private cryptoService: CryptoBrowserService
  ) { }

  ngOnInit() {
    this.loadProfileData();
  }

  async loadProfileData() {
    console.log('=== LOADING PROFILE DATA ===');
    
    try {
      this.isLoading = true;

      // Get current user
      const currentUser = this.authService.currentUserValue;
      console.log('Current user from AuthService:', currentUser);
      
      if (!currentUser) {
        console.log('No current user, redirecting to welcome');
        this.router.navigate(['/welcome']);
        return;
      }

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

      // Load statistics (mock data for now)
      this.profileData.stats = {
        daysPracticed: 15,
        highestStreak: 7,
        totalYAP: 1250,
        currentXP: 2500,
        currentStreak: 3,
        userRank: 42
      };

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
      // Initialize edit form with current data
      this.editForm.displayName = this.profileData.profile?.displayName || '';
      this.editForm.username = this.profileData.profile?.username || '';
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.editForm = {
      displayName: '',
      username: ''
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

      await firstValueFrom(this.profileService.updateUserProfile(this.profileData.user.walletAddress, updateData));
      
      // Update local data
      if (this.profileData.profile) {
        this.profileData.profile.displayName = this.editForm.displayName;
        this.profileData.profile.username = this.editForm.username;
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
