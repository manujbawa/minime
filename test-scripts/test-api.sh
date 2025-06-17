#!/bin/bash

# ============================================================================
# API Test Suite for MiniMe-MCP
# ============================================================================
# Tests REST API endpoints, MCP tools, and HTTP functionality
# ============================================================================

set -e

# Configuration
CONTAINER_NAME="minime-mcp"
BASE_URL="http://localhost:8000"
OUTPUT_DIR="test-scripts/output"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/api_test_report_$TIMESTAMP.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TEST_RESULTS+=("{\"test\": \"$1\", \"status\": \"PASS\", \"timestamp\": \"$(date -Iseconds)\"}")
}

failure() {
    echo -e "${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TEST_RESULTS+=("{\"test\": \"$1\", \"status\": \"FAIL\", \"timestamp\": \"$(date -Iseconds)\", \"error\": \"$2\"}")
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# HTTP request helper
http_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    
    if [[ -n "$data" ]]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    fi
    
    # Split response and status code
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n 1)
    
    # Check status code if expected
    if [[ -n "$expected_status" ]] && [[ "$status" != "$expected_status" ]]; then
        echo "HTTP $status: $body"
        return 1
    fi
    
    echo "$body"
    return 0
}

# Test API endpoint
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local validation_jq="$6"
    
    log "Testing: $test_name"
    
    if response=$(http_request "$method" "$endpoint" "$data" "$expected_status" 2>&1); then
        # Validate response if jq filter provided
        if [[ -n "$validation_jq" ]]; then
            if echo "$response" | jq -e "$validation_jq" >/dev/null 2>&1; then
                success "$test_name"
            else
                failure "$test_name" "Response validation failed: $validation_jq"
            fi
        else
            success "$test_name"
        fi
    else
        failure "$test_name" "$response"
    fi
}

# Test MCP tool
test_mcp_tool() {
    local test_name="$1"
    local tool_name="$2"
    local arguments="$3"
    local validation_jq="$4"
    
    log "Testing MCP Tool: $test_name"
    
    local mcp_request="{
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"$tool_name\",
            \"arguments\": $arguments
        }
    }"
    
    if response=$(http_request "POST" "/mcp" "$mcp_request" "200" 2>&1); then
        if [[ -n "$validation_jq" ]]; then
            if echo "$response" | jq -e "$validation_jq" >/dev/null 2>&1; then
                success "$test_name"
            else
                failure "$test_name" "MCP response validation failed: $validation_jq"
            fi
        else
            success "$test_name"
        fi
    else
        failure "$test_name" "$response"
    fi
}

# ============================================================================
# TEST SUITE
# ============================================================================

