#!/bin/bash

# Test 16: Response Time Check
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test response time for health endpoint
start_time=$(date +%s%N)
response=$(curl -s "$BASE_URL/health")
end_time=$(date +%s%N)

response_time_ms=$(( (end_time - start_time) / 1000000 ))

# Validate response time (should be under 5 seconds for health check)
if [[ "$response_time_ms" -lt 5000 ]] && echo "$response" | jq -e '.status' > /dev/null; then
    echo "PERFORMANCE: ✅ Health endpoint responds in ${response_time_ms}ms"
    exit 0
else
    echo "PERFORMANCE: ❌ Slow response or invalid - ${response_time_ms}ms"
    exit 1
fi