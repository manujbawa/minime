#!/bin/bash

# Test 12: MCP Tools Page
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test MCP Tools page loads (SPA routing)
response=$(curl -s "$BASE_URL/ui/mcp-tools")

# Check for expected HTML structure (SPA will load the same index.html)
if echo "$response" | grep -q "DOCTYPE html" && echo "$response" | grep -q "MiniMe-MCP Dashboard"; then
    echo "UI MCP TOOLS: ✅ MCP Tools page accessible"
    exit 0
else
    echo "UI MCP TOOLS: ❌ MCP Tools page failed to load"
    exit 1
fi