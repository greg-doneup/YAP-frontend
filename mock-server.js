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

// Base64 helpers for JWT token handling
function atob(str) {
  return Buffer.from(str, "base64").toString("binary");
}

function btoa(str) {
  return Buffer.from(str, "binary").toString("base64");
}

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
  
  console.log('[AUTH] Authenticating token:', token ? token.substring(0, 20) + '...' : 'none');

  if (!token) {
    console.log('[AUTH] No token provided');
    return res.status(401).json({ 
      error: 'missing_token', 
      message: 'No authentication token provided' 
    });
  }

  // Check if it's a mock token from frontend registration (base64 encoded with mocksignature)
  if (token.includes('mocksignature')) {
    console.log('[AUTH] Detected mock token from registration flow, allowing request');
    
    // For mock tokens, extract user from payload
    try {
      // If it's our encoded mock token from registration
      if (token.split('.').length === 3) {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        req.user = {
          sub: payload.email || 'mock-user',
          email: payload.email,
          sei_address: payload.sei_address,
          eth_address: payload.eth_address,
          type: 'access'
        };
      } else {
        // For simple mock tokens
        req.user = {
          sub: 'mock-user',
          email: 'mock@user.com',
          sei_address: 'sei1mock',
          eth_address: '0xmock',
          type: 'access'
        };
      }
      return next();
    } catch (e) {
      console.error('[AUTH] Error parsing mock token:', e);
      // Even if parsing fails, allow the request in development
      req.user = { 
        sub: 'mock-user',
        email: 'mock@user.com',
        type: 'access'
      };
      return next();
    }
  }

  // Regular JWT validation for all other tokens (including registration-generated tokens)
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('[AUTH] JWT verification failed:', err.message);
      console.log('[AUTH] Token details:', token.substring(0, 50) + '...');
      
      // Try to decode token payload to see what's inside (without verification)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('[AUTH] Token payload:', payload);
        }
      } catch (decodeErr) {
        console.log('[AUTH] Could not decode token payload:', decodeErr.message);
      }
      
      return res.status(401).json({ 
        error: 'invalid_token', 
        message: 'Invalid or expired token' 
      });
    }
    console.log('[AUTH] JWT verification successful for user:', user.sub);
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