main() {
    log "Starting API Test Suite for MiniMe-MCP"
    log "Base URL: $BASE_URL"
    log "Container: $CONTAINER_NAME"
    log "Report: $REPORT_FILE"
    echo

    # Wait for API to be ready
    log "Waiting for API to be ready..."
    for i in {1..60}; do
        if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
            success "API is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            failure "API readiness check" "API failed to respond within 60 seconds"
            exit 1
        fi
        sleep 1
    done
    echo

    # ========================================================================
    # HEALTH & STATUS TESTS
    # ========================================================================
    log "=== HEALTH & STATUS TESTS ==="
    
    test_endpoint "Health Check" "GET" "/health" "" "200" ".status == \"healthy\""
    test_endpoint "Status Endpoint" "GET" "/status" "" "200" ".database.connected == true"
    test_endpoint "Version Info" "GET" "/version" "" "200" ".version"
    
    echo

    # ========================================================================
    # PROJECT API TESTS
    # ========================================================================
    log "=== PROJECT API TESTS ==="
    
    test_endpoint "List Projects" "GET" "/api/projects" "" "200" "type == \"array\""
    test_endpoint "Get Project Details" "GET" "/api/projects/2" "" "200" ".name == \"web-app-frontend\""
    test_endpoint "Project Statistics" "GET" "/api/projects/2/stats" "" "200" ".memory_count"
    
    # Test project creation
    NEW_PROJECT="{\"name\": \"test-project-$(date +%s)\", \"description\": \"Test project for API testing\"}"
    test_endpoint "Create Project" "POST" "/api/projects" "$NEW_PROJECT" "201" ".id"
    
    echo

    # ========================================================================
    # SESSION API TESTS
    # ========================================================================
    log "=== SESSION API TESTS ==="
    
    test_endpoint "List Sessions" "GET" "/api/sessions" "" "200" "type == \"array\""
    test_endpoint "Get Project Sessions" "GET" "/api/projects/2/sessions" "" "200" "type == \"array\""
    test_endpoint "Get Session Details" "GET" "/api/sessions/11" "" "200" ".session_name"
    
    echo

    # ========================================================================
    # MEMORY API TESTS
    # ========================================================================
    log "=== MEMORY API TESTS ==="
    
    test_endpoint "List Memories" "GET" "/api/memories" "" "200" "type == \"array\""
    test_endpoint "Get Project Memories" "GET" "/api/projects/2/memories" "" "200" "type == \"array\""
    test_endpoint "Get Session Memories" "GET" "/api/sessions/11/memories" "" "200" "type == \"array\""
    test_endpoint "Get Memory Details" "GET" "/api/memories/13" "" "200" ".content"
    test_endpoint "Search Memories" "GET" "/api/memories/search?q=JWT" "" "200" "type == \"array\""
    
    echo

    # ========================================================================
    # THINKING API TESTS
    # ========================================================================
    log "=== THINKING API TESTS ==="
    
    test_endpoint "List Thinking Sequences" "GET" "/api/thinking" "" "200" "type == \"array\""
    test_endpoint "Get Thinking Sequence" "GET" "/api/thinking/6" "" "200" ".sequence_name"
    test_endpoint "Get Sequence Thoughts" "GET" "/api/thinking/6/thoughts" "" "200" "type == \"array\""
    
    echo

    # ========================================================================
    # ANALYTICS API TESTS
    # ========================================================================
    log "=== ANALYTICS API TESTS ==="
    
    test_endpoint "Analytics Overview" "GET" "/api/analytics" "" "200" ".total_projects"
    test_endpoint "Project Analytics" "GET" "/api/analytics/projects/2" "" "200" ".project_name"
    test_endpoint "Memory Trends" "GET" "/api/analytics/trends" "" "200" "type == \"array\""
    
    echo

    # ========================================================================
    # MCP TOOLS TESTS
    # ========================================================================
    log "=== MCP TOOLS TESTS ==="
    
    # Test tool discovery
    test_endpoint "MCP Tool List" "POST" "/mcp" "{\"method\": \"tools/list\"}" "200" ".result.tools | length > 0"
    
    # Test individual tools
    test_mcp_tool "Store Memory Tool" "store_memory" \
        "{\"project_id\": 2, \"content\": \"Test memory from API test - testing authentication patterns\", \"memory_type\": \"implementation_notes\"}" \
        ".result.success == true"
    
    test_mcp_tool "Search Memories Tool" "search_memories" \
        "{\"project_id\": 2, \"query\": \"JWT\", \"limit\": 5}" \
        ".result.memories | length > 0"
    
    test_mcp_tool "Get Project Stats Tool" "get_project_stats" \
        "{\"project_id\": 2}" \
        ".result.project_name == \"web-app-frontend\""
    
    test_mcp_tool "List Projects Tool" "list_projects" \
        "{}" \
        ".result.projects | length >= 3"
    
    test_mcp_tool "Start Thinking Tool" "start_thinking" \
        "{\"project_id\": 2, \"goal\": \"Test thinking sequence from API\"}" \
        ".result.sequence_id"
    
    echo

    # ========================================================================
    # ERROR HANDLING TESTS
    # ========================================================================
    log "=== ERROR HANDLING TESTS ==="
    
    test_endpoint "404 for Non-existent Project" "GET" "/api/projects/99999" "" "404" ""
    test_endpoint "404 for Non-existent Memory" "GET" "/api/memories/99999" "" "404" ""
    test_endpoint "400 for Invalid JSON" "POST" "/api/projects" "invalid json" "400" ""
    test_endpoint "405 for Wrong Method" "DELETE" "/health" "" "405" ""
    
    echo

    # ========================================================================
    # PERFORMANCE TESTS
    # ========================================================================
    log "=== PERFORMANCE TESTS ==="
    
    # Test response times
    log "Testing response times..."
    
    start_time=$(date +%s%3N)
    http_request "GET" "/api/projects" "" "200" >/dev/null
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ $response_time -lt 1000 ]; then
        success "Projects API response time: ${response_time}ms"
    else
        failure "Projects API response time" "Too slow: ${response_time}ms"
    fi
    
    # Test concurrent requests
    log "Testing concurrent requests..."
    for i in {1..5}; do
        http_request "GET" "/health" "" "200" >/dev/null &
    done
    wait
    success "Concurrent requests handled"
    
    echo

    # ========================================================================
    # STATIC FILE TESTS
    # ========================================================================
    log "=== STATIC FILE TESTS ==="
    
    test_endpoint "UI Index Page" "GET" "/" "" "200" ""
    test_endpoint "Static CSS" "GET" "/assets/index.css" "" "200" ""
    test_endpoint "Static JS" "GET" "/assets/index.js" "" "200" ""
    
    echo

    # ========================================================================
    # GENERATE REPORT
    # ========================================================================
    log "=== GENERATING REPORT ==="
    
    # Get API statistics
    API_STATS=$(http_request "GET" "/status" "" "200" 2>/dev/null || echo "{}")
    
    # Create JSON report
    cat > "$REPORT_FILE" << EOF
{
  "test_suite": "API Tests",
  "timestamp": "$(date -Iseconds)",
  "base_url": "$BASE_URL",
  "container": "$CONTAINER_NAME",
  "summary": {
    "total_tests": $((TESTS_PASSED + TESTS_FAILED)),
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "success_rate": "$(echo "scale=2; $TESTS_PASSED * 100 / ($TESTS_PASSED + $TESTS_FAILED)" | bc)%"
  },
  "results": [
    $(IFS=','; echo "${TEST_RESULTS[*]}")
  ],
  "api_status": $API_STATS
}
EOF

    success "Report generated: $REPORT_FILE"
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    echo
    log "=== TEST SUMMARY ==="
    echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All API tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Check the report for details.${NC}"
        exit 1
    fi
}

# Run the test suite
main "$@" 