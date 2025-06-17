#!/bin/bash

# Test 8: MCP Tools Discovery
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test MCP tools discovery
response=$(curl -s "$BASE_URL/mcp/status?full=true")
tool_count=$(echo "$response" | jq -r '.capabilities.tools.count // 0')
available_tools=$(echo "$response" | jq -r '.capabilities.tools.available | length')

# Validate results
if [[ "$tool_count" -eq 17 && "$available_tools" -eq 17 ]]; then
    echo "MCP TOOLS: ✅ All $tool_count tools discovered with full schemas"
    exit 0
else
    echo "MCP TOOLS: ❌ Tool discovery failed - Expected: 17, Got: $tool_count/$available_tools"
    exit 1
fi