// POST /auth/wallet/signup - Handle standard registration with encrypted wallet data (non-waitlist)
apiRouter.post('/auth/wallet/signup', (req, res) => {
  const { 
    name, 
    email, 
    language_to_learn, 
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
  if (!email) {
    return res.status(400).json({ message: "email required" });
  }
  if (!name) {
    return res.status(400).json({ message: "name required" });
  }
  if (!language_to_learn) {
    return res.status(400).json({ message: "language_to_learn required" });
  }
  if (!passphrase) {
    return res.status(400).json({ message: "passphrase required" });
  }
  if (!encrypted_mnemonic || !salt || !nonce || !sei_address || !eth_address) {
    return res.status(400).json({ message: "encrypted wallet data required" });
  }

  // Check email uniqueness
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);
  
  if (existingProfile) {
    return res.status(409).json({ message: "Email already registered" });
  }

  // Generate a unique user ID (matching real auth service - 64 char hex)
  const userId = crypto.randomBytes(32).toString('hex');
  
  // Derive passphrase hash (same as wallet service secure-account endpoint)
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  // Create user entry
  mockDatabase.users.set(userId, {
    userId,
    email,
    name,
    language_to_learn,
    walletAddress: sei_address,
    ethWalletAddress: eth_address
  });

  // Create basic profile with wallet and security data
  const basicProfile = {
    userId,
    email,
    name,
    initial_language_to_learn: language_to_learn,
    wlw: true, // Has wallet
    waitlist_bonus: 0, // Standard registration gets no bonus points
    passphrase_hash: passphraseHash,
    encrypted_wallet_data: {
      encrypted_mnemonic,
      salt,
      nonce,
      sei_address,
      eth_address
    },
    sei_wallet: {
      address: sei_address,
      public_key: sei_public_key || 'sei_pub_' + crypto.randomBytes(16).toString('hex')
    },
    eth_wallet: {
      address: eth_address,
      public_key: eth_public_key || 'eth_pub_' + crypto.randomBytes(16).toString('hex')
    },
    encrypted_mnemonic,
    salt,
    nonce,
    secured_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockDatabase.profiles.set(userId, basicProfile);

  // Create offchain profile with 0 starting points
  const offchainProfile = {
    userId,
    ethWalletAddress: eth_address,
    xp: 0, // Standard accounts start with 0 XP
    streak: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockDatabase.offchainProfiles = mockDatabase.offchainProfiles || new Map();
  mockDatabase.offchainProfiles.set(userId, offchainProfile);

  const accessToken = generateToken({
    sub: userId,
    type: 'access',
    walletAddress: sei_address,
    ethWalletAddress: eth_address,
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const refreshToken = generateRefreshToken(userId);

  console.log(`✅ Standard registration completed for ${email} - no bonus points`);

  res.json({
    token: accessToken,
    refreshToken,
    userId,
    walletAddress: sei_address,
    ethWalletAddress: eth_address,
    starting_points: 0, // Explicitly show no bonus points for standard registration
    message: 'Standard account created successfully'
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

// Debug endpoint to verify token format
apiRouter.get('/auth/debug-token', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(400).json({ message: 'No token provided in Authorization header' });
  }
  
  // Basic token structure check
  const tokenParts = token.split('.');
  
  let response = {
    token_format: tokenParts.length === 3 ? 'JWT format' : 'Non-standard format',
    token_prefix: token.substring(0, 20) + '...'
  };
  
  // Attempt to parse if it's in JWT format
  if (tokenParts.length === 3) {
    try {
      const header = JSON.parse(atob(tokenParts[0]));
      response.header = header;
      
      const payload = JSON.parse(atob(tokenParts[1]));
      // Don't show full payload in response for security
      response.payload = {
        has_email: !!payload.email,
        has_address: !!payload.sei_address || !!payload.eth_address,
        exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none',
        iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'none'
      };
    } catch (e) {
      response.parse_error = e.message;
    }
  }
  
  res.json(response);
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
// MOCK BLOCKCHAIN RPC ENDPOINT
// =============================================================================

// Handle JSON-RPC requests for blockchain interaction
apiRouter.post('/mock-rpc', (req, res) => {
  const { method, params, id, jsonrpc } = req.body;
  console.log('[MOCK-RPC] JSON-RPC Request:', { method, params, id });
  
  // Mock responses for common ethers.js RPC calls
  switch (method) {
    case 'eth_chainId':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x9596' // 38284 in hex (SEI testnet chain ID)
      });
      break;
      
    case 'eth_getBlockNumber':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x' + Math.floor(Date.now() / 1000).toString(16) // Mock block number
      });
      break;
      
    case 'eth_gasPrice':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x4a817c800' // 20 Gwei in hex
      });
      break;
      
    case 'eth_getTransactionCount':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x1' // Mock nonce
      });
      break;
      
    case 'eth_getBalance':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x16345785d8a0000' // 1 ETH in wei (hex)
      });
      break;
      
    case 'eth_call':
      // Mock contract calls
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' // Mock result
      });
      break;
      
    case 'eth_sendTransaction':
    case 'eth_sendRawTransaction':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '0x' + crypto.randomBytes(32).toString('hex') // Mock transaction hash
      });
      break;
      
    case 'eth_getTransactionReceipt':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: {
          transactionHash: params[0],
          blockNumber: '0x' + Math.floor(Date.now() / 1000).toString(16),
          gasUsed: '0x5208',
          status: '0x1' // Success
        }
      });
      break;
      
    case 'net_version':
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: '38284' // SEI testnet network ID
      });
      break;
      
    default:
      console.log('[MOCK-RPC] Unhandled method:', method);
      res.json({
        jsonrpc: '2.0',
        id: id,
        result: null
      });
  }
});

