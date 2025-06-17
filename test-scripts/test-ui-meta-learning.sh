#!/bin/bash

# Test 13: Meta-Learning Page
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test Meta-Learning page loads (SPA routing)
response=$(curl -s "$BASE_URL/ui/meta-learning")

# Check for expected HTML structure (SPA will load the same index.html)
if echo "$response" | grep -q "DOCTYPE html" && echo "$response" | grep -q "MiniMe-MCP Dashboard"; then
    echo "UI META-LEARNING: ✅ Meta-Learning page accessible"
    exit 0
else
    echo "UI META-LEARNING: ❌ Meta-Learning page failed to load"
    exit 1
fi