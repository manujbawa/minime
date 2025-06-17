#!/bin/bash

# Test 10: Learning Pipeline Triggers
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test learning analysis trigger
response=$(curl -s -X POST "$BASE_URL/api/learning/analyze" -H "Content-Type: application/json" -d '{}')
status=$(echo "$response" | jq -r '.status // "error"')

# Validate results
if [[ "$status" == "queued" ]]; then
    echo "LEARNING TRIGGERS: ✅ Analysis trigger working - Status: $status"
    exit 0
else
    echo "LEARNING TRIGGERS: ❌ Analysis trigger failed - Status: $status"
    exit 1
fi