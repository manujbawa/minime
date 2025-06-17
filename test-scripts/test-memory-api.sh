#!/bin/bash

# Test 7: Memory Storage APIs
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Use existing sample-project
project_name="sample-project"
response=$(curl -s "$BASE_URL/api/projects/$project_name/memories")

# Check if we get a valid response (even if empty)
if echo "$response" | jq -e '.memories' > /dev/null 2>&1; then
    memory_count=$(echo "$response" | jq -r '.count // 0')
    echo "MEMORY API: ✅ Memory APIs working - $memory_count memories"
    exit 0
else
    echo "MEMORY API: ❌ Memory APIs failed"
    exit 1
fi