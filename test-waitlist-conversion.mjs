#!/usr/bin/env node

/**
 * Test script to verify waitlist conversion functionality
 * This script simulates the frontend calls to test the complete flow
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const API_BASE = 'http://localhost:3000';

// Hash passphrase like the frontend does
async function hashPassphrase(passphrase) {
  const salt = 'x0xmbtbles0x' + passphrase;
  const iterations = 390000;
  
  // Use Node.js crypto to simulate frontend PBKDF2
  const derivedKey = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
  const keyBase64 = derivedKey.toString('base64');
  const hash = crypto.createHash('sha256').update(keyBase64).digest('hex');
  
  return hash;
}

async function testWaitlistConversion() {
  console.log('🧪 Testing Waitlist Conversion Flow...\n');

  try {
    // Step 1: Check waitlist status
    console.log('Step 1: Checking waitlist status for waitlist@example.com');
    const checkResponse = await fetch(`${API_BASE}/wallet/email/waitlist@example.com`);
    const waitlistData = await checkResponse.json();
    
    console.log('✅ Waitlist check response:', waitlistData);
    
    if (!waitlistData.isWaitlistUser) {
      console.log('❌ Email not found in waitlist');
      return;
    }
    
    // Step 2: Hash passphrase (like frontend does)
    console.log('\nStep 2: Hashing passphrase...');
    const passphrase = 'testpassword123';
    const passphraseHash = await hashPassphrase(passphrase);
    console.log('✅ Passphrase hashed');

    // Step 3: Create wallet with conversion
    console.log('\nStep 3: Creating wallet with waitlist conversion...');
    
    const walletData = {
      email: 'waitlist@example.com',
      passphrase_hash: passphraseHash,
      encrypted_mnemonic: 'enc_' + Math.random().toString(36).substring(2, 32),
      salt: Math.random().toString(36).substring(2, 16),
      nonce: Math.random().toString(36).substring(2, 12),
      sei_address: 'sei1' + Math.random().toString(36).substring(2, 15),
      sei_public_key: 'sei_pub_' + Math.random().toString(36).substring(2, 32),
      eth_address: '0x' + Math.random().toString(36).substring(2, 40),
      eth_public_key: 'eth_pub_' + Math.random().toString(36).substring(2, 32)
    };

    const createResponse = await fetch(`${API_BASE}/auth/wallet/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(walletData)
    });

    const createResult = await createResponse.json();
    
    if (createResponse.ok) {
      console.log('✅ Wallet creation successful!');
      console.log('Response:', {
        token: createResult.token ? '[TOKEN PRESENT]' : '[NO TOKEN]',
        refreshToken: createResult.refreshToken ? '[REFRESH TOKEN PRESENT]' : '[NO REFRESH TOKEN]',
        userId: createResult.userId,
        walletAddress: createResult.walletAddress,
        ethWalletAddress: createResult.ethWalletAddress,
        starting_points: createResult.starting_points,
        isWaitlistConversion: createResult.isWaitlistConversion,
        name: createResult.name,
        language_to_learn: createResult.language_to_learn,
        message: createResult.message
      });
      
      // Verify tokens are present
      if (createResult.token && createResult.userId) {
        console.log('\n✅ SUCCESS: All required fields are present for authentication');
        console.log('✅ Frontend should be able to use these tokens directly');
      } else {
        console.log('\n❌ PROBLEM: Missing token or userId in response');
        console.log('Token present:', !!createResult.token);
        console.log('UserId present:', !!createResult.userId);
      }
      
    } else {
      console.log('❌ Wallet creation failed:', createResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test standard registration too
async function testStandardRegistration() {
  console.log('\n🧪 Testing Standard Registration Flow...\n');

  try {
    console.log('Step 1: Creating wallet for new user...');
    
    const passphrase = 'newuserpassword123';
    const passphraseHash = await hashPassphrase(passphrase);
    
    const walletData = {
      email: 'newuser@example.com',
      name: 'New User',
      language_to_learn: 'french',
      passphrase_hash: passphraseHash,
      encrypted_mnemonic: 'enc_' + Math.random().toString(36).substring(2, 32),
      salt: Math.random().toString(36).substring(2, 16),
      nonce: Math.random().toString(36).substring(2, 12),
      sei_address: 'sei1' + Math.random().toString(36).substring(2, 15),
      sei_public_key: 'sei_pub_' + Math.random().toString(36).substring(2, 32),
      eth_address: '0x' + Math.random().toString(36).substring(2, 40),
      eth_public_key: 'eth_pub_' + Math.random().toString(36).substring(2, 32)
    };

    const createResponse = await fetch(`${API_BASE}/auth/wallet/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(walletData)
    });

    const createResult = await createResponse.json();
    
    if (createResponse.ok) {
      console.log('✅ Standard registration successful!');
      console.log('Response:', {
        token: createResult.token ? '[TOKEN PRESENT]' : '[NO TOKEN]',
        refreshToken: createResult.refreshToken ? '[REFRESH TOKEN PRESENT]' : '[NO REFRESH TOKEN]',
        userId: createResult.userId,
        walletAddress: createResult.walletAddress,
        ethWalletAddress: createResult.ethWalletAddress,
        starting_points: createResult.starting_points,
        isWaitlistConversion: createResult.isWaitlistConversion,
        name: createResult.name,
        language_to_learn: createResult.language_to_learn,
        message: createResult.message
      });
    } else {
      console.log('❌ Standard registration failed:', createResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
(async () => {
  try {
    await testWaitlistConversion();
    await testStandardRegistration();
  } catch (error) {
    console.error('❌ Top-level error:', error);
  }
})().catch(console.error);
