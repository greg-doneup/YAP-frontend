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
const PORT = process.env.PORT || 8000;

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
  // Only create the essential waitlist user
  const waitlistUsers = [
    {
      userId: 'waitlist-user-main',
      email: 'waitlist@example.com',
      name: 'Spanish Learner',
      language: 'spanish',
      xp: 0,  // Will be 25 after conversion
      streak: 0,
      hasWallet: false,
      isWaitlist: true,
      learningStage: 'waitlist',
      signupDate: '2025-06-08'
    }
  ];

  // Process waitlist users (no wallets yet, just profile data)
  waitlistUsers.forEach(user => {
    // Create basic profile without wallet data
    const basicProfile = createMockProfile(user.userId, user.email, user.name, user.language);
    basicProfile.wlw = false; // No wallet yet
    basicProfile.isWaitlistUser = true; // Mark as waitlist user
    basicProfile.waitlist_signup_at = user.signupDate ? new Date(user.signupDate).toISOString() : new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
    basicProfile.learningStage = 'waitlist';
    
    mockDatabase.profiles.set(user.userId, basicProfile);

    // Create user entry without wallet addresses
    mockDatabase.users.set(user.userId, {
      userId: user.userId,
      email: user.email,
      name: user.name,
      language_to_learn: user.language,
      hasWallet: false,
      learningStage: 'waitlist',
      signupDate: user.signupDate
    });

    // Create offchain profile for waitlist users
    const offchainProfile = createMockOffchainProfile(user.userId, '0x' + crypto.randomBytes(20).toString('hex'), false);
    offchainProfile.xp = 0;
    offchainProfile.streak = 0;
    offchainProfile.learningStage = 'waitlist';
    offchainProfile.completedLessons = [];
    mockDatabase.offchainProfiles.set(user.userId, offchainProfile);
  });

  console.log('✅ Mock data initialized with essential waitlist user:');
  console.log('Waitlist users (awaiting wallet creation):');
  console.log('   • waitlist@example.com - Spanish Learner (Signed up: 2025-06-08)');
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