// Handle GET requests to RPC endpoint (for health checks)
apiRouter.get('/mock-rpc', (req, res) => {
  console.log('[MOCK-RPC] Health check request');
  res.json({
    status: 'ok',
    message: 'Mock SEI/EVM RPC endpoint for development',
    timestamp: new Date().toISOString(),
    chainId: 38284,
    networkName: 'sei-testnet'
  });
});

// =============================================================================
// MISSING HEALTHZ ENDPOINTS FOR MICROSERVICES
// =============================================================================

// Learning service healthz
apiRouter.get('/learning/healthz', (req, res) => {
  res.send('ok');
});

// TTS service healthz  
apiRouter.get('/daily/healthz', (req, res) => {
  res.send('ok');
});

// Profile service healthz
apiRouter.get('/profile/healthz', (req, res) => {
  res.send('ok');
});

// Offchain service healthz
apiRouter.get('/offchain/healthz', (req, res) => {
  res.send('ok');
});

// Auth service healthz
apiRouter.get('/auth/healthz', (req, res) => {
  res.send('ok');
});

// Wallet service healthz
apiRouter.get('/wallet/healthz', (req, res) => {
  res.send('ok');
});

// Points service healthz
apiRouter.get('/points/healthz', (req, res) => {
  res.send('ok');
});

// Vocabulary service healthz
apiRouter.get('/vocabulary/healthz', (req, res) => {
  res.send('ok');
});

// Metrics service healthz
apiRouter.get('/metrics/healthz', (req, res) => {
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
  console.log('🔧 Additional Services Available:');
  console.log('   • Grammar evaluation: POST /grammar/evaluate');
  console.log('   • TTS generation: POST /daily/tts/sentence');
  console.log('   • Vocabulary search: GET /vocabulary/search');
  console.log('   • Pronunciation history: GET /daily/pronunciation/history/:wordId');
  console.log('   • Security metrics: GET /metrics/security (admin only)');
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

// =============================================================================
// GRAMMAR SERVICE ENDPOINTS
// =============================================================================

// Grammar evaluation endpoint
app.post('/grammar/evaluate', authenticateToken, (req, res) => {
  const { text, language = 'en' } = req.body;
  
  if (!text) {
    return res.status(400).json({
      error: 'Text is required for grammar evaluation'
    });
  }

  // Mock grammar evaluation response
  const mockEvaluation = {
    text: text,
    language: language,
    score: Math.floor(Math.random() * 30) + 70, // Score between 70-100
    errors: [],
    suggestions: [],
    correctedText: text,
    analysisTimestamp: new Date().toISOString()
  };

  // Randomly add some grammar errors for demonstration
  if (Math.random() < 0.3) {
    mockEvaluation.errors.push({
      type: 'grammar',
      message: 'Subject-verb agreement issue',
      start: 0,
      end: 10,
      suggestion: 'Consider checking verb tense'
    });
    mockEvaluation.score -= 10;
  }

  if (Math.random() < 0.2) {
    mockEvaluation.errors.push({
      type: 'spelling',
      message: 'Potential spelling error',
      start: text.length - 5,
      end: text.length,
      suggestion: 'Check spelling'
    });
    mockEvaluation.score -= 5;
  }

  res.json(mockEvaluation);
});

// Grammar service health check
app.get('/grammar/healthz', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'grammar-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// =============================================================================
// ADDITIONAL WALLET SERVICE ENDPOINTS (REST API for Frontend)
// =============================================================================

// GET /wallet/:address/balance - Get token balance for an address
apiRouter.get('/wallet/:address/balance', (req, res) => {
  const { address } = req.params;
  
  if (!address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing wallet address'
    });
  }
  
  // Mock token balance data
  const mockBalance = {
    available: (Math.random() * 1000).toFixed(2),
    staked: (Math.random() * 500).toFixed(2),
    total: '0',
    token: 'YAP',
    decimals: 18
  };
  
  // Calculate total
  mockBalance.total = (parseFloat(mockBalance.available) + parseFloat(mockBalance.staked)).toFixed(2);
  
  console.log(`[WALLET] Balance requested for address: ${address}`);
  res.json(mockBalance);
});

// GET /wallet/:address/transactions - Get transaction history for an address
apiRouter.get('/wallet/:address/transactions', (req, res) => {
  const { address } = req.params;
  const { limit = '10', offset = '0' } = req.query;
  
  if (!address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing wallet address'
    });
  }
  
  const maxLimit = parseInt(limit);
  const offsetNum = parseInt(offset);
  
  // Generate mock transaction history
  const mockTransactions = [];
  for (let i = 0; i < maxLimit; i++) {
    const txId = offsetNum + i;
    const types = ['send', 'receive', 'reward', 'mint'];
    const statuses = ['confirmed', 'confirmed', 'confirmed', 'pending']; // Mostly confirmed
    
    mockTransactions.push({
      hash: '0x' + crypto.randomBytes(32).toString('hex'),
      from: txId % 2 === 0 ? address : '0x' + crypto.randomBytes(20).toString('hex'),
      to: txId % 2 === 0 ? '0x' + crypto.randomBytes(20).toString('hex') : address,
      amount: (Math.random() * 100).toFixed(2),
      timestamp: new Date(Date.now() - txId * 60000).toISOString(), // 1 minute apart
      status: statuses[Math.floor(Math.random() * statuses.length)],
      type: types[Math.floor(Math.random() * types.length)]
    });
  }
  
  console.log(`[WALLET] Transaction history requested for address: ${address} (limit: ${limit}, offset: ${offset})`);
  res.json({ transactions: mockTransactions });
});

