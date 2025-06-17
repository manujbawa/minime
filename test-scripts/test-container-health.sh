#!/bin/bash

# Test 14: Container Status
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}

# Check container status
container_status=$(docker ps --filter name="$CONTAINER_NAME" --format "{{.Status}}")
health_status=$(docker inspect "$CONTAINER_NAME" --format "{{.State.Health.Status}}" 2>/dev/null || echo "none")

# Validate results
if echo "$container_status" | grep -q "Up" && [[ "$health_status" == "healthy" || "$health_status" == "none" ]]; then
    echo "CONTAINER HEALTH: ✅ Container running - Status: $container_status"
    exit 0
else
    echo "CONTAINER HEALTH: ❌ Container issues - Status: $container_status, Health: $health_status"
    exit 1
fi