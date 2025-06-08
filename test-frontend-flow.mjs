#!/usr/bin/env node

/**
 * Test frontend authentication flow
 * This simulates exactly what the frontend should do
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const API_BASE = 'http://localhost:3000';

// Hash passphrase like the frontend does
async function hashPassphrase(passphrase) {
  const salt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  
  const derivedKey = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const hash = crypto.createHash('sha256').update(keyBase64).digest('hex');
  
  return hash;
}

async function simulateFrontendFlow() {
  console.log('🧪 Simulating Frontend Registration Flow...\n');

  try {
    const email = 'waitlist2@example.com'; // Use the second waitlist user
    const passphrase = 'testpassword123';

    // Step 1: Check waitlist status (like RegistrationService.checkWaitlistStatus)
    console.log('Step 1: Frontend calls checkWaitlistStatus()');
    const checkResponse = await fetch(`${API_BASE}/wallet/email/${email}`);
    
    if (!checkResponse.ok) {
      console.log('❌ Waitlist check failed:', checkResponse.status);
      return;
    }
    
    const waitlistData = await checkResponse.json();
    console.log('✅ Waitlist user found:', {
      email: waitlistData.email,
      name: waitlistData.name,
      language_to_learn: waitlistData.language_to_learn,
      isWaitlistUser: waitlistData.isWaitlistUser
    });

    // Step 2: Hash passphrase
    console.log('\nStep 2: Frontend hashes passphrase');
    const passphraseHash = await hashPassphrase(passphrase);
    console.log('✅ Passphrase hashed');

    // Step 3: Call createWalletWithConversion (like RegistrationService.createWalletWithConversion)
    console.log('\nStep 3: Frontend calls createWalletWithConversion()');
    
    const mockEncryptedData = {
      encrypted_mnemonic: 'enc_' + Math.random().toString(36).substring(2, 32),
      salt: Math.random().toString(36).substring(2, 16),
      nonce: Math.random().toString(36).substring(2, 12),
      sei_address: 'sei1' + Math.random().toString(36).substring(2, 15),
      sei_public_key: 'sei_pub_' + Math.random().toString(36).substring(2, 32),
      eth_address: '0x' + Math.random().toString(36).substring(2, 40),
      eth_public_key: 'eth_pub_' + Math.random().toString(36).substring(2, 32)
    };

    const requestBody = {
      email: email,
      passphrase_hash: passphraseHash,
      encrypted_mnemonic: mockEncryptedData.encrypted_mnemonic,
      salt: mockEncryptedData.salt,
      nonce: mockEncryptedData.nonce,
      sei_address: mockEncryptedData.sei_address,
      sei_public_key: mockEncryptedData.sei_public_key,
      eth_address: mockEncryptedData.eth_address,
      eth_public_key: mockEncryptedData.eth_public_key
      // Note: No name or language_to_learn - these come from waitlist data
    };

    console.log('🔍 Request body keys:', Object.keys(requestBody));

    const createResponse = await fetch(`${API_BASE}/auth/wallet/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.log('❌ Wallet creation failed:', errorData);
      return;
    }

    const serverResponse = await createResponse.json();
    console.log('✅ Server response received');

    // Step 4: Map response like RegistrationService
    console.log('\nStep 4: Frontend maps server response');
    const result = {
      status: 'success',
      sei_address: serverResponse.walletAddress || mockEncryptedData.sei_address,
      eth_address: serverResponse.ethWalletAddress || mockEncryptedData.eth_address,
      waitlist_bonus: serverResponse.starting_points || 0,
      message: serverResponse.message || 'Account created successfully',
      starting_points: serverResponse.starting_points || 0,
      token: serverResponse.token,
      refreshToken: serverResponse.refreshToken,
      userId: serverResponse.userId,
      isWaitlistConversion: serverResponse.isWaitlistConversion || false,
      name: serverResponse.name,
      language_to_learn: serverResponse.language_to_learn
    };

    console.log('✅ Mapped result:', {
      token: result.token ? '[TOKEN PRESENT]' : '[NO TOKEN]',
      refreshToken: result.refreshToken ? '[REFRESH TOKEN PRESENT]' : '[NO REFRESH TOKEN]',
      userId: result.userId,
      sei_address: result.sei_address,
      eth_address: result.eth_address,
      starting_points: result.starting_points,
      isWaitlistConversion: result.isWaitlistConversion,
      name: result.name,
      language_to_learn: result.language_to_learn
    });

    // Step 5: Check if authentication should work
    console.log('\nStep 5: Check authentication readiness');
    
    if (result.token && result.userId) {
      console.log('✅ SUCCESS: Frontend has all required data for authentication');
      console.log('✅ RegistrationAuthService.completeAuthentication() should succeed');
      console.log('✅ Frontend should NOT fall back to /auth/wallet endpoint');
      
      // Simulate what completeAuthentication does
      console.log('\nStep 6: Simulate completeAuthentication()');
      console.log('- Setting token in TokenService ✅');
      console.log('- Setting refreshToken in TokenService ✅');
      console.log('- Creating user object with wallet addresses ✅');
      console.log('- Storing in localStorage ✅');
      console.log('- Calling AuthService.loadUserFromStorage() ✅');
      console.log('- Navigation to success page ✅');
      
    } else {
      console.log('❌ PROBLEM: Missing required authentication data');
      console.log('- Token present:', !!result.token);
      console.log('- UserId present:', !!result.userId);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
simulateFrontendFlow().catch(console.error);
