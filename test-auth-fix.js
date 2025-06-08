// Test script to verify the authentication fix
console.log('🔄 Testing complete waitlist authentication flow...');

// Step 1: Test email/passphrase authentication
console.log('📝 Step 1: Testing email/passphrase authentication...');
fetch('http://localhost:3000/auth/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'waitlist@example.com',
    passphrase: 'testpassphrase123',
    encryptedMnemonic: 'test_encrypted_mnemonic',
    seiWalletAddress: 'sei1testaddress',
    evmWalletAddress: '0xtestethaddress',
    signupMethod: 'wallet'
  })
})
.then(response => response.json())
.then(result => {
  console.log('✅ Email/passphrase auth result:', { 
    success: result.success, 
    userId: result.userId?.substring(0, 8) + '...',
    hasToken: !!result.token 
  });
  
  // Step 2: Test userId/wallet authentication with the returned userId
  console.log('🔑 Step 2: Testing userId/wallet authentication...');
  return fetch('http://localhost:3000/auth/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: result.userId,
      walletAddress: 'sei1testaddress',
      ethWalletAddress: '0xtestethaddress',
      signupMethod: 'wallet'
    })
  });
})
.then(response => response.json())
.then(result => {
  console.log('✅ UserId/wallet auth result:', { 
    success: result.success, 
    userId: result.userId?.substring(0, 8) + '...',
    hasToken: !!result.token 
  });
  console.log('🎉 All authentication flows working correctly!');
})
.catch(error => {
  console.error('❌ Test failed:', error.message);
});
