#!/bin/bash

# Test 9: MCP Tools Schema Validation
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test schema completeness for store_memory tool
response=$(curl -s "$BASE_URL/mcp/status?full=true")
store_memory_params=$(echo "$response" | jq -r '.capabilities.tools.available[] | select(.name == "store_memory") | .inputSchema.properties | keys | length')
get_insights_exists=$(echo "$response" | jq -r '.capabilities.tools.available[] | select(.name == "get_learning_insights") | .name')

# Validate results
if [[ "$store_memory_params" -eq 6 && "$get_insights_exists" == "get_learning_insights" ]]; then
    echo "MCP SCHEMA: ✅ Schemas complete - store_memory has $store_memory_params params, learning tools present"
    exit 0
else
    echo "MCP SCHEMA: ❌ Schema validation failed - Parameters: $store_memory_params, Learning tools: $get_insights_exists"
    exit 1
fi