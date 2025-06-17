#!/bin/bash

# Test 3: Database Connectivity
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Test database by creating a project
test_project_name="test-$(date +%s)"
response=$(curl -s -X POST "$BASE_URL/api/projects" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$test_project_name\",\"description\":\"Automated test project\"}")

created_name=$(echo "$response" | jq -r '.project.name // "error"')

# Cleanup: Delete the test project
if [[ "$created_name" == "$test_project_name" ]]; then
    curl -s -X DELETE "$BASE_URL/api/projects/$test_project_name" > /dev/null
fi

# Validate results
if [[ "$created_name" == "$test_project_name" ]]; then
    echo "DATABASE: ✅ Connected and functional"
    exit 0
else
    echo "DATABASE: ❌ Connection failed - Response: $created_name"
    exit 1
fi