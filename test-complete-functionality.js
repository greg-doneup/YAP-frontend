#!/usr/bin/env node

/**
 * Test script to verify the complete pronunciation practice functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:4200';

async function testEndpoints() {
  console.log('🧪 Testing YAP Pronunciation Practice Feature...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(`✅ Health check: ${healthResponse.data.status}\n`);

    // Test 2: Daily vocabulary with userId (should return Spanish phrases)
    console.log('2. Testing /learning/daily with userId...');
    const dailyWithUserResponse = await axios.get(`${BASE_URL}/learning/daily?userId=waitlist-user-main`);
    console.log(`✅ Daily vocab with userId: ${dailyWithUserResponse.data.length} items`);
    console.log(`   First phrase: "${dailyWithUserResponse.data[0].term}" -> "${dailyWithUserResponse.data[0].translation}"`);
    console.log(`   Language: ${dailyWithUserResponse.data[0].language}\n`);

    // Test 3: Daily vocabulary without userId (should return default)
    console.log('3. Testing /learning/daily without userId...');
    const dailyWithoutUserResponse = await axios.get(`${BASE_URL}/learning/daily`);
    console.log(`✅ Daily vocab without userId: ${dailyWithoutUserResponse.data.length} items`);
    console.log(`   Default phrase: "${dailyWithoutUserResponse.data[0].term}" -> "${dailyWithoutUserResponse.data[0].translation}"\n`);

    // Test 4: TTS endpoint
    console.log('4. Testing TTS functionality...');
    const ttsResponse = await axios.post(`${BASE_URL}/learning/daily/tts/sentence`, {
      text: "Hola, ¿cómo estás?",
      languageCode: "es-ES"
    });
    console.log(`✅ TTS response: ${ttsResponse.status === 200 ? 'Success' : 'Failed'}\n`);

    // Test 5: Pronunciation assessment
    console.log('5. Testing pronunciation assessment...');
    const pronResponse = await axios.post(`${BASE_URL}/learning/daily/complete`, {
      userId: "waitlist-user-main",
      lessonId: "spanish-basics-1",
      wordId: "es-phrase-1",
      audio: "fake-audio-data",
      transcript: "Hola, ¿cómo estás?",
      detailLevel: "detailed",
      languageCode: "es-ES"
    });
    console.log(`✅ Pronunciation assessment: Score ${pronResponse.data.pronunciationScore}/100\n`);

    console.log('🎉 All backend endpoints are working correctly!');
    console.log(`🌐 Frontend available at: ${FRONTEND_URL}`);
    console.log('📱 Test routes:');
    console.log('   • Pronunciation Practice: /practice');
    console.log('   • Vocabulary Practice: /vocab-practice');
    console.log('   • Dashboard: /dashboard\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

testEndpoints();
