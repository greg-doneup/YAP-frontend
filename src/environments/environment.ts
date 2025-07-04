// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://perci.goyap.ai/api', // Temporarily point to live API for testing with /api prefix
  wsUrl: 'wss://perci.goyap.ai', // WebSocket URL for AI chat and real-time features
  rpcUrl: 'https://evm-rpc-testnet.sei-apis.com', // Use live RPC for testing
  enableErrorLogging: true // Added for error service logging control
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