function createMockOffchainProfile(userId, ethWalletAddress, isWaitlistConversion = false) {
  return {
    userId,
    ethWalletAddress,
    xp: isWaitlistConversion ? 25 : 0,  // 25-point bonus for waitlist conversions, 0 for new accounts
    streak: 0,  // All new accounts start with 0 streak
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Helper function to determine next word delay based on learning stage
function getNextWordDelayByStage(learningStage) {
  const delays = {
    'beginner': 2 * 60 * 60 * 1000,    // 2 hours for complete beginners
    'first_week': 4 * 60 * 60 * 1000,  // 4 hours for first week learners
    'second_week': 6 * 60 * 60 * 1000, // 6 hours for second week
    'third_week': 8 * 60 * 60 * 1000,  // 8 hours for third week
    'first_month': 12 * 60 * 60 * 1000, // 12 hours for first month learners
    'waitlist': 0                       // No delay for waitlist users
  };
  
  return delays[learningStage] || 6 * 60 * 60 * 1000; // Default 6 hours
}

// Helper function to update learning stage based on progress
function updateLearningStage(offchainProfile, user) {
  const completedLessons = offchainProfile.completedLessons?.length || 0;
  const totalXP = offchainProfile.xp || 0;
  const streak = offchainProfile.streak || 0;
  
  let newStage = offchainProfile.learningStage;
  
  // Progress from beginner to first_week
  if (newStage === 'beginner' && (completedLessons >= 1 || totalXP >= 50)) {
    newStage = 'first_week';
  }
  // Progress from first_week to second_week  
  else if (newStage === 'first_week' && (completedLessons >= 2 || totalXP >= 100 || streak >= 5)) {
    newStage = 'second_week';
  }
  // Progress from second_week to third_week
  else if (newStage === 'second_week' && (completedLessons >= 3 || totalXP >= 150 || streak >= 7)) {
    newStage = 'third_week';
  }
  // Progress from third_week to first_month
  else if (newStage === 'third_week' && (completedLessons >= 4 || totalXP >= 200 || streak >= 10)) {
    newStage = 'first_month';
  }
  
  if (newStage !== offchainProfile.learningStage) {
    offchainProfile.learningStage = newStage;
    if (user) {
      user.learningStage = newStage;
      mockDatabase.users.set(user.userId, user);
    }
    console.log(`[PROGRESS] User ${user?.userId} advanced to learning stage: ${newStage}`);
  }
}

// =============================================================================
// AUTH SERVICE ENDPOINTS
// =============================================================================

// POST /auth/wallet/signup - Handle new user registration
apiRouter.post('/auth/wallet/signup', (req, res) => {
  const { 
    name, 
    email, 
    language_to_learn, 
    passphrase_hash, // Backend should receive the hashed passphrase, not raw passphrase
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
  if (!passphrase_hash) {
    return res.status(400).json({ message: "passphrase_hash required (frontend should hash the passphrase)" });
  }
  if (!encrypted_mnemonic || !salt || !nonce || !sei_address || !eth_address) {
    return res.status(400).json({ message: "encrypted wallet data required" });
  }

  // Check if user already exists (waitlist user conversion)
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);
  
  // For waitlist conversion, name and language are optional (taken from existing profile)
  // For new registration, name and language are required
  if (!existingProfile || !existingProfile.isWaitlistUser) {
    if (!name) {
      return res.status(400).json({ message: "name required" });
    }
    if (!language_to_learn) {
      return res.status(400).json({ message: "language_to_learn required" });
    }
  }
  
  if (existingProfile) {
    // Check if this is a waitlist user conversion
    if (existingProfile.wlw === false && existingProfile.isWaitlistUser) {
      console.log('🔄 Converting waitlist user to full account:', email);
      
      // Update existing profile with wallet data
      existingProfile.wlw = true; // Now has wallet
      existingProfile.passphrase_hash = passphrase_hash;
      existingProfile.encrypted_mnemonic = encrypted_mnemonic;
      existingProfile.salt = salt;
      existingProfile.nonce = nonce;
      existingProfile.sei_wallet = {
        address: sei_address,
        public_key: sei_public_key || 'sei_pub_' + crypto.randomBytes(16).toString('hex')
      };
      existingProfile.eth_wallet = {
        address: eth_address,
        public_key: eth_public_key || 'eth_pub_' + crypto.randomBytes(16).toString('hex')
      };
      existingProfile.secured_at = new Date().toISOString();
      existingProfile.updatedAt = new Date().toISOString();
      existingProfile.converted = true; // Mark as converted
      
      // Update profile in database
      mockDatabase.profiles.set(existingProfile.userId, existingProfile);

      // Update user entry with wallet addresses
      const existingUser = mockDatabase.users.get(existingProfile.userId);
      if (existingUser) {
        existingUser.walletAddress = sei_address;
        existingUser.ethWalletAddress = eth_address;
        existingUser.hasWallet = true;
        mockDatabase.users.set(existingProfile.userId, existingUser);
      }

      // Create/update offchain profile with waitlist conversion bonus
      const offchainProfile = createMockOffchainProfile(existingProfile.userId, eth_address, true);
      mockDatabase.offchainProfiles.set(existingProfile.userId, offchainProfile);

      // Generate tokens for converted user
      const accessToken = generateToken({
        sub: existingProfile.userId,
        type: 'access',
        walletAddress: sei_address,
        ethWalletAddress: eth_address,
        currentLessonId: 'lesson-1',
        currentWordId: 'word-1',
        nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      });

      const refreshToken = generateRefreshToken(existingProfile.userId);

      console.log(`✅ Waitlist conversion completed for ${email}`);

      return res.json({
        token: accessToken,
        refreshToken,
        userId: existingProfile.userId,
        walletAddress: sei_address,
        ethWalletAddress: eth_address,
        name: existingProfile.name,
        language_to_learn: existingProfile.initial_language_to_learn,
        isWaitlistConversion: true,
        starting_points: offchainProfile.xp, // Use actual XP from offchain profile
        message: 'Waitlist user converted to full account successfully'
      });
      
    } else {
      // Regular user already exists with wallet
      return res.status(409).json({ message: "Email already registered" });
    }
  }

  // Generate new user ID
  const userId = crypto.randomBytes(32).toString('hex');
  
  // Backend stores the pre-hashed passphrase (no additional hashing needed)
  // Frontend should have already done: PBKDF2(passphrase, salt, iterations) -> SHA256(derivedKey)

  // Create user entry
  mockDatabase.users.set(userId, {
    userId,
    email,
    name: name,
    language_to_learn: language_to_learn,
    walletAddress: sei_address,
    ethWalletAddress: eth_address
  });

  // Create basic profile with wallet and security data
  const profileData = {
    userId,
    email,
    name: name,
    initial_language_to_learn: language_to_learn,
    wlw: true, // Has wallet
    passphrase_hash: passphrase_hash, // Store the frontend-provided hash
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

  // Create new profile
  mockDatabase.profiles.set(userId, profileData);

  // Create offchain profile using the helper function
  const offchainProfile = createMockOffchainProfile(userId, eth_address, false);
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

  console.log(`✅ Registration completed for ${email} (${name})`);

  res.json({
    token: accessToken,
    refreshToken,
    userId,
    walletAddress: sei_address,
    ethWalletAddress: eth_address,
    name: name,
    language_to_learn: language_to_learn,
    message: 'Account created successfully'
  });
});

// WALLET AUTHENTICATION - Handle both email/passphrase and userId/walletAddress flows
apiRouter.post('/auth/wallet', (req, res) => {
  console.log('=== WALLET AUTHENTICATION ===');
  console.log('🔍 [DEBUG] Request body keys:', Object.keys(req.body));
  console.log('🔍 [DEBUG] Full request body:', req.body);
  
  const { 
    // Format 1: Email/passphrase authentication (new wallet setup)
    email, 
    passphrase, 
    encryptedMnemonic, 
    seiWalletAddress, 
    evmWalletAddress, 
    signupMethod,
    // Format 2: UserId/wallet address authentication (existing user login)
    userId,
    walletAddress,
    ethWalletAddress
  } = req.body;

  // Determine which authentication format is being used
  const isEmailPassphraseAuth = email && passphrase;
  const isUserIdWalletAuth = userId && (walletAddress || ethWalletAddress);

  console.log('Authentication type:', {
    isEmailPassphraseAuth,
    isUserIdWalletAuth,
    hasEmail: !!email,
    hasPassphrase: !!passphrase,
    hasUserId: !!userId,
    hasWalletAddress: !!walletAddress
  });

  try {
    if (isEmailPassphraseAuth) {
      // FORMAT 1: Email/passphrase authentication (new account creation)
      console.log('Processing email/passphrase authentication for:', email);
      
      // Create secure passphrase hash (matching backend)
      const salt = `yap-wallet-${email}`;
      const iterations = 100000;
      const derivedKey = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
      const serverSecret = 'default-development-secret-change-in-production';
      const finalInput = Buffer.concat([derivedKey, Buffer.from(serverSecret)]);
      const passphraseHash = crypto.createHash('sha256').update(finalInput).digest('hex');

      // Generate user ID
      const userIdFromHash = crypto.createHash('sha256').update(`${email}-${passphraseHash}`).digest('hex');

      // Store wallet data (in production this would go to MongoDB)
      const walletData = {
        email,
        passphraseHash,
        encryptedMnemonic,  // Encrypted by frontend with user's passphrase
        seiWalletAddress,   // Generated by frontend from mnemonic
        evmWalletAddress,   // Generated by frontend from mnemonic
        signupMethod,
        createdAt: new Date().toISOString()
      };

      // Store in mock database
      const existingUserData = mockDatabase.users.get(userIdFromHash) || {};
      mockDatabase.users.set(userIdFromHash, {
        ...existingUserData,
        ...walletData,
        userId: userIdFromHash
      });

      // Create/update profile data for auth validation
      const existingProfile = mockDatabase.profiles.get(userIdFromHash);
      if (!existingProfile) {
        mockDatabase.profiles.set(userIdFromHash, {
          userId: userIdFromHash,
          email: email,
          name: 'User',
          language: 'spanish'
        });
      }

      // Generate JWT token
      const accessToken = jwt.sign(
        { 
          sub: userIdFromHash,
          userId: userIdFromHash, 
          email,
          type: 'wallet_auth'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        { sub: userIdFromHash, userId: userIdFromHash, email, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('Email/passphrase authentication successful for user:', userIdFromHash);
      console.log('Frontend-generated wallet addresses stored:', {
        sei: seiWalletAddress,
        evm: evmWalletAddress
      });

      // Return success - NO wallet addresses (frontend already has them)
      res.json({
        success: true,
        token: accessToken,
        refreshToken,
        userId: userIdFromHash,
        email,
        message: 'Wallet authenticated successfully'
        // Note: Not returning walletAddress/ethWalletAddress - frontend generated them
      });

    } else if (isUserIdWalletAuth) {
      // FORMAT 2: UserId/wallet address authentication (existing user direct wallet login)
      console.log('Processing userId/wallet address authentication for:', userId);
      
      // Find user by wallet addresses in our mock database
      let foundUser = null;
      for (const [userId, userData] of mockDatabase.users.entries()) {
        if (userData.userId === userId && 
            (userData.seiWalletAddress === walletAddress || userData.evmWalletAddress === ethWalletAddress)) {
          foundUser = userData;
          break;
        }
      }

      if (!foundUser) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'No user found with provided userId and wallet addresses'
        });
      }

      // Generate JWT token for existing user
      const accessToken = jwt.sign(
        { 
          sub: foundUser.userId,
          userId: foundUser.userId, 
          email: foundUser.email,
          type: 'wallet_direct_auth'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        { sub: foundUser.userId, userId: foundUser.userId, email: foundUser.email, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('UserId/wallet authentication successful for user:', foundUser.userId);

      res.json({
        success: true,
        token: accessToken,
        refreshToken,
        userId: foundUser.userId,
        message: 'Wallet authenticated successfully'
      });

    } else {
      // Invalid request format
      return res.status(400).json({
        error: 'INVALID_REQUEST_FORMAT',
        message: 'Request must include either (email + passphrase) or (userId + walletAddress/ethWalletAddress)',
        received: {
          hasEmail: !!email,
          hasPassphrase: !!passphrase,
          hasUserId: !!userId,
          hasWalletAddress: !!walletAddress,
          hasEthWalletAddress: !!ethWalletAddress
        }
      });
    }

  } catch (error) {
    console.error('Wallet authentication error:', error);
    res.status(500).json({
      error: 'WALLET_AUTH_FAILED',
      message: 'Wallet authentication failed',
      details: error.message
    });
  }
});

// WALLET RECOVERY ENDPOINT
apiRouter.post('/auth/wallet/recover', (req, res) => {
  console.log('=== WALLET RECOVERY ===');
  const { email, passphrase, seiWalletAddress, evmWalletAddress } = req.body;

  console.log('Wallet recovery request:', {
    email,
    seiWalletAddress,
    evmWalletAddress
  });

  try {
    // Get stored user data
    const storedUser = mockUsers[email];
    if (!storedUser) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'No wallet found for this email'
      });
    }

    // Verify passphrase hash
    const salt = `yap-wallet-${email}`;
    const iterations = 100000;
    const derivedKey = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
    const serverSecret = 'default-development-secret-change-in-production';
    const finalInput = Buffer.concat([derivedKey, Buffer.from(serverSecret)]);
    const providedHash = crypto.createHash('sha256').update(finalInput).digest('hex');

    if (providedHash !== storedUser.passphraseHash) {
      return res.status(401).json({
        error: 'INVALID_PASSPHRASE',
        message: 'Invalid passphrase'
      });
    }

    // Verify wallet addresses match (ensures correct mnemonic recovery)
    if (seiWalletAddress !== storedUser.seiWalletAddress || 
        evmWalletAddress !== storedUser.evmWalletAddress) {
      return res.status(401).json({
        error: 'WALLET_MISMATCH',
        message: 'Wallet addresses do not match stored values'
      });
    }

    // Generate new tokens
    const accessToken = jwt.sign(
      { 
        sub: storedUser.userId,
        userId: storedUser.userId, 
        email,
        type: 'wallet_recovery'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { sub: storedUser.userId, userId: storedUser.userId, email, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Wallet recovery successful for user:', storedUser.userId);

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      userId: storedUser.userId,
      email,
      message: 'Wallet recovered successfully'
    });

  } catch (error) {
    console.error('Wallet recovery error:', error);
    res.status(500).json({
      error: 'WALLET_RECOVERY_FAILED',
      message: 'Wallet recovery failed',
      details: error.message
    });
  }
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
  const userData = mockDatabase.users.get(userId);
  
  res.json({
    userId: userId,
    email: basicProfile?.email,
    name: basicProfile?.name,
    walletAddress: userData?.seiWalletAddress,
    ethWalletAddress: userData?.evmWalletAddress
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
// WALLET SERVICE ENDPOINTS 🆕
// =============================================================================

// POST /email-lookup - Check if email exists and get account status
apiRouter.post('/email-lookup', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  // Find profile by email
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Email not found'
    });
  }

  // Determine account status based on profile data
  let status = 'registered';
  if (existingProfile.secured_at) {
    status = 'secured';
  }

  console.log(`📧 Email lookup for ${email}: status=${status}`);

  res.json({
    email,
    status,
    userId: existingProfile.userId,
    hasWallet: !!existingProfile.encrypted_mnemonic,
    message: `Account found with status: ${status}`
  });
});

// POST /secure-account - Complete wallet setup for existing accounts
apiRouter.post('/secure-account', (req, res) => {
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
  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  if (!encrypted_mnemonic || !salt || !nonce) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Encrypted wallet data is required'
    });
  }

  if (!sei_address || !eth_address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Wallet addresses are required'
    });
  }

  // Find existing profile
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  // Check if already secured
  if (existingProfile.secured_at) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Account already secured'
    });
  }

  // Derive passphrase hash using same algorithm as backend
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  // Update profile with wallet security data
  const updatedProfile = {
    ...existingProfile,
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
    wlw: true, // Now has wallet
    secured_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  mockDatabase.profiles.set(existingProfile.userId, updatedProfile);

  // Update user entry
  const user = mockDatabase.users.get(existingProfile.userId);
  if (user) {
    user.walletAddress = sei_address;
    user.ethWalletAddress = eth_address;
    user.hasWallet = true;
    mockDatabase.users.set(existingProfile.userId, user);
  }

  // Create offchain profile if it doesn't exist
  if (!mockDatabase.offchainProfiles.has(existingProfile.userId)) {
    const offchainProfile = {
      userId: existingProfile.userId,
      ethWalletAddress: eth_address,
      xp: 0,
      streak: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDatabase.offchainProfiles.set(existingProfile.userId, offchainProfile);
  }

  console.log(`🔐 Account secured for ${email} - wallet setup complete`);

  res.json({
    userId: existingProfile.userId,
    email,
    status: 'secured',
    wallet_addresses: {
      sei: sei_address,
      eth: eth_address
    },
    starting_xp: 0,
    message: 'Account successfully secured with wallet'
  });
});

