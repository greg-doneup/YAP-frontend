export const environment = {
  production: true,
  apiUrl: 'https://perci.goyap.ai/api',  // Fixed: Use proper API URL with /api prefix
  wsUrl: 'wss://perci.goyap.ai',    // WebSocket URL for AI chat and real-time features
  rpcUrl: 'https://evm-rpc-testnet.sei-apis.com',  // Fixed: Use correct SEI EVM testnet RPC
  enableErrorLogging: false
};
