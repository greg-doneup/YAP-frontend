console.log('🧪 Testing YAP Frontend Registration Flow');

const axios = require('axios');

async function simpleTest() {
  try {
    console.log('Testing API connection...');
    const response = await axios.get('http://localhost:8000/health');
    console.log('✅ API is accessible:', response.status);
    
    console.log('Testing waitlist user lookup...');
    const userResponse = await axios.get('http://localhost:8000/auth/user/waitlist@example.com');
    console.log('✅ Waitlist user found:', userResponse.data);
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

simpleTest();