// POST /recover - Wallet recovery using passphrase
apiRouter.post('/recover', (req, res) => {
  const { email, passphrase } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  // Find profile by email
  const profile = Array.from(mockDatabase.profiles.values())
    .find(p => p.email === email);

  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  if (!profile.passphrase_hash) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Account does not have wallet setup'
    });
  }

  // Verify passphrase using same algorithm as secure-account
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  if (passphraseHash !== profile.passphrase_hash) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid passphrase'
    });
  }

  // Generate authentication tokens
  const accessToken = generateToken({
    sub: profile.userId,
    type: 'access',
    walletAddress: profile.sei_wallet?.address,
    ethWalletAddress: profile.eth_wallet?.address,
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const refreshToken = generateRefreshToken(profile.userId);

  console.log(`🔓 Wallet recovery successful for ${email}`);

  res.json({
    token: accessToken,
    refreshToken,
    userId: profile.userId,
    email: profile.email,
    wallet_data: profile.encrypted_wallet_data,
    message: 'Wallet recovery successful'
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
  const userData = mockDatabase.users.get(userId);
  
  res.json({
    userId: userId,
    email: basicProfile?.email,
    name: basicProfile?.name,
    walletAddress: userData?.seiWalletAddress,
    ethWalletAddress: userData?.evmWalletAddress
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
// WALLET SERVICE ENDPOINTS 🆕
// =============================================================================

// POST /email-lookup - Check if email exists and get account status
apiRouter.post('/email-lookup', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  // Find profile by email
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Email not found'
    });
  }

  // Determine account status based on profile data
  let status = 'registered';
  if (existingProfile.secured_at) {
    status = 'secured';
  }

  console.log(`📧 Email lookup for ${email}: status=${status}`);

  res.json({
    email,
    status,
    userId: existingProfile.userId,
    hasWallet: !!existingProfile.encrypted_mnemonic,
    message: `Account found with status: ${status}`
  });
});

// POST /secure-account - Complete wallet setup for existing accounts
apiRouter.post('/secure-account', (req, res) => {
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
  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  if (!encrypted_mnemonic || !salt || !nonce) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Encrypted wallet data is required'
    });
  }

  if (!sei_address || !eth_address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Wallet addresses are required'
    });
  }

  // Find existing profile
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  // Check if already secured
  if (existingProfile.secured_at) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Account already secured'
    });
  }

  // Derive passphrase hash using same algorithm as backend
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  // Update profile with wallet security data
  const updatedProfile = {
    ...existingProfile,
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
    wlw: true, // Now has wallet
    secured_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  mockDatabase.profiles.set(existingProfile.userId, updatedProfile);

  // Update user entry
  const user = mockDatabase.users.get(existingProfile.userId);
  if (user) {
    user.walletAddress = sei_address;
    user.ethWalletAddress = eth_address;
    user.hasWallet = true;
    mockDatabase.users.set(existingProfile.userId, user);
  }

  // Create offchain profile if it doesn't exist
  if (!mockDatabase.offchainProfiles.has(existingProfile.userId)) {
    const offchainProfile = {
      userId: existingProfile.userId,
      ethWalletAddress: eth_address,
      xp: 0,
      streak: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDatabase.offchainProfiles.set(existingProfile.userId, offchainProfile);
  }

  console.log(`🔐 Account secured for ${email} - wallet setup complete`);

  res.json({
    userId: existingProfile.userId,
    email,
    status: 'secured',
    wallet_addresses: {
      sei: sei_address,
      eth: eth_address
    },
    starting_xp: 0,
    message: 'Account successfully secured with wallet'
  });
});

// POST /recover - Wallet recovery using passphrase
apiRouter.post('/recover', (req, res) => {
  const { email, passphrase } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  // Find profile by email
  const profile = Array.from(mockDatabase.profiles.values())
    .find(p => p.email === email);

  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  if (!profile.passphrase_hash) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Account does not have wallet setup'
    });
  }

  // Verify passphrase using same algorithm as secure-account
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  if (passphraseHash !== profile.passphrase_hash) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid passphrase'
    });
  }

  // Generate authentication tokens
  const accessToken = generateToken({
    sub: profile.userId,
    type: 'access',
    walletAddress: profile.sei_wallet?.address,
    ethWalletAddress: profile.eth_wallet?.address,
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const refreshToken = generateRefreshToken(profile.userId);

  console.log(`🔓 Wallet recovery successful for ${email}`);

  res.json({
    token: accessToken,
    refreshToken,
    userId: profile.userId,
    email: profile.email,
    wallet_data: profile.encrypted_wallet_data,
    message: 'Wallet recovery successful'
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
  const userData = mockDatabase.users.get(userId);
  
  res.json({
    userId: userId,
    email: basicProfile?.email,
    name: basicProfile?.name,
    walletAddress: userData?.seiWalletAddress,
    ethWalletAddress: userData?.evmWalletAddress
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
// WALLET SERVICE ENDPOINTS 🆕
// =============================================================================

// POST /email-lookup - Check if email exists and get account status
apiRouter.post('/email-lookup', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  // Find profile by email
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Email not found'
    });
  }

  // Determine account status based on profile data
  let status = 'registered';
  if (existingProfile.secured_at) {
    status = 'secured';
  }

  console.log(`📧 Email lookup for ${email}: status=${status}`);

  res.json({
    email,
    status,
    userId: existingProfile.userId,
    hasWallet: !!existingProfile.encrypted_mnemonic,
    message: `Account found with status: ${status}`
  });
});

// POST /secure-account - Complete wallet setup for existing accounts
apiRouter.post('/secure-account', (req, res) => {
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
  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  if (!encrypted_mnemonic || !salt || !nonce) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Encrypted wallet data is required'
    });
  }

  if (!sei_address || !eth_address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Wallet addresses are required'
    });
  }

  // Find existing profile
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  // Check if already secured
  if (existingProfile.secured_at) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Account already secured'
    });
  }

  // Derive passphrase hash using same algorithm as backend
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  // Update profile with wallet security data
  const updatedProfile = {
    ...existingProfile,
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
    wlw: true, // Now has wallet
    secured_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  mockDatabase.profiles.set(existingProfile.userId, updatedProfile);

  // Update user entry
  const user = mockDatabase.users.get(existingProfile.userId);
  if (user) {
    user.walletAddress = sei_address;
    user.ethWalletAddress = eth_address;
    user.hasWallet = true;
    mockDatabase.users.set(existingProfile.userId, user);
  }

  // Create offchain profile if it doesn't exist
  if (!mockDatabase.offchainProfiles.has(existingProfile.userId)) {
    const offchainProfile = {
      userId: existingProfile.userId,
      ethWalletAddress: eth_address,
      xp: 0,
      streak: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDatabase.offchainProfiles.set(existingProfile.userId, offchainProfile);
  }

  console.log(`🔐 Account secured for ${email} - wallet setup complete`);

  res.json({
    userId: existingProfile.userId,
    email,
    status: 'secured',
    wallet_addresses: {
      sei: sei_address,
      eth: eth_address
    },
    starting_xp: 0,
    message: 'Account successfully secured with wallet'
  });
});