// POST /wallet/transfer - Transfer tokens between addresses
apiRouter.post('/wallet/transfer', (req, res) => {
  const { fromAddress, toAddress, amount, signature } = req.body;
  
  if (!fromAddress || !toAddress || !amount) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required fields: fromAddress, toAddress, amount'
    });
  }
  
  if (!signature) {
    return res.status(400).json({
      error: 'invalid_signature',
      message: 'Transaction signature required'
    });
  }
  
  // Validate amount
  const transferAmount = parseFloat(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({
      error: 'invalid_amount',
      message: 'Invalid transfer amount'
    });
  }
  
  // Mock transfer processing
  const txHash = '0x' + crypto.randomBytes(32).toString('hex');
  
  console.log(`[WALLET] Transfer initiated: ${amount} YAP from ${fromAddress} to ${toAddress}`);
  
  // Simulate processing time
  setTimeout(() => {
    console.log(`[WALLET] Transfer confirmed: ${txHash}`);
  }, 2000);
  
  res.json({
    success: true,
    txHash,
    fromAddress,
    toAddress,
    amount,
    timestamp: new Date().toISOString()
  });
});

// GET /wallet/gas-price - Get current gas price estimates
apiRouter.get('/wallet/gas-price', (req, res) => {
  // Mock gas price data (in gwei)
  const basePrice = 20 + Math.random() * 10; // 20-30 gwei base
  
  const gasEstimate = {
    slow: (basePrice * 0.8).toFixed(2),
    average: basePrice.toFixed(2),
    fast: (basePrice * 1.5).toFixed(2),
    recommended: (basePrice * 1.2).toFixed(2)
  };
  
  console.log('[WALLET] Gas price estimates requested');
  res.json(gasEstimate);
});

// GET /wallet/token-price - Get YAP token price in USD
apiRouter.get('/wallet/token-price', (req, res) => {
  // Mock token price (simulates market fluctuation)
  const basePrice = 0.50; // $0.50 base price
  const fluctuation = (Math.random() - 0.5) * 0.1; // ±5% fluctuation
  const currentPrice = Math.max(0.01, basePrice + fluctuation);
  
  console.log('[WALLET] Token price requested');
  res.json({
    price: parseFloat(currentPrice.toFixed(4)),
    currency: 'USD',
    timestamp: new Date().toISOString(),
    change24h: ((Math.random() - 0.5) * 20).toFixed(2) // ±10% daily change
  });
});

