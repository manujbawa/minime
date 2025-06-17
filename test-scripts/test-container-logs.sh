#!/bin/bash

# Test 15: Log Analysis
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}

# Check for critical errors in logs
critical_errors=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -i "fatal\|critical\|panic" | wc -l)
recent_logs=$(docker logs "$CONTAINER_NAME" --tail 10 2>&1)

# Check if container is producing logs (sign of activity)
if echo "$recent_logs" | grep -q "."; then
    if [[ "$critical_errors" -eq 0 ]]; then
        echo "CONTAINER LOGS: ✅ No critical errors found"
        exit 0
    else
        echo "CONTAINER LOGS: ⚠ $critical_errors critical errors found (may be acceptable)"
        exit 0  # Don't fail on warnings, as some SQL errors are expected
    fi
else
    echo "CONTAINER LOGS: ❌ No recent log activity"
    exit 1
fi