// POST /recover - Wallet recovery using passphrase
apiRouter.post('/recover', (req, res) => {
  const { email, passphrase } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  // Find profile by email
  const profile = Array.from(mockDatabase.profiles.values())
    .find(p => p.email === email);

  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  if (!profile.passphrase_hash) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Account does not have wallet setup'
    });
  }

  // Verify passphrase using same algorithm as secure-account
  const passphraseSalt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  const derivedKey = crypto.pbkdf2Sync(passphrase, passphraseSalt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const passphraseHash = crypto.createHash('sha256').update(keyBase64).digest('hex');

  if (passphraseHash !== profile.passphrase_hash) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid passphrase'
    });
  }

  // Generate authentication tokens
  const accessToken = generateToken({
    sub: profile.userId,
    type: 'access',
    walletAddress: profile.sei_wallet?.address,
    ethWalletAddress: profile.eth_wallet?.address,
    currentLessonId: 'lesson-1',
    currentWordId: 'word-1',
    nextWordAvailableAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  const refreshToken = generateRefreshToken(profile.userId);

  console.log(`🔓 Wallet recovery successful for ${email}`);

  res.json({
    token: accessToken,
    refreshToken,
    userId: profile.userId,
    email: profile.email,
    wallet_data: profile.encrypted_wallet_data,
    message: 'Wallet recovery successful'
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
  const userData = mockDatabase.users.get(userId);
  
  res.json({
    userId: userId,
    email: basicProfile?.email,
    name: basicProfile?.name,
    walletAddress: userData?.seiWalletAddress,
    ethWalletAddress: userData?.evmWalletAddress
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
// WALLET SERVICE ENDPOINTS 🆕
// =============================================================================

// POST /email-lookup - Check if email exists and get account status
apiRouter.post('/email-lookup', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  // Find profile by email
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Email not found'
    });
  }

  // Determine account status based on profile data
  let status = 'registered';
  if (existingProfile.secured_at) {
    status = 'secured';
  }

  console.log(`📧 Email lookup for ${email}: status=${status}`);

  res.json({
    email,
    status,
    userId: existingProfile.userId,
    hasWallet: !!existingProfile.encrypted_mnemonic,
    message: `Account found with status: ${status}`
  });
});

// POST /secure-account - Complete wallet setup for existing accounts
apiRouter.post('/secure-account', (req, res) => {
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
  if (!email) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Email is required'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Passphrase is required'
    });
  }

  if (!encrypted_mnemonic || !salt || !nonce) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Encrypted wallet data is required'
    });
  }

  if (!sei_address || !eth_address) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Wallet addresses are required'
    });
  }

  // Find existing profile
  const existingProfile = Array.from(mockDatabase.profiles.values())
    .find(profile => profile.email === email);

  if (!existingProfile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Account not found'
    });
  }

  // Check if already secured
  if (existingProfile.secured_at) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Account already secured'
    });
  }

  // Derive passphrase hash using same algorithm as backend
  
  // Generate realistic word-by-word scores
  const wordDetails = words.map((word, index) => {
    const baseScore = 0.7 + Math.random() * 0.25; // 0.7 to 0.95
    return {
      word: word,
      score: baseScore,
      startTime: index * 0.5,
      endTime: (index + 1) * 0.5,
      confidence: 0.85 + Math.random() * 0.15,
      issues: baseScore < 0.8 ? ['pronunciation'] : []
    };
  });

  const overallScore = wordDetails.reduce((sum, word) => sum + word.score, 0) / wordDetails.length;
  const pronunciationScore = Math.round(overallScore * 100);
  const speedScore = 85 + Math.round(Math.random() * 15);
  const similarityScore = 88 + Math.round(Math.random() * 12);
  const pass = overallScore >= 0.7;

  const detailedResponse = {
    pass,
    pronunciationScore: overallScore,
    overallScore: pronunciationScore,
    speedScore,
    similarityScore,
    expected: expectedText,
    corrected: expectedText,
    wordDetails,
    phonemeDetails: [
      {
        phoneme: 'M',
        score: 0.9,
        startTime: 0.0,
        endTime: 0.1,
        issues: []
      },
      {
        phoneme: 'E',
        score: 0.85,
        startTime: 0.1,
        endTime: 0.2,
        issues: []
      }
    ],
    feedback: overallScore >= 0.9 
      ? ['¡Excelente pronunciación!', 'Your Spanish accent is very natural.']
      : overallScore >= 0.8
      ? ['Muy bien!', 'Good pronunciation with minor areas to improve.']
      : ['Keep practicing!', 'Focus on the highlighted words for better pronunciation.'],
    transcript: expectedText,
    audioAnalysis: {
      duration: words.length * 0.5,
      volume: 'good',
      clarity: 'high'
    }
  };

  // Store completion and update user progress
  const completion = {
    userId,
    lessonId,
    wordId,
    date: new Date().toISOString().split('T')[0],
    pronunciationScore: overallScore,
    grammarScore: 0.9,
    pass,
    timestamp: new Date().toISOString()
  };

  console.log(`[PRONUNCIATION] User ${userId} completed ${wordId} with score: ${pronunciationScore}%`);
  
  // Store completion and update user progress
  if (!mockDatabase.completions.has(userId)) {
    mockDatabase.completions.set(userId, []);
  }
  mockDatabase.completions.get(userId).unshift(completion);

  // Update user progress if completion was successful
  if (pass) {
    const user = mockDatabase.users.get(userId);
    const offchainProfile = mockDatabase.offchainProfiles.get(userId);
    
    if (user && offchainProfile) {
      // Award XP based on learning stage and performance
      const baseXP = 10;
      let bonusXP = 0;
      
      // Bonus XP for excellent pronunciation
      if (pronunciationScore >= 0.9) bonusXP += 5;
      if (pronunciationScore >= 0.95) bonusXP += 5;
      
      // Bonus XP for beginners to encourage continued learning
      if (offchainProfile.learningStage === 'beginner' || offchainProfile.learningStage === 'first_week') {
        bonusXP += 3;
      }
      
      const totalXPGained = baseXP + bonusXP;
      offchainProfile.xp = (offchainProfile.xp || 0) + totalXPGained;
      
      // Update streak if this is a daily completion
      const today = new Date().toISOString().split('T')[0];
      const lastActivity = offchainProfile.lastActivity ? new Date(offchainProfile.lastActivity).toISOString().split('T')[0] : null;
      
      if (lastActivity !== today) {
        // First completion today
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastActivity === yesterdayStr) {
          // Consecutive day, increment streak
          offchainProfile.streak = (offchainProfile.streak || 0) + 1;
        } else if (!lastActivity || lastActivity !== today) {
          // Either first time or streak broken, reset to 1
          offchainProfile.streak = 1;
        }
      }
      
      offchainProfile.lastActivity = new Date().toISOString();
      
      // Track completed words
      if (!offchainProfile.completedWords) {
        offchainProfile.completedWords = [];
      }
      if (!offchainProfile.completedWords.includes(wordId)) {
        offchainProfile.completedWords.push(wordId);
      }
      
      // Check if lesson is completed (all words done)
      const lesson = mockDatabase.lessons.get(lessonId);
      if (lesson) {
        const lessonWordIds = lesson.new_vocabulary.map(w => w.id);
        const userCompletedWordsInLesson = offchainProfile.completedWords.filter(id => lessonWordIds.includes(id));
        
        if (userCompletedWordsInLesson.length >= lessonWordIds.length) {
          // Lesson completed!
          if (!offchainProfile.completedLessons) {
            offchainProfile.completedLessons = [];
          }
          if (!offchainProfile.completedLessons.includes(lessonId)) {
            offchainProfile.completedLessons.push(lessonId);
            
            // Bonus XP for lesson completion
            offchainProfile.xp += 25;
            
            // Update learning stage if appropriate
            updateLearningStage(offchainProfile, user);
          }
        }
      }
      
      // Save updated progress
      mockDatabase.offchainProfiles.set(userId, offchainProfile);
      
      console.log(`[PROGRESS] User ${userId} gained ${totalXPGained} XP (total: ${offchainProfile.xp}), streak: ${offchainProfile.streak}`);
    }
  }

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

  // Generate mock audio URL based on text and language
  const audioId = Buffer.from(text).toString('base64').substring(0, 16);
  const mockAudioUrl = `data:audio/mp3;base64,SUQzAwAAAAABVFNTRQAAAA8AAABNUEVHIFZlcnNpb24=`;

  console.log(`[TTS] Generated audio for: "${text}" in ${languageCode || 'es-ES'}`);

  res.json({
    success: true,
    audioUrl: mockAudioUrl,
    text: text,
    languageCode: languageCode || 'es-ES',
    duration: text.length * 0.1, // Rough estimate
    format: 'mp3'
  });
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

// GET /learning/quiz - Get quiz words (language-specific)
apiRouter.get('/learning/quiz', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    // Return default quiz if no user specified
    const defaultWords = [
      {
        id: 'quiz-default-1',
        term: 'practice',
        translation: 'to exercise or rehearse',
        difficulty: 1,
        examples: ['Practice makes perfect.'],
        tags: ['education']
      }
    ];
    return res.json({
      words: defaultWords,
      expected: 'I am practicing vocabulary words.'
    });
  }

  // Get user's language preference and progress
  const user = mockDatabase.users.get(userId);
  if (!user || !user.language_to_learn) {
    const fallbackWords = [
      {
        id: 'quiz-fallback-1',
        term: 'study',
        translation: 'to learn about something',
        difficulty: 1,
        examples: ['I study languages every day.'],
        tags: ['education']
      }
    ];
    return res.json({
      words: fallbackWords,
      expected: 'I am studying new words.'
    });
  }

  const userLanguage = user.language_to_learn;
  const offchainProfile = mockDatabase.offchainProfiles.get(userId);
  
  // Find lessons for user's language
  const userLessons = Array.from(mockDatabase.lessons.values())
    .filter(lesson => lesson.language === userLanguage);

  if (userLessons.length === 0) {
    return res.json({
      words: [],
      expected: 'No vocabulary available for this language yet.'
    });
  }

  // Get words from completed lessons for review
  let quizWords = [];
  let expectedPhrase = '';

  if (offchainProfile && offchainProfile.completedLessons && offchainProfile.completedLessons.length > 0) {
    // User has completed lessons, create review quiz
    const completedLessons = userLessons.filter(lesson => 
      offchainProfile.completedLessons.includes(lesson.lesson_id)
    );
    
    // Collect vocabulary from completed lessons
    const allCompletedWords = [];
    completedLessons.forEach(lesson => {
      allCompletedWords.push(...lesson.new_vocabulary);
    });
    
    // Select up to 5 words for quiz
    quizWords = allCompletedWords.slice(0, 5);
    
    // Create language-specific expected phrase
    expectedPhrase = generateExpectedPhraseForLanguage(userLanguage, quizWords);
  } else {
    // New user, use words from first lesson as preview
    const firstLesson = userLessons[0];
    quizWords = firstLesson.new_vocabulary.slice(0, 3);
    expectedPhrase = generateExpectedPhraseForLanguage(userLanguage, quizWords);
  }

  // Add language and lesson context to words
  const enhancedWords = quizWords.map(word => ({
    ...word,
    language: userLanguage,
    quizType: 'review'
  }));

  console.log(`[QUIZ] Generated ${userLanguage} quiz with ${enhancedWords.length} words for user ${userId}`);
  
  res.json({
    words: enhancedWords,
    expected: expectedPhrase,
    language: userLanguage,
    quizType: offchainProfile?.completedLessons?.length > 0 ? 'review' : 'preview'
  });
});

// Helper function to generate language-specific expected phrases
function generateExpectedPhraseForLanguage(language, words) {
  const wordTerms = words.map(w => w.term).join(', ');
  
  const templates = {
    'spanish': `Estoy practicando las palabras: ${wordTerms}.`,
    'french': `Je pratique les mots: ${wordTerms}.`,
    'german': `Ich übe die Wörter: ${wordTerms}.`,
    'japanese': `これらのことばをれんしゅうしています: ${wordTerms}。`,
    'italian': `Sto praticando le parole: ${wordTerms}.`,
    'portuguese': `Estou praticando as palavras: ${wordTerms}.`,
    'korean': `이 단어들을 연습하고 있습니다: ${wordTerms}.`,
    'arabic': `أتدرب على هذه الكلمات: ${wordTerms}.`
  };
  
  return templates[language] || `I am practicing these words: ${wordTerms}.`;
}

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
    offchainProfile = createMockOffchainProfile(userId, '', false);
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
// DAILY ALLOWANCES AND TOKEN SPENDING
// =============================================================================

// In-memory storage for user allowances (resets daily)
const userAllowances = new Map();
const userTokenSpending = new Map();

// Initialize or get user allowances
function getUserAllowances(userId) {
  const today = new Date().toDateString();
  const userKey = `${userId}-${today}`;
  
  if (!userAllowances.has(userKey)) {
    userAllowances.set(userKey, {
      'ai-chat': { featureId: 'ai-chat', featureName: 'AI Chat', dailyLimit: 3, used: 0 },
      'pronunciation_assessment': { featureId: 'pronunciation_assessment', featureName: 'Pronunciation Assessment', dailyLimit: 2, used: 0 }
    });
  }
  
  return userAllowances.get(userKey);
}

// GET /allowances/daily - Get daily allowances for all features
apiRouter.get('/allowances/daily', authenticateToken, (req, res) => {
  const userId = req.user?.id || 'default-user';
  const allowances = getUserAllowances(userId);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const allowanceList = Object.values(allowances).map(allowance => ({
    featureId: allowance.featureId,
    featureName: allowance.featureName,
    dailyLimit: allowance.dailyLimit,
    used: allowance.used,
    remaining: Math.max(0, allowance.dailyLimit - allowance.used),
    resetsAt: tomorrow.toISOString()
  }));
  
  console.log(`[ALLOWANCES] Daily allowances requested for user: ${userId}`);
  res.json({ allowances: allowanceList });
});