// POST /wallet/estimate-gas - Estimate gas for a transaction
apiRouter.post('/wallet/estimate-gas', (req, res) => {
  const { to, data, value } = req.body;
  
  if (!to) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required field: to'
    });
  }
  
  // Mock gas estimation based on transaction type
  let gasEstimate = 21000; // Base transaction cost
  
  if (data && data !== '0x') {
    // Contract interaction
    gasEstimate += 50000 + (data.length - 2) * 10; // Additional gas for contract calls
  }
  
  if (value && parseFloat(value) > 0) {
    // Value transfer
    gasEstimate += 5000;
  }
  
  console.log(`[WALLET] Gas estimation requested for transaction to ${to}`);
  res.json({
    gasLimit: gasEstimate.toString(),
    gasPrice: '0x4a817c800', // 20 gwei in hex
    estimatedCost: (gasEstimate * 20e-9).toFixed(6) // In SEI
  });
});

// GET /wallet/:address/tokens - Get all token balances for an address
apiRouter.get('/wallet/:address/tokens', (req, res) => {
  const { address } = req.params;
  
  if (!address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing wallet address'
    });
  }
  
  // Mock multiple token balances
  const mockTokens = [
    {
      symbol: 'YAP',
      name: 'YAP Token',
      balance: (Math.random() * 1000).toFixed(2),
      decimals: 18,
      contractAddress: '0x' + crypto.randomBytes(20).toString('hex'),
      price: 0.50
    },
    {
      symbol: 'SEI',
      name: 'SEI',
      balance: (Math.random() * 10).toFixed(4),
      decimals: 18,
      contractAddress: null, // Native token
      price: 0.12
    }
  ];
  
  console.log(`[WALLET] Token balances requested for address: ${address}`);
  res.json({ tokens: mockTokens });
});

