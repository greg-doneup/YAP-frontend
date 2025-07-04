import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { BehaviorSubject, Observable } from 'rxjs';

// Contract ABIs - extracted from artifacts
export const DAILY_COMPLETION_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_token",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "recordDailyCompletion",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "recordQuizCompletion",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserStats",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "pointTotal",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quizPoints",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalYAPAllocated",
            "type": "uint256"
          }
        ],
        "internalType": "struct DailyCompletion.UserStats",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "day",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "name": "DailyCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "day",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "name": "QuizCompleted",
    "type": "event"
  }
];

export const ENHANCED_REWARDS_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_yapToken",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "rewardType",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "contextId",
        "type": "bytes32"
      }
    ],
    "name": "distributeReward",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "lessonId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "difficulty",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      }
    ],
    "name": "recordLessonCompletion",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "streakDay",
        "type": "uint256"
      }
    ],
    "name": "claimMilestoneReward",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "rewardType",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "contextId",
        "type": "bytes32"
      }
    ],
    "name": "RewardDistributed",
    "type": "event"
  }
];

export const YAP_TOKEN_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract addresses (these should be environment-specific)
export interface ContractAddresses {
  yapToken: string;
  dailyCompletion: string;
  enhancedRewards: string;
  vestingBucket: string;
}

export interface BlockchainNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  contracts: ContractAddresses;
}

// Network configurations
export const BLOCKCHAIN_NETWORKS: { [key: string]: BlockchainNetwork } = {
  localhost: {
    name: 'Localhost',
    chainId: 31337,
    rpcUrl: 'http://localhost:8545',
    contracts: {
      yapToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      dailyCompletion: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      enhancedRewards: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      vestingBucket: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
    }
  },
  sei: {
    name: 'SEI Mainnet',
    chainId: 1329,
    rpcUrl: 'https://evm-rpc.sei-apis.com',
    contracts: {
      yapToken: '', // To be deployed
      dailyCompletion: '',
      enhancedRewards: '',
      vestingBucket: ''
    }
  },
  seiTestnet: {
    name: 'SEI Testnet',
    chainId: 1328,
    rpcUrl: 'https://evm-rpc-testnet.sei-apis.com',
    contracts: {
      yapToken: '0xa0553f71057e9068aD689CFe38aE0FAc20d6541c',
      dailyCompletion: '0x03F89aE6c70d016fEB503dB0E92933F44eeAfaa1',
      enhancedRewards: '0x03F89aE6c70d016fEB503dB0E92933F44eeAfaa1', // Using same address as completion for now
      vestingBucket: '' // Not deployed yet
    }
  }
};

export interface UserRewards {
  totalPoints: number;
  quizPoints: number;
  totalYAPAllocated: number;
  currentStreak: number;
  lastLessonDate: Date;
}

export interface LessonCompletionResult {
  success: boolean;
  reward: number;
  transactionHash: string;
  gasUsed?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private network: BlockchainNetwork;
  
  // Contract instances
  private yapTokenContract: ethers.Contract | null = null;
  private dailyCompletionContract: ethers.Contract | null = null;
  private enhancedRewardsContract: ethers.Contract | null = null;
  
  // Reactive state
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private userRewards = new BehaviorSubject<UserRewards | null>(null);
  
  public connectionStatus$ = this.connectionStatus.asObservable();
  public userRewards$ = this.userRewards.asObservable();

  constructor() {
    // Default to SEI testnet for production
    this.network = BLOCKCHAIN_NETWORKS['seiTestnet'];
    this.initializeProvider();
  }