// POST /allowances/check - Check if user can use a feature
apiRouter.post('/allowances/check', authenticateToken, (req, res) => {
  const { featureId, quantity = 1 } = req.body;
  const userId = req.user?.id || 'default-user';
  const allowances = getUserAllowances(userId);
  
  if (!featureId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing featureId'
    });
  }
  
  const allowance = allowances[featureId];
  if (!allowance) {
    // Feature not found, assume no free allowance - check tokens
    return res.json({
      canUse: false,
      reason: 'no_allowance',
      allowanceRemaining: 0
    });
  }
  
  const remaining = allowance.dailyLimit - allowance.used;
  const canUse = remaining >= quantity;
  
  console.log(`[ALLOWANCES] Check feature ${featureId} for user ${userId}: ${canUse ? 'allowed' : 'denied'} (${remaining} remaining)`);
  
  res.json({
    canUse,
    reason: canUse ? 'allowance_available' : 'allowance_exhausted',
    allowanceRemaining: Math.max(0, remaining)
  });
});

// POST /allowances/use - Use daily allowance for a feature
apiRouter.post('/allowances/use', authenticateToken, (req, res) => {
  const { featureId, quantity = 1 } = req.body;
  const userId = req.user?.id || 'default-user';
  const allowances = getUserAllowances(userId);
  
  if (!featureId) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing featureId'
    });
  }
  
  const allowance = allowances[featureId];
  if (!allowance) {
    return res.status(400).json({
      error: 'feature_not_found',
      message: 'Feature does not have daily allowances'
    });
  }
  
  const remaining = allowance.dailyLimit - allowance.used;
  if (remaining < quantity) {
    return res.status(400).json({
      error: 'insufficient_allowance',
      message: `Not enough daily allowance remaining. Need ${quantity}, have ${remaining}`
    });
  }
  
  // Use the allowance
  allowance.used += quantity;
  const newRemaining = allowance.dailyLimit - allowance.used;
  
  console.log(`[ALLOWANCES] Used ${quantity} allowance for ${featureId}, user ${userId}. Remaining: ${newRemaining}`);
  
  res.json({
    success: true,
    used: quantity,
    remaining: newRemaining,
    totalUsed: allowance.used,
    dailyLimit: allowance.dailyLimit
  });
});

// POST /tokens/validate-spending - Validate token spending (fallback when allowances exhausted)
apiRouter.post('/tokens/validate-spending', authenticateToken, (req, res) => {
  const { featureId, amount } = req.body;
  const userId = req.user?.id || 'default-user';
  
  if (!featureId || !amount) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing featureId or amount'
    });
  }
  
  // Mock token balance (in real app, this would check actual balance)
  const mockBalance = 50; // User has 50 tokens
  
  const canSpend = mockBalance >= amount;
  
  console.log(`[TOKENS] Validate spending ${amount} tokens for ${featureId}, user ${userId}: ${canSpend ? 'approved' : 'insufficient'}`);
  
  res.json({
    canSpend,
    currentBalance: mockBalance,
    reason: canSpend ? 'sufficient_balance' : 'insufficient_balance'
  });
});

// POST /tokens/spend - Spend tokens for a feature
apiRouter.post('/tokens/spend', authenticateToken, (req, res) => {
  const { featureId, amount, action, metadata } = req.body;
  const userId = req.user?.id || 'default-user';
  
  if (!featureId || !amount) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Missing featureId or amount'
    });
  }
  
  // Mock token spending (in real app, this would deduct from actual balance)
  const mockBalance = 50;
  if (mockBalance < amount) {
    return res.status(400).json({
      error: 'insufficient_tokens',
      message: 'Not enough tokens for this transaction'
    });
  }
  
  const newBalance = mockBalance - amount;
  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Track spending
  if (!userTokenSpending.has(userId)) {
    userTokenSpending.set(userId, []);
  }
  userTokenSpending.get(userId).push({
    transactionId,
    featureId,
    amount,
    action,
    metadata,
    timestamp: new Date().toISOString()
  });
  
  console.log(`[TOKENS] Spent ${amount} tokens for ${featureId}, user ${userId}. New balance: ${newBalance}`);
  
  res.json({
    success: true,
    transactionId,
    newBalance,
    tokensSpent: amount
  });
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
  // Initialize comprehensive language-specific lessons
  const lessons = [
    // Spanish Lessons (A1.1 Level)
    {
      lesson_id: 'spanish-basics-1',
      title: 'Conversación Básica',
      description: 'Aprende frases conversacionales básicas en español',
      language: 'spanish',
      level: 'A1.1',
      focus: 'conversation_basics',
      new_vocabulary: [
        {
          id: 'es-phrase-1',
          term: 'Me gusta aprender idiomas nuevos',
          translation: 'I like to learn new languages',
          difficulty: 1,
          examples: ['Me gusta aprender idiomas nuevos como el español.', '¿Te gusta aprender idiomas nuevos?'],
          tags: ['conversation', 'preferences', 'learning']
        },
        {
          id: 'es-phrase-2',
          term: 'Hola, ¿cómo estás?',
          translation: 'Hello, how are you?',
          difficulty: 1,
          examples: ['Hola, ¿cómo estás hoy?', 'Hola María, ¿cómo estás?'],
          tags: ['greeting', 'conversation']
        },
        {
          id: 'es-phrase-3',
          term: '¿De dónde eres?',
          translation: 'Where are you from?',
          difficulty: 1,
          examples: ['Hola, ¿de dónde eres?', 'Me puedes decir ¿de dónde eres?'],
          tags: ['conversation', 'introduction']
        },
        {
          id: 'es-phrase-4',
          term: 'Mucho gusto en conocerte',
          translation: 'Nice to meet you',
          difficulty: 1,
          examples: ['Mucho gusto en conocerte, Ana.', 'Igualmente, mucho gusto en conocerte.'],
          tags: ['politeness', 'introduction']
        }
      ],
      speaking_exercises: [
        {
          type: 'introduction',
          prompt: 'Preséntate usando las palabras que aprendiste',
          items: [
            {
              question: '¿Cómo te presentarías a alguien nuevo?',
              example_answer: 'Hola, me llamo [tu nombre]. Mucho gusto.'
            }
          ],
          leveling_note: 'Focus on clear pronunciation of vowels'
        }
      ],
      review_points: [
        'Spanish vowels are always pronounced the same way',
        'The letter "h" is silent in Spanish',
        'Remember to roll your "r" sounds lightly'
      ]
    },

    // French Lessons (A1.1 Level)
    {
      lesson_id: 'french-basics-1',
      title: 'Salutations de Base',
      description: 'Apprendre les salutations de base en français',
      language: 'french',
      level: 'A1.1',
      focus: 'greetings_and_introductions',
      new_vocabulary: [
        {
          id: 'fr-word-1',
          term: 'bonjour',
          translation: 'hello/good morning',
          difficulty: 1,
          examples: ['Bonjour, comment allez-vous?', 'Bonjour madame.'],
          tags: ['greeting', 'formal']
        },
        {
          id: 'fr-word-2',
          term: 'salut',
          translation: 'hi/bye',
          difficulty: 1,
          examples: ['Salut! Ça va?', 'Salut, à bientôt!'],
          tags: ['greeting', 'informal']
        },
        {
          id: 'fr-word-3',
          term: 'merci',
          translation: 'thank you',
          difficulty: 1,
          examples: ['Merci beaucoup!', 'Merci pour votre aide.'],
          tags: ['politeness', 'common']
        },
        {
          id: 'fr-word-4',
          term: 's\'il vous plaît',
          translation: 'please (formal)',
          difficulty: 2,
          examples: ['Aidez-moi, s\'il vous plaît.', 'Pouvez-vous répéter, s\'il vous plaît?'],
          tags: ['politeness', 'formal']
        }
      ],
      speaking_exercises: [
        {
          type: 'introduction',
          prompt: 'Présentez-vous en utilisant les mots que vous avez appris',
          items: [
            {
              question: 'Comment vous présenteriez-vous à quelqu\'un de nouveau?',
              example_answer: 'Bonjour, je m\'appelle [votre nom]. Enchanté(e).'
            }
          ],
          leveling_note: 'Pay attention to nasal vowels and liaison'
        }
      ],
      review_points: [
        'French has nasal vowels that don\'t exist in English',
        'Silent letters at the end of words are common',
        'Liaison connects words when speaking'
      ]
    },

    // German Lessons (A1.1 Level)
    {
      lesson_id: 'german-basics-1',
      title: 'Grundlegende Begrüßungen',
      description: 'Lerne grundlegende Begrüßungen auf Deutsch',
      language: 'german',
      level: 'A1.1',
      focus: 'greetings_and_introductions',
      new_vocabulary: [
        {
          id: 'de-word-1',
          term: 'hallo',
          translation: 'hello',
          difficulty: 1,
          examples: ['Hallo, wie geht es dir?', 'Hallo! Schön dich zu sehen.'],
          tags: ['greeting', 'common']
        },
        {
          id: 'de-word-2',
          term: 'auf Wiedersehen',
          translation: 'goodbye',
          difficulty: 2,
          examples: ['Auf Wiedersehen! Bis morgen.', 'Auf Wiedersehen, hab einen schönen Tag.'],
          tags: ['farewell', 'formal']
        },
        {
          id: 'de-word-3',
          term: 'danke',
          translation: 'thank you',
          difficulty: 1,
          examples: ['Danke für deine Hilfe.', 'Vielen Dank!'],
          tags: ['politeness', 'common']
        },
        {
          id: 'de-word-4',
          term: 'bitte',
          translation: 'please/you\'re welcome',
          difficulty: 1,
          examples: ['Hilf mir bitte.', 'Bitte schön!'],
          tags: ['politeness', 'common']
        }
      ],
      speaking_exercises: [
        {
          type: 'introduction',
          prompt: 'Stelle dich vor mit den Wörtern, die du gelernt hast',
          items: [
            {
              question: 'Wie würdest du dich jemandem Neuen vorstellen?',
              example_answer: 'Hallo, ich heiße [dein Name]. Freut mich, dich kennenzulernen.'
            }
          ],
          leveling_note: 'Focus on umlauts (ä, ö, ü) and consonant clusters'
        }
      ],
      review_points: [
        'German has three types of umlauts: ä, ö, ü',
        'Consonant clusters can be challenging for English speakers',
        'Word stress usually falls on the first syllable'
      ]
    },

    // Japanese Lessons (A1.1 Level)
    {
      lesson_id: 'japanese-basics-1',
      title: 'きほんのあいさつ',
      description: 'Learn basic greetings in Japanese',
      language: 'japanese',
      level: 'A1.1',
      focus: 'greetings_and_introductions',
      new_vocabulary: [
        {
          id: 'ja-word-1',
          term: 'こんにちは',
          translation: 'hello/good afternoon',
          difficulty: 2,
          examples: ['こんにちは！げんきですか？', 'こんにちは。はじめまして。'],
          tags: ['greeting', 'common', 'hiragana']
        },
        {
          id: 'ja-word-2',
          term: 'さようなら',
          translation: 'goodbye',
          difficulty: 2,
          examples: ['さようなら！またあした。', 'さようなら。きをつけて。'],
          tags: ['farewell', 'formal', 'hiragana']
        },
        {
          id: 'ja-word-3',
          term: 'ありがとう',
          translation: 'thank you',
          difficulty: 2,
          examples: ['ありがとうございます。', 'ありがとう！'],
          tags: ['politeness', 'common', 'hiragana']
        },
        {
          id: 'ja-word-4',
          term: 'すみません',
          translation: 'excuse me/sorry',
          difficulty: 2,
          examples: ['すみません、たすけてください。', 'すみません！'],
          tags: ['politeness', 'common', 'hiragana']
        }
      ],
      speaking_exercises: [
        {
          type: 'introduction',
          prompt: 'まなんだことばをつかって、じこしょうかいしてください',
          items: [
            {
              question: 'あたらしいひとに、どうやってじこしょうかいしますか？',
              example_answer: 'こんにちは。わたしは[なまえ]です。よろしくおねがいします。'
            }
          ],
          leveling_note: 'Focus on correct pitch accent and long vowels'
        }
      ],
      review_points: [
        'Japanese uses pitch accent, not stress accent',
        'Long vowels are important for meaning',
        'Politeness levels change the vocabulary used'
      ]
    },

    // Italian Lessons (A1.1 Level)
    {
      lesson_id: 'italian-basics-1',
      title: 'Saluti di Base',
      description: 'Impara i saluti di base in italiano',
      language: 'italian',
      level: 'A1.1',
      focus: 'greetings_and_introductions',
      new_vocabulary: [
        {
          id: 'it-word-1',
          term: 'ciao',
          translation: 'hello/goodbye (informal)',
          difficulty: 1,
          examples: ['Ciao! Come stai?', 'Ciao, ci vediamo dopo!'],
          tags: ['greeting', 'informal', 'common']
        },
        {
          id: 'it-word-2',
          term: 'buongiorno',
          translation: 'good morning/good day',
          difficulty: 1,
          examples: ['Buongiorno, signora!', 'Buongiorno! Come va?'],
          tags: ['greeting', 'formal']
        },
        {
          id: 'it-word-3',
          term: 'grazie',
          translation: 'thank you',
          difficulty: 1,
          examples: ['Grazie mille!', 'Grazie per l\'aiuto.'],
          tags: ['politeness', 'common']
        },
        {
          id: 'it-word-4',
          term: 'per favore',
          translation: 'please',
          difficulty: 1,
          examples: ['Aiutami, per favore.', 'Puoi ripetere, per favore?'],
          tags: ['politeness', 'common']
        }
      ],
      speaking_exercises: [
        {
          type: 'introduction',
          prompt: 'Presentati usando le parole che hai imparato',
          items: [
            {
              question: 'Come ti presenteresti a qualcuno di nuovo?',
              example_answer: 'Ciao, mi chiamo [il tuo nome]. Piacere di conoscerti.'
            }
          ],
          leveling_note: 'Focus on rolling R sounds and double consonants'
        }
      ],
      review_points: [
        'Italian R is always rolled',
        'Double consonants are pronounced longer',
        'Vowels are always pronounced clearly'
      ]
    }
  ];

  lessons.forEach(lesson => {
    mockDatabase.lessons.set(lesson.lesson_id, lesson);
  });

  console.log('Mock lessons initialized with', lessons.length, 'language-specific lessons');
  console.log('Supported languages: Spanish, French, German, Japanese, Italian');
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
  console.log('📚 API Documentation: See API_SPECIFICATION.md');
});

