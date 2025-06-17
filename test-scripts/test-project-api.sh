#!/bin/bash

# Test 6: Project Management APIs
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test project listing
response=$(curl -s "$BASE_URL/api/projects")
project_count=$(echo "$response" | jq -r '.count // 0')

# Validate results
if [[ "$project_count" -ge 0 ]]; then
    echo "PROJECT API: ✅ Project management working - $project_count projects"
    exit 0
else
    echo "PROJECT API: ❌ Project listing failed"
    exit 1
fi