// POST /wallet/sign-message - Sign a message with wallet (for authentication)
apiRouter.post('/wallet/sign-message', authenticateToken, (req, res) => {
  const { message, address } = req.body;
  
  if (!message || !address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing required fields: message, address'
    });
  }
  
  // Mock message signing
  const signature = '0x' + crypto.randomBytes(65).toString('hex');
  
  console.log(`[WALLET] Message signing requested for address: ${address}`);
  res.json({
    signature,
    message,
    address,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// ADDITIONAL LEARNING SERVICE ENDPOINTS
// =============================================================================

// Get specific lesson by ID
app.get('/lessons/:lessonId', authenticateToken, (req, res) => {
  const { lessonId } = req.params;
  
  const mockLesson = {
    id: lessonId,
    title: `Lesson ${lessonId}: Advanced Grammar`,
    description: 'Master advanced grammar concepts with interactive exercises',
    level: 'intermediate',
    duration: '15 minutes',
    category: 'grammar',
    content: {
      introduction: 'Welcome to this advanced grammar lesson.',
      sections: [
        {
          id: 'section1',
          title: 'Grammar Rules',
          content: 'Understanding complex sentence structures...',
          exercises: [
            {
              id: 'ex1',
              type: 'multiple-choice',
              question: 'Which sentence is grammatically correct?',
              options: [
                'The cat sits on the mat.',
                'The cat sit on the mat.',
                'The cats sits on the mat.',
                'The cat sitting on the mat.'
              ],
              correctAnswer: 0
            }
          ]
        }
      ]
    },
    prerequisites: [],
    estimatedTime: 900, // 15 minutes in seconds
    tags: ['grammar', 'intermediate', 'sentence-structure'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  res.json(mockLesson);
});

// Get all lessons with filtering
app.get('/lessons', authenticateToken, (req, res) => {
  const { category, level, limit = 10, offset = 0 } = req.query;
  
  let mockLessons = [
    {
      id: 'lesson-1',
      title: 'Basic Grammar Fundamentals',
      description: 'Learn the basics of English grammar',
      level: 'beginner',
      duration: '10 minutes',
      category: 'grammar',
      thumbnailUrl: '/assets/lessons/lesson1.jpg',
      progress: 85,
      isCompleted: false
    },
    {
      id: 'lesson-2',
      title: 'Vocabulary Building',
      description: 'Expand your vocabulary with common words',
      level: 'beginner',
      duration: '12 minutes',
      category: 'vocabulary',
      thumbnailUrl: '/assets/lessons/lesson2.jpg',
      progress: 60,
      isCompleted: false
    },
    {
      id: 'lesson-3',
      title: 'Advanced Pronunciation',
      description: 'Master difficult pronunciation patterns',
      level: 'advanced',
      duration: '20 minutes',
      category: 'pronunciation',
      thumbnailUrl: '/assets/lessons/lesson3.jpg',
      progress: 100,
      isCompleted: true
    },
    {
      id: 'lesson-4',
      title: 'Conversation Skills',
      description: 'Practice real-world conversations',
      level: 'intermediate',
      duration: '15 minutes',
      category: 'conversation',
      thumbnailUrl: '/assets/lessons/lesson4.jpg',
      progress: 30,
      isCompleted: false
    }
  ];

  // Apply filters
  if (category) {
    mockLessons = mockLessons.filter(lesson => lesson.category === category);
  }
  if (level) {
    mockLessons = mockLessons.filter(lesson => lesson.level === level);
  }

  // Apply pagination
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedLessons = mockLessons.slice(startIndex, endIndex);

  res.json({
    lessons: paginatedLessons,
    total: mockLessons.length,
    offset: parseInt(offset),
    limit: parseInt(limit),
    hasMore: endIndex < mockLessons.length
  });
});

// Get progress history
app.get('/progress/history', authenticateToken, (req, res) => {
  const { period = '7d', category } = req.query;
  
  // Generate mock progress data for the last week
  const mockHistory = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    mockHistory.push({
      date: date.toISOString().split('T')[0],
      lessonsCompleted: Math.floor(Math.random() * 5) + 1,
      timeSpent: Math.floor(Math.random() * 120) + 30, // 30-150 minutes
      pointsEarned: Math.floor(Math.random() * 500) + 100,
      streakDays: i === 0 ? 7 : 7 - i,
      categories: {
        grammar: Math.floor(Math.random() * 3),
        vocabulary: Math.floor(Math.random() * 3),
        pronunciation: Math.floor(Math.random() * 2),
        conversation: Math.floor(Math.random() * 2)
      }
    });
  }

  res.json({
    period: period,
    history: mockHistory,
    summary: {
      totalLessons: mockHistory.reduce((sum, day) => sum + day.lessonsCompleted, 0),
      totalTime: mockHistory.reduce((sum, day) => sum + day.timeSpent, 0),
      totalPoints: mockHistory.reduce((sum, day) => sum + day.pointsEarned, 0),
      currentStreak: 7,
      averageDaily: {
        lessons: Math.round(mockHistory.reduce((sum, day) => sum + day.lessonsCompleted, 0) / 7),
        timeMinutes: Math.round(mockHistory.reduce((sum, day) => sum + day.timeSpent, 0) / 7),
        points: Math.round(mockHistory.reduce((sum, day) => sum + day.pointsEarned, 0) / 7)
      }
    }
  });
});

// Submit quiz answers
app.post('/quiz/submit', authenticateToken, (req, res) => {
  const { quizId, answers, timeSpent } = req.body;
  
  if (!quizId || !answers) {
    return res.status(400).json({
      error: 'Quiz ID and answers are required'
    });
  }

  // Mock quiz evaluation
  const totalQuestions = Object.keys(answers).length;
  const correctAnswers = Math.floor(Math.random() * totalQuestions * 0.4) + Math.floor(totalQuestions * 0.6);
  const score = Math.round((correctAnswers / totalQuestions) * 100);
  
  const result = {
    quizId: quizId,
    score: score,
    correctAnswers: correctAnswers,
    totalQuestions: totalQuestions,
    timeSpent: timeSpent || 0,
    pointsEarned: Math.floor(score * 10),
    passed: score >= 70,
    submittedAt: new Date().toISOString(),
    feedback: {
      overall: score >= 90 ? 'Excellent work!' : score >= 70 ? 'Good job!' : 'Keep practicing!',
      areas: score < 70 ? ['grammar', 'vocabulary'] : []
    },
    detailedResults: Object.keys(answers).map((questionId, index) => ({
      questionId: questionId,
      userAnswer: answers[questionId],
      correctAnswer: index % 2 === 0 ? answers[questionId] : 'correct_option',
      isCorrect: index < correctAnswers,
      explanation: 'This is a mock explanation for the answer.'
    }))
  };

  res.json(result);
});

// =============================================================================
// TTS (TEXT-TO-SPEECH) SERVICE ENDPOINTS
// =============================================================================

// Generate TTS for daily sentence
app.post('/daily/tts/sentence', authenticateToken, (req, res) => {
  const { text, language = 'en', voice = 'female' } = req.body;
  
  if (!text) {
    return res.status(400).json({
      error: 'Text is required for TTS generation'
    });
  }

  // Mock TTS response
  res.json({
    audioUrl: `https://mock-tts.example.com/audio/${Buffer.from(text).toString('base64')}.mp3`,
    text: text,
    language: language,
    voice: voice,
    duration: Math.floor(text.length * 0.1) + 2, // Rough estimate in seconds
    generatedAt: new Date().toISOString(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  });
});

// Get TTS for specific word
app.get('/daily/tts/:wordId', authenticateToken, (req, res) => {
  const { wordId } = req.params;
  const { language = 'en' } = req.query;
  
  // Mock word TTS data
  const mockWordData = {
    wordId: wordId,
    word: `word_${wordId}`,
    language: language,
    audioUrl: `https://mock-tts.example.com/words/${wordId}.mp3`,
    phonetic: '/wərd/',
    syllables: ['word'],
    duration: 1.2,
    generatedAt: new Date().toISOString()
  };

  res.json(mockWordData);
});

// =============================================================================
// PRONUNCIATION HISTORY ENDPOINTS
// =============================================================================

// Get pronunciation history for specific word
app.get('/daily/pronunciation/history/:wordId', authenticateToken, (req, res) => {
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

// =============================================================================
// SECURITY METRICS ENDPOINTS (for monitoring)
// =============================================================================

// Security metrics endpoint
app.get('/metrics/security', authenticateToken, (req, res) => {
  // Only allow admin users to access security metrics
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Admin privileges required.'
    });
  }

  const mockMetrics = {
    timestamp: new Date().toISOString(),
    authentication: {
      totalLogins: 1250,
      failedAttempts: 45,
      successRate: 96.4,
      uniqueUsers: 890,
      averageSessionDuration: 1800 // 30 minutes
    },
    authorization: {
      accessDenied: 12,
      privilegeEscalations: 0,
      roleViolations: 2
    },
    api: {
      totalRequests: 125000,
      unauthorizedAttempts: 234,
      rateLimitHits: 45,
      suspiciousPatterns: 3
    },
    wallet: {
      transactionAttempts: 567,
      fraudulentTransactions: 0,
      walletConnections: 234,
      failedConnections: 12
    },
    system: {
      uptime: 99.9,
      errorRate: 0.1,
      responseTime: 145, // milliseconds
      dataBreaches: 0
    }
  };

  res.json(mockMetrics);
});

// Health check with security status
app.get('/health/security', (req, res) => {
  res.json({
    status: 'healthy',
    security: {
      authSystem: 'operational',
      rateLimit: 'active',
      firewall: 'active',
      encryption: 'enabled',
      monitoring: 'active'
    },
    timestamp: new Date().toISOString(),
    checks: {
      database: 'connected',
      redis: 'connected',
      external_apis: 'operational',
      ssl_certificate: 'valid'
    }
  });
});