// =============================================================================
// ENHANCED GRAMMAR SERVICE ENDPOINTS
// =============================================================================

// POST /grammar/evaluate - Comprehensive grammar evaluation with advanced features
apiRouter.post('/grammar/evaluate', authenticateToken, (req, res) => {
  const { text, language = 'en', level = 'intermediate', features = [] } = req.body;
  
  if (!text) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Text is required for grammar evaluation',
      details: 'The text field cannot be empty'
    });
  }

  // Validate text length (simulate security constraints)
  if (text.length > 5000) {
    return res.status(400).json({
      error: 'text_too_long',
      message: 'Text exceeds maximum length of 5000 characters',
      details: `Submitted text has ${text.length} characters`
    });
  }

  // Simulate content filtering
  const forbiddenWords = ['spam', 'malicious', 'harmful'];
  const hasForbiddenContent = forbiddenWords.some(word => 
    text.toLowerCase().includes(word.toLowerCase())
  );
  
  if (hasForbiddenContent) {
    return res.status(400).json({
      error: 'content_violation',
      message: 'Text contains inappropriate content',
      details: 'Content filtering detected potentially harmful material'
    });
  }

  // Advanced mock grammar evaluation response
  const baseScore = Math.floor(Math.random() * 30) + 70; // Base score 70-100
  let finalScore = baseScore;
  
  const mockEvaluation = {
    text: text,
    language: language,
    level: level,
    score: baseScore,
    grade: getGradeFromScore(baseScore),
    errors: [],
    suggestions: [],
    correctedText: text,
    metrics: {
      processing_time_ms: Math.floor(Math.random() * 300) + 100,
      text_length: text.length,
      word_count: text.split(/\s+/).length,
      sentence_count: text.split(/[.!?]+/).filter(s => s.trim()).length,
      complexity_score: Math.random().toFixed(2),
      readability_score: (Math.random() * 40 + 60).toFixed(1) // 60-100
    },
    analysis: {
      sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
      tone: ['formal', 'informal', 'academic', 'conversational'][Math.floor(Math.random() * 4)],
      detected_topics: generateRandomTopics(text),
      language_confidence: (Math.random() * 0.3 + 0.7).toFixed(3) // 0.7-1.0
    },
    analysisTimestamp: new Date().toISOString(),
    request_id: crypto.randomBytes(16).toString('hex')
  };

  // Advanced error simulation based on text complexity
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  // Grammar errors (more sophisticated)
  if (Math.random() < 0.25) {
    const errorTypes = [
      {
        type: 'grammar',
        rule: 'SVA_001',
        message: 'Subject-verb agreement issue detected',
        category: 'agreement',
        severity: 'high'
      },
      {
        type: 'grammar', 
        rule: 'TENSE_001',
        message: 'Inconsistent verb tense usage',
        category: 'tense',
        severity: 'medium'
      },
      {
        type: 'grammar',
        rule: 'PREP_001', 
        message: 'Incorrect preposition usage',
        category: 'preposition',
        severity: 'low'
      }
    ];
    
    const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    const wordIndex = Math.floor(Math.random() * Math.max(1, words.length - 1));
    const startPos = text.indexOf(words[wordIndex]);
    const endPos = startPos + words[wordIndex].length;
    
    mockEvaluation.errors.push({
      ...error,
      start: startPos,
      end: endPos,
      suggestion: `Consider revising "${words[wordIndex]}" for better ${error.category}`,
      affected_word: words[wordIndex],
      confidence: (Math.random() * 0.4 + 0.6).toFixed(2)
    });
    finalScore -= 8;
  }

  // Spelling errors
  if (Math.random() < 0.15) {
    const wordIndex = Math.floor(Math.random() * words.length);
    const startPos = text.indexOf(words[wordIndex]);
    const endPos = startPos + words[wordIndex].length;
    
    mockEvaluation.errors.push({
      type: 'spelling',
      rule: 'SPELL_001',
      message: 'Potential spelling error detected',
      category: 'spelling',
      severity: 'medium',
      start: startPos,
      end: endPos,
      suggestion: `Check spelling of "${words[wordIndex]}"`,
      affected_word: words[wordIndex],
      suggestions: generateSpellingSuggestions(words[wordIndex]),
      confidence: (Math.random() * 0.3 + 0.7).toFixed(2)
    });
    finalScore -= 5;
  }

  // Style suggestions
  if (Math.random() < 0.3) {
    mockEvaluation.suggestions.push({
      type: 'style',
      category: 'conciseness',
      message: 'Consider making this sentence more concise',
      improvement: 'Shorter sentences improve readability',
      impact: 'medium'
    });
  }

  // Vocabulary enhancement suggestions
  if (Math.random() < 0.2) {
    mockEvaluation.suggestions.push({
      type: 'vocabulary',
      category: 'enhancement',
      message: 'Consider using more varied vocabulary',
      improvement: 'Synonym suggestions can improve writing quality',
      impact: 'low'
    });
  }

  mockEvaluation.score = Math.max(0, Math.min(100, finalScore));
  mockEvaluation.grade = getGradeFromScore(mockEvaluation.score);

  console.log(`[GRAMMAR] Evaluated ${text.length} chars, score: ${mockEvaluation.score}, errors: ${mockEvaluation.errors.length}`);
  res.json(mockEvaluation);
});

