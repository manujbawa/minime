#!/bin/bash

# Test 11: UI Main Page
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test UI main page loads
response=$(curl -s "$BASE_URL/ui/")

# Check for expected content
if echo "$response" | grep -q "MiniMe-MCP Dashboard" && echo "$response" | grep -q "Digital Developer Twin"; then
    echo "UI MAIN: ✅ Main page loads successfully"
    exit 0
else
    echo "UI MAIN: ❌ Main page failed to load properly"
    exit 1
fi