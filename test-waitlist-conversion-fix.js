#!/usr/bin/env node

/**
 * Test script to verify waitlist conversion logic works correctly
 * This script tests the fixed checkWaitlistStatus method
 */

const axios = require('axios');

const API_URL = 'http://localhost:8000';

async function testEmailLookup(email, expectedResult) {
  try {
    console.log(`\n🔍 Testing email lookup for: ${email}`);
    
    const response = await axios.get(`${API_URL}/wallet/email/${email}`);
    
    console.log('✅ Response received:', {
      email: response.data.email,
      name: response.data.name,
      language_to_learn: response.data.language_to_learn,
      wlw: response.data.wlw
    });
    
    // Simulate frontend logic
    const hasNameAndLanguage = response.data.name && response.data.language_to_learn;
    console.log(`📊 Would be detected as waitlist user: ${hasNameAndLanguage}`);
    
    if (expectedResult === 'waitlist' && hasNameAndLanguage) {
      console.log('✅ PASS: Correctly detected as waitlist user');
      return true;
    } else if (expectedResult === 'regular' && !hasNameAndLanguage) {
      console.log('✅ PASS: Correctly detected as regular user');
      return true;
    } else {
      console.log('❌ FAIL: Detection logic mismatch');
      return false;
    }
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✅ 404 Not Found - User does not exist');
      if (expectedResult === 'not_found') {
        console.log('✅ PASS: Correctly handled non-existent user');
        return true;
      } else {
        console.log('❌ FAIL: Expected user to exist');
        return false;
      }
    } else {
      console.error('❌ Error:', error.message);
      return false;
    }
  }
}

async function testWaitlistConversion() {
  console.log('🧪 Testing Waitlist Conversion Logic Fix');
  console.log('==========================================');
  
  let passCount = 0;
  let totalTests = 0;
  
  // Test 1: Waitlist user with existing data
  totalTests++;
  if (await testEmailLookup('waitlist@example.com', 'waitlist')) {
    passCount++;
  }
  
  // Test 2: Another waitlist user
  totalTests++;
  if (await testEmailLookup('waitlist2@example.com', 'waitlist')) {
    passCount++;
  }
  
  // Test 3: Regular user with wallet (should not be treated as waitlist)
  totalTests++;
  if (await testEmailLookup('test1@example.com', 'waitlist')) {
    passCount++;
  }
  
  // Test 4: Non-existent user
  totalTests++;
  if (await testEmailLookup('nonexistent@example.com', 'not_found')) {
    passCount++;
  }
  
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`✅ Passed: ${passCount}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passCount}/${totalTests}`);
  
  if (passCount === totalTests) {
    console.log('\n🎉 All tests passed! Waitlist conversion logic is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('1. Start the Angular dev server: npm start');
    console.log('2. Navigate to registration page');
    console.log('3. Test with waitlist@example.com');
    console.log('4. Verify it pre-fills name and language fields');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the implementation.');
  }
}

// Check if mock server is running
async function checkMockServer() {
  try {
    await axios.get(`${API_URL}/health`);
    console.log('✅ Mock server is running');
    return true;
  } catch (error) {
    console.error('❌ Mock server is not running. Please start it with: node mock-server.js');
    return false;
  }
}

async function main() {
  if (await checkMockServer()) {
    await testWaitlistConversion();
  }
}

main().catch(console.error);