// POST /grammar/examples - Generate example sentences for vocabulary
apiRouter.post('/grammar/examples', authenticateToken, (req, res) => {
  const { term, count = 3, difficulty = 'intermediate' } = req.body;
  
  if (!term) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Term is required for example generation'
    });
  }

  const examples = [];
  const templates = [
    `The ${term} is very important in this context.`,
    `I learned about ${term} yesterday.`,
    `Understanding ${term} helps improve communication.`,
    `Students often struggle with ${term} concepts.`,
    `The definition of ${term} varies by field.`,
    `Many people find ${term} challenging at first.`,
    `${term} plays a crucial role in language learning.`
  ];

  for (let i = 0; i < Math.min(count, 10); i++) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    examples.push({
      sentence: template,
      difficulty: difficulty,
      context: ['academic', 'casual', 'professional'][Math.floor(Math.random() * 3)],
      grammar_focus: ['vocabulary', 'structure', 'usage'][Math.floor(Math.random() * 3)]
    });
  }

  res.json({
    term,
    examples,
    count: examples.length,
    generated_at: new Date().toISOString()
  });
});

// GET /grammar/rules - Get available grammar rules and explanations
apiRouter.get('/grammar/rules', (req, res) => {
  const { category, language = 'en' } = req.query;
  
  const allRules = {
    agreement: [
      {
        id: 'SVA_001',
        name: 'Subject-Verb Agreement',
        description: 'Subjects and verbs must agree in number',
        examples: ['The cat runs', 'The cats run'],
        difficulty: 'beginner'
      }
    ],
    tense: [
      {
        id: 'TENSE_001',
        name: 'Consistent Tense Usage',
        description: 'Maintain consistent verb tense throughout text',
        examples: ['I walked to school and bought lunch', 'I walk to school and buy lunch'],
        difficulty: 'intermediate'
      }
    ],
    punctuation: [
      {
        id: 'PUNCT_001',
        name: 'Comma Usage',
        description: 'Proper comma placement in sentences',
        examples: ['I went to the store, and I bought milk'],
        difficulty: 'intermediate'
      }
    ]
  };

  let rules = category ? allRules[category] || [] : Object.values(allRules).flat();
  
  res.json({
    language,
    category: category || 'all',
    rules,
    total_rules: rules.length
  });
});

// GET /grammar/healthz - Enhanced health check
apiRouter.get('/grammar/healthz', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'grammar-service',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: [
      'grammar_evaluation',
      'spell_checking',
      'style_analysis',
      'example_generation',
      'rule_explanations'
    ],
    security_features: [
      'rate_limiting',
      'content_filtering', 
      'threat_detection',
      'input_sanitization',
      'audit_logging'
    ],
    supported_languages: ['en', 'es', 'fr', 'de'],
    metrics: {
      uptime_seconds: Math.floor(Math.random() * 86400),
      total_requests: Math.floor(Math.random() * 10000),
      average_response_time_ms: Math.floor(Math.random() * 200) + 50
    }
  });
});

// Helper functions for grammar service
function getGradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function generateRandomTopics(text) {
  const topics = ['education', 'technology', 'science', 'culture', 'business', 'health'];
  const numTopics = Math.floor(Math.random() * 3) + 1;
  return topics.sort(() => Math.random() - 0.5).slice(0, numTopics);
}

function generateSpellingSuggestions(word) {
  // Simple mock spelling suggestions
  const suggestions = [
    word.replace(/ie/g, 'ei'),
    word.replace(/ei/g, 'ie'),
    word + 'e',
    word.slice(0, -1)
  ].filter(s => s !== word && s.length > 2);
  
  return suggestions.slice(0, 3);
}

// =============================================================================
// gRPC SERVICE HTTP PROXY ENDPOINTS
// =============================================================================

// TTS Service HTTP Proxy Endpoints
// POST /tts/generate-speech - HTTP proxy for TTS gRPC GenerateSpeech
apiRouter.post('/tts/generate-speech', authenticateToken, (req, res) => {
  const { text, language_code = 'en-US', voice_id = 'neural-en-US-1', audio_format = 'wav' } = req.body;
  
  if (!text) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Text is required for speech generation'
    });
  }

  // Validate text length
  if (text.length > 2000) {
    return res.status(400).json({
      error: 'text_too_long',
      message: 'Text exceeds maximum length of 2000 characters'
    });
  }

  // Mock TTS response with realistic timing
  const processingTime = Math.floor(text.length * 50 + Math.random() * 500); // Simulate processing time
  
  setTimeout(() => {
    const mockResponse = {
      success: true,
      message: 'Speech generated successfully',
      audio_data: `mock_audio_${crypto.randomBytes(16).toString('hex')}`, // Mock audio data
      audio_format: audio_format,
      duration_ms: Math.floor(text.length * 100 + Math.random() * 1000),
      voice_id: voice_id,
      language_code: language_code,
      phonemes: generateMockPhonemes(text),
      metadata: {
        text_length: text.length,
        processing_time_ms: processingTime,
        provider: 'azure-neural',
        model_version: '2.1.0'
      },
      generated_at: new Date().toISOString()
    };

    console.log(`[TTS] Generated speech for "${text.substring(0, 50)}..." (${text.length} chars)`);
    res.json(mockResponse);
  }, Math.min(processingTime, 2000)); // Cap at 2 seconds
});

// POST /tts/generate-phoneme - HTTP proxy for TTS gRPC GeneratePhonemeAudio
apiRouter.post('/tts/generate-phoneme', authenticateToken, (req, res) => {
  const { phoneme, language_code = 'en-US', voice_id = 'neural-en-US-1' } = req.body;
  
  if (!phoneme) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Phoneme is required'
    });
  }

  const mockResponse = {
    success: true,
    message: 'Phoneme audio generated successfully',
    phoneme: phoneme,
    audio_data: `mock_phoneme_${crypto.randomBytes(8).toString('hex')}`,
    duration_ms: Math.floor(Math.random() * 500) + 200,
    language_code: language_code,
    voice_id: voice_id,
    ipa_notation: convertToIPA(phoneme),
    metadata: {
      provider: 'azure-neural',
      quality: 'high',
      sample_rate: 44100
    },
    generated_at: new Date().toISOString()
  };

  console.log(`[TTS] Generated phoneme audio for: ${phoneme}`);
  res.json(mockResponse);
});

// GET /tts/voices - HTTP proxy for TTS gRPC ListVoices
apiRouter.get('/tts/voices', (req, res) => {
  const { language_code } = req.query;
  
  const allVoices = {
    'en-US': [
      { id: 'neural-en-US-1', name: 'Emma', gender: 'female', style: 'neutral' },
      { id: 'neural-en-US-2', name: 'Brian', gender: 'male', style: 'neutral' },
      { id: 'neural-en-US-3', name: 'Aria', gender: 'female', style: 'cheerful' }
    ],
    'es-ES': [
      { id: 'neural-es-ES-1', name: 'Elvira', gender: 'female', style: 'neutral' },
      { id: 'neural-es-ES-2', name: 'Alvaro', gender: 'male', style: 'neutral' }
    ],
    'fr-FR': [
      { id: 'neural-fr-FR-1', name: 'Denise', gender: 'female', style: 'neutral' },
      { id: 'neural-fr-FR-2', name: 'Henri', gender: 'male', style: 'neutral' }
    ]
  };

  const voices = language_code ? allVoices[language_code] || [] : Object.values(allVoices).flat();
  
  res.json({
    success: true,
    voices: voices,
    total_voices: voices.length,
    supported_languages: Object.keys(allVoices),
    provider_info: {
      name: 'Azure Cognitive Services',
      version: '2.1.0',
      capabilities: ['neural_voices', 'custom_styles', 'ssml_support']
    }
  });
});

// Alignment Service HTTP Proxy Endpoints  
// POST /alignment/align - HTTP proxy for Alignment gRPC AlignAudio
apiRouter.post('/alignment/align', authenticateToken, (req, res) => {
  const { audio_data, text, language_code = 'en-US', audio_format = 'wav', alignment_level = 'word' } = req.body;
  
  if (!audio_data || !text) {
    return res.status(400).json({
      error: 'invalid_input', 
      message: 'Both audio_data and text are required'
    });
  }

  // Simulate processing time based on audio length
  const processingTime = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
  
  setTimeout(() => {
    const words = text.split(/\s+/).filter(w => w.trim());
    const mockResponse = {
      success: true,
      message: 'Audio aligned successfully',
      alignment_id: crypto.randomBytes(16).toString('hex'),
      text: text,
      language_code: language_code,
      alignment_level: alignment_level,
      word_alignments: generateWordAlignments(words),
      phoneme_alignments: alignment_level === 'phoneme' ? generatePhonemeAlignments(words) : [],
      metadata: {
        audio_duration_ms: Math.floor(Math.random() * 10000) + 5000,
        processing_time_ms: processingTime,
        model_version: 'whisperx-v3',
        confidence_threshold: 0.85
      },
      aligned_at: new Date().toISOString()
    };

    console.log(`[ALIGNMENT] Aligned "${text}" with ${alignment_level} level`);
    res.json(mockResponse);
  }, Math.min(processingTime, 3000));
});

