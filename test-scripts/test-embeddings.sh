#!/bin/bash

# Test 4: Embedding Models
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Check embedding models endpoint
response=$(curl -s "$BASE_URL/api/embeddings/models")
model_count=$(echo "$response" | jq -r '.count // 0')
default_model=$(echo "$response" | jq -r '.models[0].model_name // "none"')

# Validate results
if [[ "$model_count" -gt 0 && "$default_model" == "nomic-embed-text" ]]; then
    echo "EMBEDDINGS: ✅ $model_count model(s) available, default: $default_model"
    exit 0
else
    echo "EMBEDDINGS: ❌ Models not available - Count: $model_count, Default: $default_model"
    exit 1
fi