#!/bin/bash

# Complete Authentication System Test
# Tests the fixed authentication flow for the language learning app

echo "🧪 Complete Authentication System Test"
echo "======================================="

# Change to frontend directory
cd /Users/gregbrown/github/YAP/YAP-frontend

# Function to check if server is running
check_server() {
    curl -s http://localhost:3000/health > /dev/null 2>&1
    return $?
}

# Start mock server in background if not running
if ! check_server; then
    echo "🚀 Starting mock server..."
    node mock-server.js &
    SERVER_PID=$!
    
    # Wait for server to start
    for i in {1..10}; do
        if check_server; then
            echo "✅ Mock server started successfully"
            break
        fi
        echo "⏳ Waiting for server to start... ($i/10)"
        sleep 2
    done
    
    if ! check_server; then
        echo "❌ Failed to start mock server"
        exit 1
    fi
else
    echo "✅ Mock server already running"
fi

# Run the authentication test
echo ""
echo "🔍 Running authentication fix verification..."
node test-auth-complete.js

# Capture the exit code
TEST_EXIT_CODE=$?

# Clean up background server if we started it
if [ ! -z "$SERVER_PID" ]; then
    echo ""
    echo "🧹 Cleaning up background server..."
    kill $SERVER_PID 2>/dev/null
fi

# Report results
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 AUTHENTICATION FIX VERIFICATION PASSED"
    echo "   The learning service now properly passes user IDs"
    echo "   Users will receive language-specific vocabulary!"
else
    echo "❌ AUTHENTICATION FIX VERIFICATION FAILED"
    echo "   Please check the implementation"
fi

exit $TEST_EXIT_CODE
