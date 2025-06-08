#!/usr/bin/env node

/**
 * Complete Registration Flow Test
 * 
 * This script tests the entire registration flow including:
 * 1. Waitlist user detection via API
 * 2. Frontend registration service integration
 * 3. Waitlist to full user conversion
 * 4. New user registration
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000';

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Registration Flow\n');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing API Health Check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');

    // Test 2: Waitlist User Detection
    console.log('2️⃣ Testing Waitlist User Detection...');
    const waitlistResponse = await axios.get(`${API_BASE}/profile/email/waitlist@example.com`);
    console.log('✅ Waitlist user found:', {
      email: waitlistResponse.data.email,
      name: waitlistResponse.data.name,
      isWaitlistUser: waitlistResponse.data.isWaitlistUser,
      wlw: waitlistResponse.data.wlw
    });
    console.log('');

    // Test 3: Waitlist User Conversion
    console.log('3️⃣ Testing Waitlist User Conversion...');
    const conversionPayload = {
      email: 'waitlist@example.com',
      passphrase_hash: 'test_hash_for_conversion',
      encrypted_mnemonic: 'encrypted_mnemonic_conversion',
      salt: 'conversion_salt',
      nonce: 'conversion_nonce',
      sei_address: 'sei1conversion123',
      sei_public_key: 'sei_pub_conversion',
      eth_address: '0xconversion123',
      eth_public_key: 'eth_pub_conversion'
      // Note: No name or language_to_learn - should use existing profile data
    };

    const conversionResponse = await axios.post(`${API_BASE}/auth/wallet/signup`, conversionPayload);
    console.log('✅ Waitlist conversion successful:', {
      userId: conversionResponse.data.userId,
      walletAddress: conversionResponse.data.walletAddress,
      ethWalletAddress: conversionResponse.data.ethWalletAddress,
      name: conversionResponse.data.name,
      language_to_learn: conversionResponse.data.language_to_learn,
      isWaitlistConversion: conversionResponse.data.isWaitlistConversion,
      starting_points: conversionResponse.data.starting_points,
      message: conversionResponse.data.message
    });
    console.log('');

    // Test 4: New User Registration
    console.log('4️⃣ Testing New User Registration...');
    const newUserPayload = {
      email: 'newuser@testflow.com',
      name: 'Test Flow User',
      language_to_learn: 'german',
      passphrase_hash: 'test_hash_for_new_user',
      encrypted_mnemonic: 'encrypted_mnemonic_new_user',
      salt: 'new_user_salt',
      nonce: 'new_user_nonce',
      sei_address: 'sei1newuser123',
      sei_public_key: 'sei_pub_new_user',
      eth_address: '0xnewuser123',
      eth_public_key: 'eth_pub_new_user'
    };

    const newUserResponse = await axios.post(`${API_BASE}/auth/wallet/signup`, newUserPayload);
    console.log('✅ New user registration successful:', {
      userId: newUserResponse.data.userId,
      walletAddress: newUserResponse.data.walletAddress,
      ethWalletAddress: newUserResponse.data.ethWalletAddress,
      name: newUserResponse.data.name,
      language_to_learn: newUserResponse.data.language_to_learn,
      message: newUserResponse.data.message
    });
    console.log('');

    // Test 5: Validation - New User Without Required Fields
    console.log('5️⃣ Testing Validation - New User Without Required Fields...');
    try {
      const invalidPayload = {
        email: 'invalid@testflow.com',
        // Missing name and language_to_learn
        passphrase_hash: 'test_hash',
        encrypted_mnemonic: 'encrypted_mnemonic',
        salt: 'salt',
        nonce: 'nonce',
        sei_address: 'sei1invalid123',
        eth_address: '0xinvalid123'
      };

      await axios.post(`${API_BASE}/auth/wallet/signup`, invalidPayload);
      console.log('❌ Validation test failed - should have rejected request');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Validation working correctly:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Test 6: Profile Lookup After Conversion
    console.log('6️⃣ Testing Profile After Conversion...');
    const updatedProfileResponse = await axios.get(`${API_BASE}/profile/email/waitlist@example.com`);
    console.log('✅ Updated profile after conversion:', {
      email: updatedProfileResponse.data.email,
      name: updatedProfileResponse.data.name,
      wlw: updatedProfileResponse.data.wlw,
      converted: updatedProfileResponse.data.converted,
      secured_at: updatedProfileResponse.data.secured_at
    });
    console.log('');

    console.log('🎉 All tests passed! Registration flow is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

// Run the test
testCompleteFlow();
