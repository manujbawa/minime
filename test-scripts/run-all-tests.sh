#!/bin/bash

# =============================================================================
# MiniMe-MCP Comprehensive Test Suite
# =============================================================================
# This script runs all tests to validate a MiniMe-MCP deployment
# Usage: ./run-all-tests.sh [container-name] [port]
# =============================================================================

set -e

# Configuration
CONTAINER_NAME=${1:-"minime-test"}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Test result tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_script="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log "Running: $test_name"
    
    if bash "$SCRIPT_DIR/$test_script" "$CONTAINER_NAME" "$PORT" 2>/dev/null; then
        success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        error "$test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Main test execution
main() {
    echo "============================================================================="
    echo "🚀 MiniMe-MCP Comprehensive Test Suite"
    echo "============================================================================="
    echo "Container: $CONTAINER_NAME"
    echo "Port: $PORT"
    echo "Base URL: $BASE_URL"
    echo "============================================================================="
    echo
    
    # Wait for container to be ready
    log "Waiting for container to be ready..."
    sleep 10
    
    # Core System Tests
    echo "📋 CORE SYSTEM TESTS"
    echo "----------------------------------------------------------------------------"
    run_test "System Health Check" "test-health.sh"
    run_test "MCP Server Status" "test-mcp-status.sh"
    run_test "Database Connectivity" "test-database.sh"
    run_test "Embedding Models" "test-embeddings.sh"
    echo
    
    # API Endpoint Tests
    echo "🔌 API ENDPOINT TESTS"
    echo "----------------------------------------------------------------------------"
    run_test "Learning Pipeline APIs" "test-learning-api.sh"
    run_test "Project Management APIs" "test-project-api.sh"
    run_test "Memory Storage APIs" "test-memory-api.sh"
    echo
    
    # MCP Tool Tests
    echo "🛠️ MCP TOOL TESTS"
    echo "----------------------------------------------------------------------------"
    run_test "MCP Tools Discovery" "test-mcp-tools.sh"
    run_test "MCP Tools Schema Validation" "test-mcp-schema.sh"
    run_test "Learning Pipeline Triggers" "test-learning-triggers.sh"
    echo
    
    # UI Tests
    echo "🖥️ USER INTERFACE TESTS"
    echo "----------------------------------------------------------------------------"
    run_test "UI Main Page" "test-ui-main.sh"
    run_test "MCP Tools Page" "test-ui-mcp-tools.sh"
    run_test "Meta-Learning Page" "test-ui-meta-learning.sh"
    echo
    
    # Container Health Tests
    echo "🐳 CONTAINER HEALTH TESTS"
    echo "----------------------------------------------------------------------------"
    run_test "Container Status" "test-container-health.sh"
    run_test "Log Analysis" "test-container-logs.sh"
    echo
    
    # Performance Tests
    echo "⚡ PERFORMANCE TESTS"
    echo "----------------------------------------------------------------------------"
    run_test "Response Time Check" "test-performance.sh"
    run_test "Memory Usage Check" "test-resource-usage.sh"
    echo
    
    # Final Summary
    echo "============================================================================="
    echo "📊 TEST SUMMARY"
    echo "============================================================================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%"
    echo "============================================================================="
    
    if [ $FAILED_TESTS -eq 0 ]; then
        success "All tests passed! MiniMe-MCP is ready for use! 🎉"
        exit 0
    else
        error "$FAILED_TESTS test(s) failed. Please check the deployment."
        exit 1
    fi
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    error "jq is required but not installed. Please install jq first."
    echo "  On macOS: brew install jq"
    echo "  On Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Check if container is running
if ! docker ps --filter name="$CONTAINER_NAME" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    error "Container '$CONTAINER_NAME' is not running."
    echo "Please start the container first:"
    echo "  docker run -d --name $CONTAINER_NAME -p $PORT:8000 minime-mcp:test"
    exit 1
fi

# Run main test suite
main "$@"