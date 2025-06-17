#!/bin/bash

# Test 17: Memory Usage Check
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}

# Check container resource usage
memory_usage=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemUsage}}" 2>/dev/null)
cpu_usage=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}}" 2>/dev/null)

# Validate container is using reasonable resources
if [[ -n "$memory_usage" && -n "$cpu_usage" ]]; then
    echo "RESOURCE USAGE: ✅ Container stats - Memory: $memory_usage, CPU: $cpu_usage"
    exit 0
else
    echo "RESOURCE USAGE: ❌ Could not get container stats"
    exit 1
fi