// Pronunciation Scorer HTTP Proxy Endpoints
// POST /pronunciation-scorer/score - HTTP proxy for Pronunciation Scorer gRPC
apiRouter.post('/pronunciation-scorer/score', authenticateToken, (req, res) => {
  const { audio_data, reference_text, language_code = 'en-US', reference_alignment } = req.body;
  
  if (!audio_data || !reference_text) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Both audio_data and reference_text are required'
    });
  }

  // Simulate AI processing time
  const processingTime = Math.floor(Math.random() * 2000) + 500; // 0.5-2.5 seconds
  
  setTimeout(() => {
    const words = reference_text.split(/\s+/).filter(w => w.trim());
    const overallScore = (Math.random() * 0.4 + 0.6); // 0.6-1.0 range
    
    const mockResponse = {
      success: true,
      message: 'Pronunciation scored successfully',
      overall_score: parseFloat(overallScore.toFixed(3)),
      grade: getScoreGrade(overallScore),
      reference_text: reference_text,
      language_code: language_code,
      word_scores: generateWordScores(words, overallScore),
      phoneme_scores: generatePhonemeScores(words, overallScore),
      detailed_feedback: {
        strengths: generateStrengths(overallScore),
        improvements: generateImprovements(overallScore),
        focus_areas: generateFocusAreas(words)
      },
      metrics: {
        processing_time_ms: processingTime,
        model_confidence: (Math.random() * 0.2 + 0.8).toFixed(3),
        audio_quality: ['excellent', 'good', 'fair'][Math.floor(overallScore * 3)],
        noise_level: (Math.random() * 0.3).toFixed(2)
      },
      scored_at: new Date().toISOString()
    };

    console.log(`[PRONUNCIATION-SCORER] Scored "${reference_text}" - Overall: ${overallScore.toFixed(3)}`);
    res.json(mockResponse);
  }, Math.min(processingTime, 2500));
});

// Voice Score Service HTTP Proxy Endpoints
// POST /voice-score/evaluate - HTTP proxy for Voice Score gRPC Evaluate
apiRouter.post('/voice-score/evaluate', authenticateToken, (req, res) => {
  const { audio_data, reference_text, language_code = 'en-US', audio_format = 'wav' } = req.body;
  
  if (!audio_data || !reference_text) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Both audio_data and reference_text are required'
    });
  }

  // Simulate comprehensive pipeline processing
  const processingTime = Math.floor(Math.random() * 4000) + 2000; // 2-6 seconds
  
  setTimeout(() => {
    const overallScore = (Math.random() * 0.4 + 0.6);
    const words = reference_text.split(/\s+/).filter(w => w.trim());
    
    const mockResponse = {
      success: true,
      message: 'Voice evaluation completed successfully',
      overall_score: parseFloat(overallScore.toFixed(3)),
      grade: getScoreGrade(overallScore),
      reference_text: reference_text,
      language_code: language_code,
      
      // Pipeline results
      alignment_result: {
        success: true,
        word_alignments: generateWordAlignments(words),
        phoneme_alignments: generatePhonemeAlignments(words)
      },
      
      pronunciation_result: {
        success: true,
        word_scores: generateWordScores(words, overallScore),
        phoneme_scores: generatePhonemeScores(words, overallScore)
      },
      
      comprehensive_feedback: {
        pronunciation_accuracy: parseFloat((overallScore * 0.9 + Math.random() * 0.1).toFixed(3)),
        fluency_score: parseFloat((overallScore * 0.8 + Math.random() * 0.2).toFixed(3)),
        rhythm_score: parseFloat((overallScore * 0.85 + Math.random() * 0.15).toFixed(3)),
        stress_pattern: parseFloat((overallScore * 0.9 + Math.random() * 0.1).toFixed(3)),
        intonation: parseFloat((overallScore * 0.75 + Math.random() * 0.25).toFixed(3))
      },
      
      recommendations: generateRecommendations(overallScore),
      
      metrics: {
        total_processing_time_ms: processingTime,
        alignment_time_ms: Math.floor(processingTime * 0.4),
        scoring_time_ms: Math.floor(processingTime * 0.6),
        service_version: '3.0.0',
        pipeline_version: '2.1.0'
      },
      
      evaluated_at: new Date().toISOString()
    };

    console.log(`[VOICE-SCORE] Comprehensive evaluation completed - Score: ${overallScore.toFixed(3)}`);
    res.json(mockResponse);
  }, Math.min(processingTime, 5000));
});

// Health check endpoints for gRPC services
apiRouter.get('/tts/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tts-service',
    version: '2.1.0',
    grpc_port: 50053,
    features: ['speech_generation', 'phoneme_audio', 'multi_voice', 'neural_synthesis'],
    providers: ['azure', 'aws', 'google', 'mozilla'],
    uptime_seconds: Math.floor(Math.random() * 86400)
  });
});

apiRouter.get('/alignment/health', (req, res) => {
  res.json({
    status: 'healthy', 
    service: 'alignment-service',
    version: '1.8.0',
    grpc_port: 50052,
    features: ['word_alignment', 'phoneme_alignment', 'whisperx_integration'],
    supported_languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE'],
    model_status: 'loaded',
    uptime_seconds: Math.floor(Math.random() * 86400)
  });
});

apiRouter.get('/pronunciation-scorer/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'pronunciation-scorer-service', 
    version: '1.5.0',
    grpc_port: 50055,
    features: ['gop_scoring', 'phoneme_analysis', 'confidence_metrics'],
    models_loaded: ['en-US', 'es-ES', 'fr-FR'],
    scoring_providers: ['kaldi-gop', 'azure-fallback'],
    uptime_seconds: Math.floor(Math.random() * 86400)
  });
});

apiRouter.get('/voice-score/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'voice-score-service',
    version: '3.0.0', 
    grpc_port: 50054,
    features: ['comprehensive_evaluation', 'pipeline_orchestration', 'detailed_feedback'],
    pipeline_services: {
      alignment: 'healthy',
      pronunciation_scorer: 'healthy',
      tts: 'healthy'
    },
    uptime_seconds: Math.floor(Math.random() * 86400)
  });
});

// Helper functions for gRPC proxy endpoints
function generateMockPhonemes(text) {
  const words = text.split(/\s+/);
  return words.map((word, index) => ({
    word: word,
    phonemes: word.split('').map(char => ({ 
      symbol: char.toLowerCase(), 
      start_time: index * 500 + Math.random() * 100,
      duration: Math.random() * 200 + 100
    }))
  }));
}

function convertToIPA(phoneme) {
  const ipaMap = {
    'a': 'ə', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɔ', 'u': 'ʊ',
    'th': 'θ', 'sh': 'ʃ', 'ch': 'tʃ', 'ng': 'ŋ'
  };
  return ipaMap[phoneme.toLowerCase()] || phoneme;
}

function generateWordAlignments(words) {
  let currentTime = 0;
  return words.map(word => {
    const duration = Math.floor(Math.random() * 800) + 300; // 300-1100ms
    const alignment = {
      word: word,
      start_time: currentTime,
      end_time: currentTime + duration,
      confidence: parseFloat((Math.random() * 0.3 + 0.7).toFixed(3))
    };
    currentTime += duration + Math.floor(Math.random() * 200); // Gap between words
    return alignment;
  });
}

function generatePhonemeAlignments(words) {
  const phonemeAlignments = [];
  let currentTime = 0;
  
  words.forEach(word => {
    const phonemes = word.split(''); // Simplified phoneme splitting
    phonemes.forEach(phoneme => {
      const duration = Math.floor(Math.random() * 150) + 50; // 50-200ms
      phonemeAlignments.push({
        phoneme: phoneme,
        word: word,
        start_time: currentTime,
        end_time: currentTime + duration,
        confidence: parseFloat((Math.random() * 0.2 + 0.8).toFixed(3))
      });
      currentTime += duration;
    });
    currentTime += Math.floor(Math.random() * 100); // Gap between words
  });
  
  return phonemeAlignments;
}

function generateWordScores(words, baseScore) {
  return words.map(word => ({
    word: word,
    score: parseFloat((baseScore + (Math.random() - 0.5) * 0.3).toFixed(3)),
    confidence: parseFloat((Math.random() * 0.2 + 0.8).toFixed(3)),
    issues: Math.random() < 0.3 ? ['pronunciation'] : []
  }));
}

function generatePhonemeScores(words, baseScore) {
  const phonemeScores = [];
  words.forEach(word => {
    const phonemes = word.split('');
    phonemes.forEach(phoneme => {
      phonemeScores.push({
        phoneme: phoneme,
        word: word,
        score: parseFloat((baseScore + (Math.random() - 0.5) * 0.4).toFixed(3)),
        confidence: parseFloat((Math.random() * 0.2 + 0.8).toFixed(3)),
        ipa_target: convertToIPA(phoneme),
        feedback: Math.random() < 0.2 ? 'needs_practice' : 'good'
      });
    });
  });
  return phonemeScores;
}

function getScoreGrade(score) {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B';
  if (score >= 0.7) return 'C';
  if (score >= 0.6) return 'D';
  return 'F';
}

function generateStrengths(score) {
  const strengths = [
    'Clear articulation',
    'Good rhythm',
    'Appropriate pace',
    'Correct stress patterns',
    'Natural intonation'
  ];
  const numStrengths = score > 0.8 ? 3 : score > 0.7 ? 2 : 1;
  return strengths.sort(() => Math.random() - 0.5).slice(0, numStrengths);
}

function generateImprovements(score) {
  if (score > 0.8) return [];
  
  const improvements = [
    'Focus on consonant clarity',
    'Work on vowel precision',
    'Practice word stress',
    'Improve sentence rhythm',
    'Enhance intonation patterns'
  ];
  const numImprovements = score < 0.6 ? 3 : score < 0.7 ? 2 : 1;
  return improvements.sort(() => Math.random() - 0.5).slice(0, numImprovements);
}

function generateFocusAreas(words) {
  const areas = ['consonants', 'vowels', 'stress', 'linking', 'rhythm'];
  return areas.sort(() => Math.random() - 0.5).slice(0, 2);
}

function generateRecommendations(score) {
  const recommendations = [];
  
  if (score < 0.7) {
    recommendations.push({
      type: 'practice',
      priority: 'high',
      message: 'Practice basic pronunciation drills daily',
      estimated_improvement: '15-20%'
    });
  }
  
  if (score < 0.8) {
    recommendations.push({
      type: 'focus',
      priority: 'medium', 
      message: 'Focus on problematic phonemes identified in the analysis',
      estimated_improvement: '10-15%'
    });
  }
  
  recommendations.push({
    type: 'maintenance',
    priority: 'low',
    message: 'Continue regular practice to maintain current level',
    estimated_improvement: '5-10%'
  });
  
  return recommendations;
}

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