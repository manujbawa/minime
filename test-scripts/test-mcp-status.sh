#!/bin/bash

# Test 2: MCP Server Status
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Check MCP server status
response=$(curl -s "$BASE_URL/mcp/status")
message=$(echo "$response" | jq -r '.message // "unknown"')
tool_count=$(echo "$response" | jq -r '.capabilities.tools.count // 0')
transport_type=$(echo "$response" | jq -r '.transport.type // "unknown"')

# Validate results
if [[ "$message" == "MCP server ready with Streamable HTTP transport" && "$tool_count" -eq 17 && "$transport_type" == "Streamable HTTP" ]]; then
    echo "MCP STATUS: ✅ Server ready with $tool_count tools"
    exit 0
else
    echo "MCP STATUS: ❌ Server not ready - Message: $message, Tools: $tool_count"
    exit 1
fi