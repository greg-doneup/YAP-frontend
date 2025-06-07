const path = require('path');

module.exports = {
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "assert": require.resolve("assert"),
      "vm": require.resolve("vm-browserify"),
      "buffer": require.resolve("buffer"),
      "path": require.resolve("path-browserify"),
      "url": require.resolve("url"),
      "util": require.resolve("util")
    }
  },
  plugins: [
    new (require('webpack')).ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ]
};