  /**
   * Initialize blockchain provider and contracts
   */
  private async initializeProvider(): Promise<void> {
    try {
      this.provider = new ethers.JsonRpcProvider(this.network.rpcUrl);
      
      // Test connection
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`Connected to ${this.network.name}, block: ${blockNumber}`);
      
      this.initializeContracts();
      this.connectionStatus.next(true);
    } catch (error) {
      console.error('Failed to initialize blockchain provider:', error);
      this.connectionStatus.next(false);
    }
  }

  /**
   * Initialize smart contract instances
   */
  private initializeContracts(): void {
    if (!this.provider) return;

    try {
      this.yapTokenContract = new ethers.Contract(
        this.network.contracts.yapToken,
        YAP_TOKEN_ABI,
        this.provider
      );

      this.dailyCompletionContract = new ethers.Contract(
        this.network.contracts.dailyCompletion,
        DAILY_COMPLETION_ABI,
        this.provider
      );

      this.enhancedRewardsContract = new ethers.Contract(
        this.network.contracts.enhancedRewards,
        ENHANCED_REWARDS_ABI,
        this.provider
      );

      console.log('Smart contracts initialized successfully');
    } catch (error) {
      console.error('Failed to initialize contracts:', error);
    }
  }

  /**
   * Connect user wallet and set signer
   */
  async connectWallet(privateKey?: string): Promise<boolean> {
    try {
      if (privateKey && this.provider) {
        // Use provided private key (for backend integration)
        this.signer = new ethers.Wallet(privateKey, this.provider);
      } else {
        // Use browser wallet (MetaMask, etc.)
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          await provider.send('eth_requestAccounts', []);
          this.signer = await provider.getSigner();
        } else {
          throw new Error('No wallet provider found');
        }
      }

      // Update contract instances with signer
      if (this.signer) {
        this.yapTokenContract = (this.yapTokenContract?.connect(this.signer) as ethers.Contract) || null;
        this.dailyCompletionContract = (this.dailyCompletionContract?.connect(this.signer) as ethers.Contract) || null;
        this.enhancedRewardsContract = (this.enhancedRewardsContract?.connect(this.signer) as ethers.Contract) || null;
      }

      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      return false;
    }
  }

  /**
   * Record lesson completion on blockchain
   */
  async recordLessonCompletion(
    userAddress: string,
    lessonId: number,
    difficulty: number,
    score: number
  ): Promise<LessonCompletionResult> {
    try {
      if (!this.enhancedRewardsContract || !this.signer) {
        throw new Error('Contract not initialized or wallet not connected');
      }

      const tx = await this.enhancedRewardsContract['recordLessonCompletion'](
        userAddress,
        lessonId,
        difficulty,
        score
      );

      const receipt = await tx.wait();
      
      // Parse events to get reward amount
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id('RewardDistributed(address,bytes32,uint256,uint256,bytes32)')
      );

      let reward = 0;
      if (event) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256', 'bytes32'],
          event.data
        );
        reward = Number(decoded[0]);
      }

      return {
        success: true,
        reward,
        transactionHash: receipt.hash,
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      console.error('Failed to record lesson completion:', error);
      return {
        success: false,
        reward: 0,
        transactionHash: ''
      };
    }
  }

  /**
   * Record daily completion on blockchain
   */
  async recordDailyCompletion(userAddress: string): Promise<LessonCompletionResult> {
    try {
      if (!this.dailyCompletionContract || !this.signer) {
        throw new Error('Contract not initialized or wallet not connected');
      }

      const tx = await this.dailyCompletionContract['recordDailyCompletion'](userAddress);
      const receipt = await tx.wait();

      // Parse events to get reward amount
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id('DailyCompleted(address,uint256,uint256)')
      );

      let reward = 0;
      if (event) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256'],
          event.data
        );
        reward = Number(decoded[1]);
      }

      return {
        success: true,
        reward,
        transactionHash: receipt.hash,
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      console.error('Failed to record daily completion:', error);
      return {
        success: false,
        reward: 0,
        transactionHash: ''
      };
    }
  }

  /**
   * Record quiz completion on blockchain
   */
  async recordQuizCompletion(userAddress: string): Promise<LessonCompletionResult> {
    try {
      if (!this.dailyCompletionContract || !this.signer) {
        throw new Error('Contract not initialized or wallet not connected');
      }

      const tx = await this.dailyCompletionContract['recordQuizCompletion'](userAddress);
      const receipt = await tx.wait();

      // Parse events to get reward amount
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id('QuizCompleted(address,uint256,uint256)')
      );

      let reward = 0;
      if (event) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256'],
          event.data
        );
        reward = Number(decoded[1]);
      }

      return {
        success: true,
        reward,
        transactionHash: receipt.hash,
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      console.error('Failed to record quiz completion:', error);
      return {
        success: false,
        reward: 0,
        transactionHash: ''
      };
    }
  }

  /**
   * Get user rewards and stats from blockchain
   */
  async getUserRewards(userAddress: string): Promise<UserRewards | null> {
    try {
      if (!this.dailyCompletionContract || !this.enhancedRewardsContract) {
        throw new Error('Contracts not initialized');
      }

      // Get user stats from DailyCompletion contract
      const stats = await this.dailyCompletionContract['getUserStats'](userAddress);
      
      // Get current streak from EnhancedRewards contract
      const streak = await this.enhancedRewardsContract['userStreaks'](userAddress);
      const lastLessonTimestamp = await this.enhancedRewardsContract['lastLessonDate'](userAddress);

      const rewards: UserRewards = {
        totalPoints: Number(stats.pointTotal),
        quizPoints: Number(stats.quizPoints),
        totalYAPAllocated: Number(stats.totalYAPAllocated),
        currentStreak: Number(streak),
        lastLessonDate: new Date(Number(lastLessonTimestamp) * 1000)
      };

      this.userRewards.next(rewards);
      return rewards;
    } catch (error) {
      console.error('Failed to get user rewards:', error);
      return null;
    }
  }

  /**
   * Get YAP token balance
   */
  async getTokenBalance(userAddress: string): Promise<number> {
    try {
      if (!this.yapTokenContract) {
        throw new Error('YAP token contract not initialized');
      }

      const balance = await this.yapTokenContract['balanceOf'](userAddress);
      return Number(ethers.formatEther(balance));
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return 0;
    }
  }

  /**
   * Switch blockchain network
   */
  async switchNetwork(networkKey: string): Promise<boolean> {
    try {
      if (!BLOCKCHAIN_NETWORKS[networkKey]) {
        throw new Error(`Unknown network: ${networkKey}`);
      }

      this.network = BLOCKCHAIN_NETWORKS[networkKey];
      await this.initializeProvider();
      return true;
    } catch (error) {
      console.error('Failed to switch network:', error);
      return false;
    }
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): BlockchainNetwork {
    return this.network;
  }

  /**
   * Check if blockchain is connected
   */
  isConnected(): boolean {
    return this.connectionStatus.value;
  }
}
