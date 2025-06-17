#!/bin/bash

# Test 1: System Health Check
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Check system health endpoint
response=$(curl -s "$BASE_URL/health")
status=$(echo "$response" | jq -r '.status // "unknown"')
phase=$(echo "$response" | jq -r '.phase // "unknown"')
db_health=$(echo "$response" | jq -r '.services.database // "unknown"')
embeddings_health=$(echo "$response" | jq -r '.services.embeddings // "unknown"')
meta_learning=$(echo "$response" | jq -r '.services.metaLearning // "unknown"')

# Validate results
if [[ "$status" == "healthy" && "$db_health" == "healthy" && "$embeddings_health" == "healthy" && "$meta_learning" == "active" ]]; then
    echo "HEALTH CHECK: ✅ System healthy - $phase"
    exit 0
else
    echo "HEALTH CHECK: ❌ System unhealthy - Status: $status, DB: $db_health, Embeddings: $embeddings_health"
    exit 1
fi