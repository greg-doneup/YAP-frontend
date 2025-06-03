/**
 * YAP Mock Server
 * 
 * This mock server implements all endpoints defined in the API_SPECIFICATION.md
 * to enable frontend development without requiring the full YAP backend services.
 * 
 * Run with: node mock-server.js
 * Server will be available at http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Add /api prefix support for frontend compatibility
app.use('/api', express.Router());

// Mount all routes on both root and /api prefix for flexibility
function mountRoutes(router) {
  app.use('/', router);
  app.use('/api', router);
}

// Create a router for all our endpoints
const apiRouter = express.Router();

// Mock JWT secret - for development only
const JWT_SECRET = 'mock-jwt-secret-dev-only';

// Mock database - in memory storage for this mock server
const mockDatabase = {
  users: new Map(),
  profiles: new Map(), // Basic profile service profiles (email, name, language)
  offchainProfiles: new Map(), // Offchain profile service profiles (xp, streak)
  progress: new Map(),
  completions: new Map(),
  refreshTokens: new Set(),
  lessons: new Map(),
  vocabulary: new Map(),
  pronunciationHistory: new Map()
};

// Initialize mock data
function initializeMockData() {
  // Create some sample users for testing
  const sampleUsers = [
    {
      userId: 'sample-user-1',
      email: 'test1@example.com',
      name: 'Test User 1',
      language: 'spanish',
      xp: 150,
      streak: 3
    },
    {
      userId: 'sample-user-2', 
      email: 'test2@example.com',
      name: 'Test User 2',
      language: 'french',
      xp: 250,
      streak: 5
    },
    // Waitlist user who needs first-time setup (no wlw flag yet)
    {
      userId: 'waitlist-user-1',
      email: 'waitlist@example.com',
      name: 'Waitlist User',
      language: 'spanish',
      xp: 25,
      streak: 0,
      isWaitlist: true,
      needsSetup: true
    },
    // Waitlist user who already completed setup
    {
      userId: 'waitlist-user-2',
      email: 'secured@example.com',
      name: 'Secured Waitlist User',
      language: 'french',
      xp: 50,
      streak: 1,
      isWaitlist: true,
      hasWallet: true,
      isSecured: true
    }
  ];

  sampleUsers.forEach(user => {
    // Create basic profile
    const basicProfile = createMockProfile(user.userId, user.email, user.name, user.language);
    
    // Handle waitlist users
    if (user.isWaitlist) {
      basicProfile.waitlist_bonus = 25;
      
      // User with wallet that already completed secure account setup
      if (user.isSecured) {
        basicProfile.wlw = true;
        basicProfile.sei_wallet = {
          address: 'sei1mock' + crypto.randomBytes(8).toString('hex'),
          public_key: 'sei_pub_' + crypto.randomBytes(16).toString('hex')
        };
        basicProfile.eth_wallet = {
          address: '0x' + crypto.randomBytes(20).toString('hex'),
          public_key: 'eth_pub_' + crypto.randomBytes(16).toString('hex')
        };
        
        // Mock secure account data (already setup with passphrase "testpass123")
        const testPassphrase = 'testpass123';
        const salt = 'x0xmbtbles0x' + testPassphrase;
        const derivedKey = crypto.pbkdf2Sync(testPassphrase, salt, 390000, 32, 'sha256');
        const keyBase64 = derivedKey.toString('base64');
        const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');
        
        basicProfile.passphrase_hash = passphraseHash;
        basicProfile.encrypted_wallet_data = {
          encrypted_mnemonic: 'mock_encrypted_' + crypto.randomBytes(32).toString('hex'),
          salt: crypto.randomBytes(16).toString('hex'),
          nonce: crypto.randomBytes(12).toString('hex'),
          sei_address: basicProfile.sei_wallet.address,
          eth_address: basicProfile.eth_wallet.address
        };
        basicProfile.secured_at = new Date().toISOString();
      }
      // User needs first-time setup (no wlw flag, no passphrase_hash)
      else if (user.needsSetup) {
        // Don't set wlw flag - they need to complete setup first
        basicProfile.wlw = false;
      }
    }
    
    // Add legacy wallet data for non-waitlist users who have wallets
    if (user.hasWallet && !user.isWaitlist) {
      basicProfile.wlw = true;
      basicProfile.waitlist_bonus = 25;
      basicProfile.sei_wallet = {
        address: 'sei1mock' + crypto.randomBytes(8).toString('hex'),
        public_key: 'sei_pub_' + crypto.randomBytes(16).toString('hex')
      };
      basicProfile.eth_wallet = {
        address: '0x' + crypto.randomBytes(20).toString('hex'),
        public_key: 'eth_pub_' + crypto.randomBytes(16).toString('hex')
      };
      // Mock encrypted mnemonic data (for testing recovery flow)
      basicProfile.encrypted_mnemonic = 'mock_encrypted_' + crypto.randomBytes(32).toString('hex');
      basicProfile.salt = crypto.randomBytes(16).toString('hex');
      basicProfile.nonce = crypto.randomBytes(12).toString('hex');
    }
    
    mockDatabase.profiles.set(user.userId, basicProfile);

    // Create offchain profile
    const offchainProfile = createMockOffchainProfile(user.userId, '0x' + crypto.randomBytes(20).toString('hex'));
    offchainProfile.xp = user.xp;
    offchainProfile.streak = user.streak;
    mockDatabase.offchainProfiles.set(user.userId, offchainProfile);
  });

  console.log('✅ Mock data initialized with sample users:');
  console.log('   • waitlist@example.com (needs first-time setup)');
  console.log('   • secured@example.com (already secured, passphrase: testpass123)');
}

initializeMockData();

// Middleware for JWT authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'missing_token', 
      message: 'No authentication token provided' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ 
        error: 'invalid_token', 
        message: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
}

// Helper functions
function generateToken(payload, expiresIn = '15m') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function generateRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  mockDatabase.refreshTokens.add(token);
  return token;
}

function createMockProfile(userId, email, name, language) {
  return {
    userId,
    email,
    name,
    initial_language_to_learn: language,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createMockOffchainProfile(userId, ethWalletAddress) {
  return {
    userId,
    ethWalletAddress,
    xp: Math.floor(Math.random() * 500),
    streak: Math.floor(Math.random() * 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// =============================================================================
// AUTH SERVICE ENDPOINTS
// =============================================================================

// POST /auth/wallet/signup - Handle initial signup with user info
apiRouter.post('/auth/wallet/signup', (req, res) => {
  const { name, email, language_to_learn } = req.body;

  // Validate required fields
  if (!email) {
    return res.status(400).json({ message: "email required" });
  }
  if (!name) {
    return res.status(400).json({ message: "name required" });
  }
  if (!language_to_learn) {
    return res.status(400).json({ message: "language_to_learn required" });
  }

  // Check email uniqueness
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);
  
  if (existingProfile) {
    return res.status(409).json({ message: "Email already registered" });
  }

  // Generate a unique user ID (matching real auth service - 64 char hex)
  const userId = crypto.randomBytes(32).toString('hex');
  
  // Mock wallet addresses for development
  const walletAddress = 'sei1mock' + crypto.randomBytes(8).toString('hex');
  const ethWalletAddress = '0x' + crypto.randomBytes(20).toString('hex');

  // Create user if doesn't exist
  if (!mockDatabase.users.has(userId)) {
    mockDatabase.users.set(userId, {
      userId,
      email,
      name,
      language_to_learn,
      walletAddress,
      ethWalletAddress
    });

    // Create basic profile (like profile service)
    const basicProfile = {
      userId,
      email,
      name,
      initial_language_to_learn: language_to_learn,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDatabase.profiles.set(userId, basicProfile);

    // Create offchain profile (like offchain-profile service)
    const offchainProfile = {
      userId,
      ethWalletAddress,
      xp: 0,
      streak: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDatabase.offchainProfiles = mockDatabase.offchainProfiles || new Map();
    mockDatabase.offchainProfiles.set(userId, offchainProfile);
  }

  const accessToken = generateToken({
    sub: userId,
    type: 'access',
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const refreshToken = generateRefreshToken(userId);

  res.json({
    token: accessToken,
    refreshToken,
    userId
  });
});

// POST /auth/wallet - Handle wallet authentication for existing users
apiRouter.post('/auth/wallet', (req, res) => {
  const { userId, walletAddress, ethWalletAddress, signupMethod } = req.body;

  console.log('Wallet authentication request:', req.body);

  // For wallet auth, userId should be the email
  if (!userId) {
    return res.status(400).json({ message: "userId (email) required" });
  }

  // Find existing user profile by email
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === userId);
  
  if (!existingProfile) {
    return res.status(404).json({ message: "User not found. Please complete account setup first." });
  }

  // Check if user has completed wallet setup
  if (!existingProfile.encrypted_mnemonic) {
    return res.status(400).json({ message: "Wallet setup not completed. Please complete setup first." });
  }

  // Find corresponding user in users table
  const user = Array.from(mockDatabase.users.values())
    .find(u => u.userId === existingProfile.userId);

  if (!user) {
    return res.status(404).json({ message: "User account not found" });
  }

  // Generate authentication token
  const accessToken = generateToken({
    sub: existingProfile.userId,
    type: 'access',
    walletAddress: walletAddress || user.walletAddress,
    ethWalletAddress: ethWalletAddress || user.ethWalletAddress,
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const refreshToken = generateRefreshToken(existingProfile.userId);

  console.log('Wallet authentication successful for user:', existingProfile.userId);

  res.json({
    token: accessToken,
    refreshToken,
    userId: existingProfile.userId,
    email: existingProfile.email,
    walletAddress,
    ethWalletAddress
  });
});

// POST /auth/refresh - Refresh access token
apiRouter.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token required"
    });
  }

  if (!mockDatabase.refreshTokens.has(refreshToken)) {
    return res.status(401).json({
      message: "Invalid or revoked refresh token"
    });
  }

  // Find user by refresh token (simplified for mock)
  const userId = 'mock-user-' + crypto.randomBytes(4).toString('hex');
  
  const newAccessToken = generateToken({
    sub: userId,
    type: 'access',
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const newRefreshToken = generateRefreshToken(userId);
  
  // Remove old refresh token
  mockDatabase.refreshTokens.delete(refreshToken);

  res.json({
    token: newAccessToken,
    refreshToken: newRefreshToken,
    userId
  });
});

// POST /auth/logout - Logout and invalidate tokens
apiRouter.post('/auth/logout', authenticateToken, (req, res) => {
  // In a real implementation, we'd invalidate all refresh tokens for this user
  res.json({ message: 'Successfully logged out' });
});

// GET /auth/validate - Validate current token
apiRouter.get('/auth/validate', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const basicProfile = mockDatabase.profiles.get(userId);
  
  res.json({
    userId: userId,
    email: basicProfile?.email,
    name: basicProfile?.name
  });
});

// POST /auth/revoke - Revoke a specific refresh token
apiRouter.post('/auth/revoke', authenticateToken, (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing refresh token'
    });
  }

  if (!mockDatabase.refreshTokens.has(refreshToken)) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Token not found'
    });
  }

  mockDatabase.refreshTokens.delete(refreshToken);
  res.json({ message: 'Token revoked' });
});

// =============================================================================
// PROFILE SERVICE ENDPOINTS (Basic profile info)
// =============================================================================

// GET /profile/:userId - Get profile by user ID
apiRouter.get('/profile/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;

  // Only allow users to access their own profile
  if (req.user.sub !== userId) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'You can only access your own profile'
    });
  }

  const profile = mockDatabase.profiles.get(userId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Profile not found'
    });
  }

  res.json(profile);
});

// POST /profile - Create new profile
apiRouter.post('/profile', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const { email, name, initial_language_to_learn } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'missing_email',
      message: 'Email is required'
    });
  }

  if (!name) {
    return res.status(400).json({
      error: 'missing_name',
      message: 'Name is required'
    });
  }

  if (!initial_language_to_learn) {
    return res.status(400).json({
      error: 'missing_language',
      message: 'Initial language to learn is required'
    });
  }

  // Check if profile already exists
  if (mockDatabase.profiles.has(userId)) {
    const existingProfile = mockDatabase.profiles.get(userId);
    return res.status(200).json(existingProfile);
  }

  const profile = createMockProfile(userId, email, name, initial_language_to_learn);
  mockDatabase.profiles.set(userId, profile);

  res.status(201).json(profile);
});

// PATCH /profile/:userId - Update profile data
apiRouter.patch('/profile/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const { email, name, initial_language_to_learn } = req.body;

  // Only allow users to update their own profile
  if (req.user.sub !== userId) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'You can only update your own profile'
    });
  }

  const profile = mockDatabase.profiles.get(userId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Profile not found'
    });
  }

  if (email !== undefined) profile.email = email;
  if (name !== undefined) profile.name = name;
  if (initial_language_to_learn !== undefined) profile.initial_language_to_learn = initial_language_to_learn;
  profile.updatedAt = new Date().toISOString();

  mockDatabase.profiles.set(userId, profile);
  res.status(204).send();
});

// GET /profile/email/:email - Get profile by email (for uniqueness check)
apiRouter.get('/profile/email/:email', (req, res) => {
  const { email } = req.params;
  
  const profile = Array.from(mockDatabase.profiles.values())
    .find(p => p.email === email);
  
  if (!profile) {
    return res.status(404).json({ 
      error: 'not_found', 
      message: 'Profile not found' 
    });
  }
  
  res.json(profile);
});

// =============================================================================
// OFFCHAIN PROFILE SERVICE ENDPOINTS (XP, streak, wallet data)
// =============================================================================

// GET /profile/:userId (offchain) - Get offchain profile data
apiRouter.get('/offchain/profile/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;

  // Only allow users to access their own profile
  if (req.user.sub !== userId) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'You can only access your own profile'
    });
  }

  const profile = mockDatabase.offchainProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Profile not found'
    });
  }

  res.json(profile);
});

// POST /offchain/profile - Create/update offchain profile
apiRouter.post('/offchain/profile', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  
  // Check if profile already exists
  const existingProfile = mockDatabase.offchainProfiles.get(userId);
  if (existingProfile) {
    // Update timestamp and return existing profile
    existingProfile.updatedAt = new Date().toISOString();
    mockDatabase.offchainProfiles.set(userId, existingProfile);
    return res.status(200).json(existingProfile);
  }

  // Create new offchain profile
  const profile = createMockOffchainProfile(userId, req.user.ethWalletAddress);
  mockDatabase.offchainProfiles.set(userId, profile);

  res.status(201).json(profile);
});

// PATCH /offchain/profile/:userId - Update offchain profile data
apiRouter.patch('/offchain/profile/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const { xp, streak } = req.body;

  // Only allow users to update their own profile
  if (req.user.sub !== userId) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'You can only update your own profile'
    });
  }

  const profile = mockDatabase.offchainProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Profile not found'
    });
  }

  if (xp !== undefined) profile.xp = xp;
  if (streak !== undefined) profile.streak = streak;
  profile.updatedAt = new Date().toISOString();

  mockDatabase.offchainProfiles.set(userId, profile);
  res.status(204).send();
});

// PATCH /points/add - Add XP points to profile
apiRouter.patch('/points/add', authenticateToken, (req, res) => {
  const { userId, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: 'invalid_amount',
      message: 'Amount must be a positive number'
    });
  }

  // Only allow users to add points to their own profile
  const targetUserId = userId || req.user.sub;
  if (req.user.sub !== targetUserId) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'You can only add points to your own profile'
    });
  }

  const profile = mockDatabase.offchainProfiles.get(targetUserId);
  if (!profile) {
    return res.status(404).json({
      error: 'profile_not_found',
      message: 'Profile not found for the specified user'
    });
  }

  profile.xp += amount;
  profile.updatedAt = new Date().toISOString();
  mockDatabase.offchainProfiles.set(targetUserId, profile);

  res.status(204).send();
});

// GET /points/leaderboard - Get XP leaderboard
apiRouter.get('/points/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  const leaderboard = Array.from(mockDatabase.offchainProfiles.values())
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)
    .map(profile => ({
      userId: profile.userId,
      xp: profile.xp,
      streak: profile.streak
    }));

  res.json(leaderboard);
});

// =============================================================================
// WALLET SERVICE ENDPOINTS
// =============================================================================

// GET /wallet/email/{email} - Get user profile by email for wallet operations
apiRouter.get('/wallet/email/:email', (req, res) => {
  const { email } = req.params;

  // Find user profile by email
  const userProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!userProfile) {
    return res.status(404).json({
      error: 'profile_not_found',
      message: 'Profile not found'
    });
  }

  // Return wallet-related profile data
  const walletProfile = {
    email: userProfile.email,
    encrypted_mnemonic: userProfile.encrypted_mnemonic,
    salt: userProfile.salt,
    nonce: userProfile.nonce,
    sei_wallet: userProfile.sei_wallet,
    eth_wallet: userProfile.eth_wallet,
    wlw: userProfile.wlw,
    waitlist_bonus: userProfile.waitlist_bonus
  };

  res.json(walletProfile);
});

// POST /wallet/waitlist-signup - Handle waitlist user signup with encrypted wallet data
apiRouter.post('/wallet/waitlist-signup', (req, res) => {
  const {
    email,
    passphrase,
    encrypted_mnemonic,
    salt,
    nonce,
    sei_address,
    sei_public_key,
    eth_address,
    eth_public_key
  } = req.body;

  // Validate required fields
  if (!email || !passphrase || !encrypted_mnemonic || !salt || !nonce || 
      !sei_address || !sei_public_key || !eth_address || !eth_public_key) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required fields'
    });
  }

  // Find existing user profile
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'profile_not_found',
      message: 'Profile not found for waitlist signup'
    });
  }

  // Check if user already has a wallet
  if (existingProfile.wlw) {
    return res.status(400).json({
      error: 'wallet_exists',
      message: 'User already has a wallet'
    });
  }

  // Create user entry in users table if it doesn't exist
  if (!mockDatabase.users.has(existingProfile.userId)) {
    mockDatabase.users.set(existingProfile.userId, {
      userId: existingProfile.userId,
      email: existingProfile.email,
      name: existingProfile.name,
      language_to_learn: existingProfile.initial_language_to_learn,
      walletAddress: sei_address,
      ethWalletAddress: eth_address
    });
  }

  // Update profile with wallet data
  existingProfile.wlw = true;
  existingProfile.waitlist_bonus = 25;
  existingProfile.sei_wallet = {
    address: sei_address,
    public_key: sei_public_key
  };
  existingProfile.eth_wallet = {
    address: eth_address,
    public_key: eth_public_key
  };
  existingProfile.encrypted_mnemonic = encrypted_mnemonic;
  existingProfile.salt = salt;
  existingProfile.nonce = nonce;
  existingProfile.updatedAt = new Date().toISOString();

  // Update in mock database
  mockDatabase.profiles.set(existingProfile.userId, existingProfile);

  res.json({
    status: 'wallet_created',
    sei_address: sei_address,
    eth_address: eth_address,
    waitlist_bonus: 25,
    message: 'Wallet created successfully for waitlist user'
  });
});

// POST /wallet/secure-account - First-time passphrase setup for waitlist users (following pw_security.py pattern)
apiRouter.post('/wallet/secure-account', (req, res) => {
  const { email, passphrase, encrypted_wallet_data } = req.body;

  if (!email || !passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email and passphrase are required'
    });
  }

  // Find waitlist user by email
  const userProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!userProfile) {
    return res.status(404).json({
      error: 'user_not_found',
      message: 'Email not found in waitlist'
    });
  }

  // Check if user already has secure account setup
  if (userProfile.wlw === true && userProfile.passphrase_hash) {
    return res.status(409).json({
      error: 'already_secured',
      message: 'Account already has secure passphrase setup'
    });
  }

  // Derive key from passphrase (mimicking pw_security.py PBKDF2 process)
  const crypto = require('crypto');
  const salt = 'x0xmbtbles0x' + passphrase; // Using same salt pattern as pw_security.py
  const iterations = 390000; // Same as pw_security.py
  
  try {
    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
    const keyBase64 = derivedKey.toString('base64');
    
    // Hash the key (same as pw_security.py: hashlib.sha256(key).hexdigest())
    const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');
    
    // Update user profile with secure account data
    userProfile.wlw = true;
    userProfile.passphrase_hash = passphraseHash;
    userProfile.encrypted_wallet_data = encrypted_wallet_data;
    userProfile.secured_at = new Date().toISOString();
    userProfile.updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Secure account setup completed',
      user_id: userProfile.userId
    });
  } catch (error) {
    console.error('Error setting up secure account:', error);
    res.status(500).json({
      error: 'setup_failed',
      message: 'Failed to setup secure account'
    });
  }
});

// POST /wallet/recover - Authenticate user and return encrypted wallet data
apiRouter.post('/wallet/recover', (req, res) => {
  const { email, passphrase } = req.body;

  if (!email || !passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email and passphrase are required'
    });
  }

  // Find user profile by email
  const userProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!userProfile) {
    return res.status(404).json({
      error: 'user_not_found',
      message: 'Email not found'
    });
  }

  // Check if user needs to setup secure account first
  if (!userProfile.passphrase_hash) {
    return res.status(409).json({
      error: 'setup_required',
      message: 'User needs to setup secure account first',
      setup_required: true
    });
  }

  // Derive key from provided passphrase (same process as secure-account)
  const crypto = require('crypto');
  const salt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  
  try {
    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
    const keyBase64 = derivedKey.toString('base64');
    
    // Hash the key
    const providedHash = crypto.createHash('sha256').update(keyBase64).digest('hex');
    
    // Verify hash matches stored hash
    if (providedHash !== userProfile.passphrase_hash) {
      return res.status(401).json({
        error: 'invalid_passphrase',
        message: 'Invalid passphrase'
      });
    }

    // Authentication successful - return encrypted wallet data for client-side decryption
    res.json({
      success: true,
      encrypted_wallet_data: userProfile.encrypted_wallet_data,
      user_id: userProfile.userId,
      waitlist_bonus: userProfile.waitlist_bonus || 0
    });
  } catch (error) {
    console.error('Error during wallet recovery:', error);
    res.status(500).json({
      error: 'recovery_failed',
      message: 'Failed to recover wallet'
    });
  }
});

// POST /wallet/register - Register wallet for existing user
apiRouter.post('/wallet/register', (req, res) => {
  const { email, passphrase, encrypted_mnemonic, salt, nonce } = req.body;

  if (!email || !passphrase || !encrypted_mnemonic || !salt || !nonce) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'All fields are required'
    });
  }

  // Find existing user profile
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'profile_not_found',
      message: 'Profile not found for registration'
    });
  }

  // Update profile with encrypted mnemonic data
  existingProfile.encrypted_mnemonic = encrypted_mnemonic;
  existingProfile.salt = salt;
  existingProfile.nonce = nonce;
  existingProfile.updatedAt = new Date().toISOString();

  // Update in mock database
  mockDatabase.profiles.set(existingProfile.userId, existingProfile);

  res.json({
    status: 'registered',
    message: 'Wallet registered successfully'
  });
});

// GET /health - Health check for wallet service
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =============================================================================
// LEARNING SERVICE ENDPOINTS
// =============================================================================

// GET /learning/progress - Get user's learning progress
apiRouter.get('/learning/progress', (req, res) => {
  const { userId, minimal } = req.query;

  if (!userId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing userId parameter'
    });
  }

  let progress = mockDatabase.progress.get(userId);
  if (!progress) {
    // Create default progress
    progress = {
      userId,
      currentLessonId: 'lesson-1',
      currentWordId: 'word-1',
      nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      completedLessons: [],
      completedWords: [],
      lastActivity: new Date().toISOString(),
      streak: 0,
      level: 1,
      totalXp: 0
    };
    mockDatabase.progress.set(userId, progress);
  }

  if (minimal === 'true') {
    res.json({
      currentLessonId: progress.currentLessonId,
      currentWordId: progress.currentWordId,
      nextWordAvailableAt: progress.nextWordAvailableAt
    });
  } else {
    res.json(progress);
  }
});

// POST /learning/progress - Update user's learning progress
apiRouter.post('/learning/progress', (req, res) => {
  const { userId, currentLessonId, currentWordId, nextWordAvailableAt } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing userId'
    });
  }

  let progress = mockDatabase.progress.get(userId) || {
    userId,
    completedLessons: [],
    completedWords: [],
    lastActivity: new Date().toISOString(),
    streak: 0,
    level: 1,
    totalXp: 0
  };

  if (currentLessonId) progress.currentLessonId = currentLessonId;
  if (currentWordId) progress.currentWordId = currentWordId;
  if (nextWordAvailableAt) progress.nextWordAvailableAt = nextWordAvailableAt;
  
  progress.lastActivity = new Date().toISOString();
  mockDatabase.progress.set(userId, progress);

  res.json({
    message: 'Progress updated successfully',
    currentLessonId: progress.currentLessonId,
    currentWordId: progress.currentWordId,
    nextWordAvailableAt: progress.nextWordAvailableAt
  });
});

// GET /learning/progress/history - Get lesson completion history
apiRouter.get('/learning/progress/history', (req, res) => {
  const { userId, limit } = req.query;

  if (!userId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing userId parameter'
    });
  }

  const maxLimit = parseInt(limit) || 10;
  const userCompletions = mockDatabase.completions.get(userId) || [];
  
  const completions = userCompletions.slice(0, maxLimit).map(completion => ({
    userId,
    lessonId: completion.lessonId,
    wordId: completion.wordId,
    date: completion.date,
    pronunciationScore: completion.pronunciationScore,
    grammarScore: completion.grammarScore,
    pass: completion.pass,
    timestamp: completion.timestamp
  }));

  res.json({ completions });
});

// GET /learning/daily - Get vocabulary for current lesson
apiRouter.get('/learning/daily', (req, res) => {
  const { userId } = req.query;
  
  // Return mock vocabulary
  const vocabulary = [
    {
      id: 'word-1',
      term: 'hello',
      definition: 'a greeting',
      example: 'Hello, how are you?'
    },
    {
      id: 'word-2',
      term: 'goodbye',
      definition: 'a farewell',
      example: 'Goodbye, see you later!'
    },
    {
      id: 'word-3',
      term: 'thanks',
      definition: 'expression of gratitude',
      example: 'Thanks for your help.'
    }
  ];

  res.json(vocabulary);
});

// POST /learning/daily/complete - Submit daily word completion
apiRouter.post('/learning/daily/complete', (req, res) => {
  const { userId, lessonId, wordId, audio, transcript, detailLevel, languageCode } = req.body;

  if (!userId || !lessonId || !wordId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required fields: userId, lessonId, wordId'
    });
  }

  // Mock pronunciation assessment based on detail level
  const level = detailLevel || 'phoneme';
  const pronunciationScore = 0.75 + Math.random() * 0.25; // Random score between 0.75-1.0
  const grammarScore = 0.8 + Math.random() * 0.2;
  const pass = pronunciationScore >= 0.7;

  const baseResponse = {
    pass,
    pronunciationScore,
    grammarScore,
    expected: transcript || 'I am saying hello.',
    corrected: transcript || 'I am saying hello.'
  };

  if (level === 'summary') {
    res.json(baseResponse);
    return;
  }

  // Add detailed information for phoneme and detailed levels
  const detailedResponse = {
    ...baseResponse,
    wordDetails: [
      {
        word: 'hello',
        score: pronunciationScore,
        startTime: 0.5,
        endTime: 0.9,
        confidence: 0.95,
        issues: pronunciationScore < 0.8 ? ['stress'] : []
      }
    ],
    phonemeDetails: [
      {
        phoneme: 'HH',
        score: 0.75,
        startTime: 0.5,
        endTime: 0.6,
        issues: []
      },
      {
        phoneme: 'AH',
        score: 0.9,
        startTime: 0.6,
        endTime: 0.7,
        issues: []
      },
      {
        phoneme: 'L',
        score: 0.95,
        startTime: 0.7,
        endTime: 0.8,
        issues: []
      },
      {
        phoneme: 'OW',
        score: 0.8,
        startTime: 0.8,
        endTime: 0.9,
        issues: pronunciationScore < 0.8 ? ['stress'] : []
      }
    ],
    feedback: pronunciationScore < 0.8 
      ? ['Work on the stress pattern in the word \'hello\'', 'Your pronunciation of \'h\' sound could be improved']
      : ['Good pronunciation!'],
    transcript: transcript || 'I am saying hello.'
  };

  // Store completion
  const completion = {
    userId,
    lessonId,
    wordId,
    date: new Date().toISOString().split('T')[0],
    pronunciationScore,
    grammarScore,
    pass,
    timestamp: new Date().toISOString()
  };

  if (!mockDatabase.completions.has(userId)) {
    mockDatabase.completions.set(userId, []);
  }
  mockDatabase.completions.get(userId).unshift(completion);

  res.json(detailedResponse);
});

// POST /learning/daily/tts/sentence - Generate TTS for sentence
apiRouter.post('/learning/daily/tts/sentence', (req, res) => {
  const { text, languageCode } = req.body;

  if (!text) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required text'
    });
  }

  // Return mock MP3 data (minimal header)
  res.set({
    'Content-Type': 'audio/mp3',
    'Content-Disposition': 'attachment; filename="pronunciation_example.mp3"'
  });
  
  // Send minimal MP3 header (for demo purposes)
  const mockMp3Header = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  
  res.send(mockMp3Header);
});

// GET /learning/daily/tts/:wordId - Get TTS for vocabulary word
apiRouter.get('/learning/daily/tts/:wordId', (req, res) => {
  const { wordId } = req.params;
  const { languageCode } = req.query;

  if (!wordId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing word ID'
    });
  }

  // Return mock MP3 data
  res.set({
    'Content-Type': 'audio/mp3',
    'Content-Disposition': `attachment; filename="word_${wordId}.mp3"`
  });
  
  const mockMp3Header = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  
  res.send(mockMp3Header);
});

// GET /learning/daily/pronunciation/history/:wordId - Get pronunciation history
apiRouter.get('/learning/daily/pronunciation/history/:wordId', (req, res) => {
  const { wordId } = req.params;
  const { userId, view } = req.query;

  if (!wordId || !userId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing word ID or user ID'
    });
  }

  const historyKey = `${userId}-${wordId}`;
  let history = mockDatabase.pronunciationHistory.get(historyKey);

  if (!history) {
    // Create mock history
    history = {
      wordId,
      userId,
      attempts: [
        {
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          pronunciationScore: 0.85,
          pass: true,
          feedback: ['Work on the stress pattern in the word']
        }
      ],
      count: 1
    };
    mockDatabase.pronunciationHistory.set(historyKey, history);
  }

  if (view === 'detailed') {
    // Add detailed information to attempts
    history.attempts = history.attempts.map(attempt => ({
      ...attempt,
      userId,
      lessonId: 'lesson-1',
      wordId,
      grammarScore: 0.9,
      wordDetails: [
        {
          word: 'hello',
          score: attempt.pronunciationScore,
          startTime: 0.5,
          endTime: 0.9,
          confidence: 0.95,
          issues: ['stress']
        }
      ],
      phonemeDetails: [
        {
          phoneme: 'HH',
          score: 0.75,
          startTime: 0.5,
          endTime: 0.6,
          issues: []
        }
      ],
      pronunciationFeedback: attempt.feedback,
      alignmentId: 'align-123',
      scoringId: 'score-123',
      evaluationId: 'eval-123'
    }));
  }

  res.json(history);
});

// GET /learning/lessons/:lessonId - Get lesson details
apiRouter.get('/learning/lessons/:lessonId', (req, res) => {
  const { lessonId } = req.params;

  if (!lessonId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing lessonId'
    });
  }

  const lesson = mockDatabase.lessons.get(lessonId);
  if (!lesson) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Lesson not found'
    });
  }

  res.json(lesson);
});

// GET /learning/lessons - Get lessons by language and level
apiRouter.get('/learning/lessons', (req, res) => {
  const { language, level } = req.query;

  if (!language || !level) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required parameters: language, level'
    });
  }

  const lessons = Array.from(mockDatabase.lessons.values())
    .filter(lesson => lesson.language === language && lesson.level === level);

  res.json({ lessons });
});

// GET /learning/quiz - Get quiz words
apiRouter.get('/learning/quiz', (req, res) => {
  const { userId } = req.query;

  const words = [
    {
      id: 'word-1',
      term: 'hello',
      definition: 'a greeting',
      example: 'Hello, how are you?'
    },
    {
      id: 'word-2',
      term: 'goodbye',
      definition: 'a farewell',
      example: 'Goodbye, see you later!'
    }
  ];

  res.json({
    words,
    expected: 'I am practicing hello, goodbye, thanks, please, sorry.'
  });
});

// POST /learning/quiz/submit - Submit quiz answers
apiRouter.post('/learning/quiz/submit', (req, res) => {
  const { userId, transcript } = req.body;

  if (!userId || !transcript) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required fields: userId, transcript'
    });
  }

  const score = 0.9 + Math.random() * 0.1; // Random score between 0.9-1.0
  const pass = score >= 0.8;

  res.json({
    score,
    pass,
    corrected: transcript,
    expected: 'I am practicing hello, goodbye, thanks, please, sorry.'
  });
});

// =============================================================================
// REWARD SERVICE ENDPOINTS
// =============================================================================

// POST /ethereum/sign-transaction - Sign Ethereum transaction
apiRouter.post('/ethereum/sign-transaction', authenticateToken, (req, res) => {
  const { transaction } = req.body;

  if (!transaction) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing transaction data'
    });
  }

  // Return mock signed transaction
  res.json({
    signedTransaction: '0x' + crypto.randomBytes(32).toString('hex')
  });
});

// POST /ethereum/sign-message - Sign message with Ethereum wallet
apiRouter.post('/ethereum/sign-message', authenticateToken, (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing message'
    });
  }

  // Return mock signature
  res.json({
    signature: '0x' + crypto.randomBytes(65).toString('hex')
  });
});

// POST /complete - Trigger completion reward
apiRouter.post('/complete', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const { xp = 10, lessonId, wordId } = req.body;

  // Get or create offchain profile
  let offchainProfile = mockDatabase.offchainProfiles.get(userId);
  if (!offchainProfile) {
    offchainProfile = createMockOffchainProfile(userId);
    mockDatabase.offchainProfiles.set(userId, offchainProfile);
  }

  // Update XP and streak
  offchainProfile.xp += xp;
  offchainProfile.streak += 1;
  offchainProfile.updatedAt = new Date().toISOString();

  // Store updated profile
  mockDatabase.offchainProfiles.set(userId, offchainProfile);

  console.log(`✅ Updated user ${userId}: +${xp} XP (total: ${offchainProfile.xp}), streak: ${offchainProfile.streak}`);

  // Return mock transaction hash
  res.json({
    txHash: '0x' + crypto.randomBytes(32).toString('hex')
  });
});

// =============================================================================
// GATEWAY SERVICE ENDPOINTS
// =============================================================================

// GET /dashboard - Get user dashboard data
apiRouter.get('/dashboard', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const basicProfile = mockDatabase.profiles.get(userId);
  const offchainProfile = mockDatabase.offchainProfiles.get(userId);
  
  res.json({
    userId: userId,
    email: basicProfile?.email || 'mock@example.com',
    name: basicProfile?.name || 'Mock User',
    xp: offchainProfile?.xp || 0,
    streak: offchainProfile?.streak || 0,
    yapBalance: '42'
  });
});

// =============================================================================
// HEALTH CHECK ENDPOINTS
// =============================================================================

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.get('/healthz', (req, res) => {
  res.send('ok');
});

// =============================================================================
// MOUNT ROUTES
// =============================================================================

// Mount API routes on both root and /api prefix for flexibility
app.use('/', apiRouter);
app.use('/api', apiRouter);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Mock server error:', err);
  res.status(500).json({
    error: 'server_error',
    message: 'Internal server error',
    details: err.message
  });
});

// =============================================================================
// MOCK DATA INITIALIZATION
// =============================================================================

function initializeLessonsData() {
  // Initialize mock lessons
  const lessons = [
    {
      lesson_id: 'lesson-1',
      title: 'Basic Greetings',
      description: 'Learn basic greetings',
      language: 'english',
      level: 'beginner',
      new_vocabulary: [
        {
          id: 'word-1',
          term: 'hello',
          definition: 'a greeting',
          example: 'Hello, how are you?'
        },
        {
          id: 'word-2',
          term: 'goodbye',
          definition: 'a farewell',
          example: 'Goodbye, see you later!'
        }
      ]
    },
    {
      lesson_id: 'lesson-2',
      title: 'Common Phrases',
      description: 'Learn common phrases',
      language: 'english',
      level: 'beginner',
      new_vocabulary: [
        {
          id: 'word-3',
          term: 'thanks',
          definition: 'expression of gratitude',
          example: 'Thanks for your help.'
        },
        {
          id: 'word-4',
          term: 'please',
          definition: 'polite request',
          example: 'Please help me.'
        }
      ]
    }
  ];

  lessons.forEach(lesson => {
    mockDatabase.lessons.set(lesson.lesson_id, lesson);
  });

  console.log('Mock lessons initialized with', lessons.length, 'lessons');
}

// Initialize lessons data on startup
initializeLessonsData();

// =============================================================================
// MOUNT ROUTES
// =============================================================================

// Mount all routes on both root and /api prefix for flexibility
app.use('/', apiRouter);
app.use('/api', apiRouter);

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(PORT, () => {
  console.log('🎯 YAP Mock Server started successfully!');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('   • Auth Service: /auth/*');
  console.log('   • Profile Service: /profile/*');
  console.log('   • Wallet Service: /wallet/*');
  console.log('   • Learning Service: /learning/*');
  console.log('   • Reward Service: /ethereum/*, /complete');
  console.log('   • Gateway Service: /dashboard');
  console.log('   • Health Check: /health, /healthz');
  console.log('');
  console.log('🔑 Authentication:');
  console.log('   • Use POST /auth/wallet to get tokens');
  console.log('   • Include "Authorization: Bearer <token>" header for protected endpoints');
  console.log('');
  console.log('💰 Wallet Service Test Data:');
  console.log('   • Email: waitlist@example.com (has encrypted wallet data)');
  console.log('   • Test passphrase: any string 6+ characters for mock recovery');
  console.log('');
  console.log('📚 API Documentation: See API_SPECIFICATION.md');
});

module.exports = app;
