#!/bin/bash

# Test 5: Learning Pipeline APIs
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test learning status endpoint
response=$(curl -s "$BASE_URL/api/learning/status")
queue_size=$(echo "$response" | jq -r '.queue_size // -1')
total_patterns=$(echo "$response" | jq -r '.total_patterns // -1')
system_health=$(echo "$response" | jq -r '.system_health // "unknown"')

# Validate results
if [[ "$queue_size" -ge 0 && "$total_patterns" -ge 0 ]]; then
    echo "LEARNING API: ✅ Status endpoint working - Queue: $queue_size, Patterns: $total_patterns"
    exit 0
else
    echo "LEARNING API: ❌ Status endpoint failed - Queue: $queue_size, Patterns: $total_patterns"
    exit 1
fi