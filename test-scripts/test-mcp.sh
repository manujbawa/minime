#!/bin/bash

# ============================================================================
# MCP Test Suite for MiniMe-MCP
# ============================================================================
# Tests Model Context Protocol server functionality, tools, and compliance
# ============================================================================

set -e

# Configuration
CONTAINER_NAME="minime-mcp"
BASE_URL="http://localhost:8000"
MCP_ENDPOINT="$BASE_URL/mcp"
OUTPUT_DIR="test-scripts/output"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/mcp_test_report_$TIMESTAMP.json"

# MCP Session Management
SESSION_ID=$(uuidgen)
SESSION_INITIALIZED=false
REQUEST_ID=1

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

# Initialize MCP session
initialize_mcp_session() {
    if [[ "$SESSION_INITIALIZED" == "true" ]]; then
        return 0
    fi
    
    log "Initializing MCP session..."
    
    local init_body="{\"jsonrpc\": \"2.0\", \"id\": $REQUEST_ID, \"method\": \"initialize\", \"params\": {\"protocolVersion\": \"2024-11-05\", \"capabilities\": {}, \"clientInfo\": {\"name\": \"mcp-test-suite\", \"version\": \"1.0.0\"}}}"
    REQUEST_ID=$((REQUEST_ID + 1))
    
    # Initialize with a client-generated session ID
    local response=$(curl -s -w "\n%{http_code}" -i -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "Mcp-Session-Id: $SESSION_ID" \
        -d "$init_body" \
        "$MCP_ENDPOINT")
    
    local headers=$(echo "$response" | sed '/^$/,$d')
    local body=$(echo "$response" | sed '1,/^$/d' | sed '$d')
    local status=$(echo "$response" | tail -n 1)
    
    if [[ "$status" == "200" ]]; then
        # Extract server-generated session ID from headers
        local server_session=$(echo "$headers" | grep -i "mcp-session-id:" | cut -d: -f2 | tr -d ' \r\n')
        if [[ -n "$server_session" ]]; then
            SESSION_ID="$server_session"
            log "MCP session initialized: $SESSION_ID"
        else
            log "MCP session initialized (no session ID returned)"
        fi
        SESSION_INITIALIZED=true
        return 0
    else
        echo "Failed to initialize MCP session: HTTP $status"
        echo "Response: $body"
        return 1
    fi
}

# MCP request helper
mcp_request() {
    local method="$1"
    local params="$2"
    local expected_status="${3:-200}"
    
    # Ensure session is initialized
    if [[ "$SESSION_INITIALIZED" != "true" ]]; then
        if ! initialize_mcp_session; then
            echo "Failed to initialize MCP session"
            return 1
        fi
    fi
    
    # Build JSON-RPC request
    local request_body="{\"jsonrpc\": \"2.0\", \"id\": $REQUEST_ID, \"method\": \"$method\""
    if [[ -n "$params" && "$params" != "{}" ]]; then
        request_body="$request_body, \"params\": $params"
    fi
    request_body="$request_body}"
    REQUEST_ID=$((REQUEST_ID + 1))
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "Mcp-Session-Id: $SESSION_ID" \
        -d "$request_body" \
        "$MCP_ENDPOINT")
    
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n 1)
    
    if [[ "$status" != "$expected_status" ]]; then
        echo "HTTP $status: $body"
        return 1
    fi
    
    # Handle SSE format - extract JSON from event stream
    if echo "$body" | grep -q "^event: message"; then
        body=$(echo "$body" | grep "^data: " | sed 's/^data: //')
    fi
    
    # Handle case where response might have extra whitespace or multiple lines
    body=$(echo "$body" | tr -d '\n\r' | head -1)
    
    echo "$body"
    return 0
}

# Test MCP method
test_mcp_method() {
    local test_name="$1"
    local method="$2"
    local params="$3"
    local validation_jq="$4"
    local expected_status="${5:-200}"
    
    log "Testing MCP: $test_name"
    
    if response=$(mcp_request "$method" "$params" "$expected_status" 2>&1); then
        if [[ -n "$validation_jq" ]]; then
            if echo "$response" | jq -e "$validation_jq" >/dev/null 2>&1; then
                success "$test_name"
            else
                failure "$test_name" "Validation failed: $validation_jq"
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
    
    local params="{\"name\": \"$tool_name\", \"arguments\": $arguments}"
    
    if response=$(mcp_request "tools/call" "$params" "200" 2>&1); then
        if [[ -n "$validation_jq" ]]; then
            if echo "$response" | jq -e "$validation_jq" >/dev/null 2>&1; then
                success "$test_name"
            else
                failure "$test_name" "Tool validation failed: $validation_jq"
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
    log "Starting MCP Test Suite for MiniMe-MCP"
    log "MCP Endpoint: $MCP_ENDPOINT"
    log "Container: $CONTAINER_NAME"
    log "Report: $REPORT_FILE"
    echo

    # Wait for MCP server to be ready
    log "Waiting for MCP server to be ready..."
    for i in {1..60}; do
        if curl -s "$MCP_ENDPOINT" >/dev/null 2>&1; then
            success "MCP server is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            failure "MCP server readiness check" "MCP server failed to respond within 60 seconds"
            exit 1
        fi
        sleep 1
    done
    echo

    # ========================================================================
    # SSE ENDPOINT TESTS
    # ========================================================================
    log "=== SSE ENDPOINT TESTS ==="
    
    # Test SSE endpoint for tool discovery
    log "Testing SSE endpoint for tool discovery..."
    SSE_RESPONSE=$(curl -s -N -H "Accept: text/event-stream" -H "Mcp-Session-Id: test-sse-session" -m 5 "$BASE_URL/sse" | head -1)
    
    if echo "$SSE_RESPONSE" | grep -q "data:"; then
        SSE_DATA=$(echo "$SSE_RESPONSE" | sed 's/^data: //')
        if echo "$SSE_DATA" | jq -e '.result.tools | type == "array"' >/dev/null 2>&1; then
            success "SSE tool discovery endpoint"
        else
            failure "SSE tool discovery endpoint" "Invalid tool data format"
        fi
    else
        failure "SSE tool discovery endpoint" "No SSE data received"
    fi
    
    # Test SSE tool execution via POST
    log "Testing SSE tool execution..."
    SSE_TOOL_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Mcp-Session-Id: test-sse-session" \
        -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_memories","arguments":{"query":"test","limit":1}},"id":1}' \
        "$BASE_URL/sse")
    
    if echo "$SSE_TOOL_RESPONSE" | jq -e '.result' >/dev/null 2>&1; then
        success "SSE tool execution endpoint"
    else
        failure "SSE tool execution endpoint" "Tool execution failed"
    fi
    
    echo

    # ========================================================================
    # PROTOCOL COMPLIANCE TESTS
    # ========================================================================
    log "=== PROTOCOL COMPLIANCE TESTS ==="
    
    # Test basic MCP methods (session will be auto-initialized)
    test_mcp_method "List Tools Method" "tools/list" \
        "{}" \
        ".result.tools | type == \"array\""
    
    test_mcp_method "List Resources Method" "resources/list" \
        "{}" \
        ".result.resources | type == \"array\""
    
    test_mcp_method "List Prompts Method" "prompts/list" \
        "{}" \
        ".result.prompts | type == \"array\""
    
    echo

    # ========================================================================
    # TOOL DISCOVERY TESTS
    # ========================================================================
    log "=== TOOL DISCOVERY TESTS ==="
    
    # Get tool list for further testing
    TOOLS_RESPONSE=$(mcp_request "tools/list" "{}" "200" 2>/dev/null || echo "{}")
    TOOL_NAMES=$(echo "$TOOLS_RESPONSE" | jq -r '.result.tools[]?.name // empty' 2>/dev/null || echo "")
    
    if [[ -n "$TOOL_NAMES" ]]; then
        success "Tools discovered: $(echo "$TOOL_NAMES" | wc -l) tools"
        
        # Test each tool has required properties
        for tool_name in $TOOL_NAMES; do
            TOOL_INFO=$(echo "$TOOLS_RESPONSE" | jq ".result.tools[] | select(.name == \"$tool_name\")")
            
            if echo "$TOOL_INFO" | jq -e '.description' >/dev/null 2>&1; then
                success "Tool '$tool_name' has description"
            else
                failure "Tool '$tool_name' missing description" "Required property missing"
            fi
            
            if echo "$TOOL_INFO" | jq -e '.inputSchema' >/dev/null 2>&1; then
                success "Tool '$tool_name' has input schema"
            else
                failure "Tool '$tool_name' missing input schema" "Required property missing"
            fi
        done
    else
        failure "Tool discovery" "No tools found"
    fi
    
    echo

    # ========================================================================
    # CORE TOOL TESTS
    # ========================================================================
    log "=== CORE TOOL TESTS ==="
    
    # Test store_memory tool
    test_mcp_tool "Store Memory Tool" "store_memory" \
        "{\"project_name\": \"web-app-frontend\", \"content\": \"Test memory from MCP test suite - testing React component patterns\", \"memory_type\": \"implementation_notes\", \"importance_score\": 0.8}" \
        ".result and .result.memory_id"
    
    # Test search_memories tool
    test_mcp_tool "Search Memories Tool" "search_memories" \
        "{\"query\": \"React component\", \"limit\": 5}" \
        ".result.memories | type == \"array\""
    
    # Test start_thinking tool
    test_mcp_tool "Start Thinking Tool" "start_thinking_sequence" \
        "{\"project_name\": \"web-app-frontend\", \"sequence_name\": \"Test Analysis\", \"goal\": \"Analyze authentication patterns in the codebase\"}" \
        ".result.sequence_id"
    
    # Store the sequence ID for further testing
    THINKING_RESPONSE=$(mcp_request "tools/call" "{\"name\": \"start_thinking_sequence\", \"arguments\": {\"project_name\": \"web-app-frontend\", \"sequence_name\": \"Test Sequence\", \"goal\": \"Test thinking sequence\"}}" "200" 2>/dev/null || echo "{}")
    SEQUENCE_ID=$(echo "$THINKING_RESPONSE" | jq -r '.result.sequence_id // empty' 2>/dev/null)
    
    # Test add_thought tool if we have a sequence ID
    if [[ -n "$SEQUENCE_ID" ]]; then
        # Test add_thought tool
        test_mcp_tool "Add Thought Tool" "add_thought" \
            "{\"sequence_id\": $SEQUENCE_ID, \"content\": \"This is a test thought for MCP validation\", \"thought_type\": \"analysis\"}" \
            ".result and .result.thought_id"
        
        # Test get_thinking_sequence tool
        test_mcp_tool "Get Thinking Sequence Tool" "get_thinking_sequence" \
            "{\"sequence_id\": $SEQUENCE_ID}" \
            ".result.sequence and .result.thoughts"
    fi
    
    echo

    # ========================================================================
    # ADVANCED TOOL TESTS
    # ========================================================================
    log "=== ADVANCED TOOL TESTS ==="
    
    # Test get_insights tool
    test_mcp_tool "Get Insights Tool" "get_insights" \
        "{\"limit\": 5}" \
        ".result.insights | type == \"array\""
    
    # Test get_coding_patterns tool
    test_mcp_tool "Get Coding Patterns Tool" "get_coding_patterns" \
        "{\"limit\": 5}" \
        ".result.patterns | type == \"array\""
    
    # Test list_thinking_sequences tool
    test_mcp_tool "List Thinking Sequences Tool" "list_thinking_sequences" \
        "{\"project_name\": \"web-app-frontend\", \"limit\": 5}" \
        ".result.sequences | type == \"array\""
    
    echo

    # ========================================================================
    # RESOURCE TESTS
    # ========================================================================
    log "=== RESOURCE TESTS ==="
    
    # Get resource list
    RESOURCES_RESPONSE=$(mcp_request "resources/list" "{}" "200" 2>/dev/null || echo "{}")
    RESOURCE_URIS=$(echo "$RESOURCES_RESPONSE" | jq -r '.result.resources[]?.uri // empty' 2>/dev/null || echo "")
    
    if [[ -n "$RESOURCE_URIS" ]]; then
        success "Resources discovered: $(echo "$RESOURCE_URIS" | wc -l) resources"
        
        # Test reading a resource
        FIRST_RESOURCE=$(echo "$RESOURCE_URIS" | head -1)
        if [[ -n "$FIRST_RESOURCE" ]]; then
            test_mcp_method "Read Resource" "resources/read" \
                "{\"uri\": \"$FIRST_RESOURCE\"}" \
                ".result.contents"
        fi
    else
        warning "No resources found"
    fi
    
    echo

    # ========================================================================
    # PROMPT TESTS
    # ========================================================================
    log "=== PROMPT TESTS ==="
    
    # Get prompt list
    PROMPTS_RESPONSE=$(mcp_request "prompts/list" "{}" "200" 2>/dev/null || echo "{}")
    PROMPT_NAMES=$(echo "$PROMPTS_RESPONSE" | jq -r '.result.prompts[]?.name // empty' 2>/dev/null || echo "")
    
    if [[ -n "$PROMPT_NAMES" ]]; then
        success "Prompts discovered: $(echo "$PROMPT_NAMES" | wc -l) prompts"
        
        # Test getting a prompt
        FIRST_PROMPT=$(echo "$PROMPT_NAMES" | head -1)
        if [[ -n "$FIRST_PROMPT" ]]; then
            test_mcp_method "Get Prompt" "prompts/get" \
                "{\"name\": \"$FIRST_PROMPT\", \"arguments\": {}}" \
                ".result.messages"
        fi
    else
        warning "No prompts found"
    fi
    
    echo

    # ========================================================================
    # ERROR HANDLING TESTS
    # ========================================================================
    log "=== ERROR HANDLING TESTS ==="
    
    # Test invalid method
    test_mcp_method "Invalid Method Error" "invalid/method" \
        "{}" \
        ".error" \
        "400"
    
    # Test invalid tool
    test_mcp_tool "Invalid Tool Error" "nonexistent_tool" \
        "{}" \
        ".error"
    
    # Test invalid parameters
    test_mcp_tool "Invalid Parameters Error" "store_memory" \
        "{\"invalid\": \"parameters\"}" \
        ".error"
    
    echo

    # ========================================================================
    # PERFORMANCE TESTS
    # ========================================================================
    log "=== PERFORMANCE TESTS ==="
    
    # Test response times
    start_time=$(date +%s%3N)
    mcp_request "tools/list" "{}" "200" >/dev/null
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ $response_time -lt 1000 ]; then
        success "Tools list response time: ${response_time}ms"
    else
        failure "Tools list response time" "Too slow: ${response_time}ms"
    fi
    
    # Test concurrent requests
    log "Testing concurrent MCP requests..."
    for i in {1..3}; do
        mcp_request "tools/list" "{}" "200" >/dev/null &
    done
    wait
    success "Concurrent MCP requests handled"
    
    echo

    # ========================================================================
    # PROTOCOL VERSION TESTS
    # ========================================================================
    log "=== PROTOCOL VERSION TESTS ==="
    
    # Test protocol version compatibility
    test_mcp_method "Protocol Version 2024-11-05" "initialize" \
        "{\"protocolVersion\": \"2024-11-05\", \"capabilities\": {}}" \
        ".result.protocolVersion == \"2024-11-05\""
    
    # Test capabilities
    INIT_RESPONSE=$(mcp_request "initialize" "{\"protocolVersion\": \"2024-11-05\", \"capabilities\": {}}" "200" 2>/dev/null || echo "{}")
    
    if echo "$INIT_RESPONSE" | jq -e '.result.capabilities.tools' >/dev/null 2>&1; then
        success "Server supports tools capability"
    else
        warning "Server tools capability not clearly indicated"
    fi
    
    if echo "$INIT_RESPONSE" | jq -e '.result.capabilities.resources' >/dev/null 2>&1; then
        success "Server supports resources capability"
    else
        warning "Server resources capability not clearly indicated"
    fi
    
    echo

    # ========================================================================
    # INTEGRATION TESTS
    # ========================================================================
    log "=== INTEGRATION TESTS ==="
    
    # Test workflow: Create session -> Store memory -> Search memory
    SESSION_RESPONSE=$(mcp_request "tools/call" "{\"name\": \"create_session\", \"arguments\": {\"project_id\": 2, \"session_name\": \"Integration Test Session\"}}" "200" 2>/dev/null || echo "{}")
    SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.result.session_id // empty' 2>/dev/null)
    
    if [[ -n "$SESSION_ID" ]]; then
        # Store memory in the session
        MEMORY_RESPONSE=$(mcp_request "tools/call" "{\"name\": \"store_memory\", \"arguments\": {\"project_id\": 2, \"session_id\": $SESSION_ID, \"content\": \"Integration test memory - testing session workflow\", \"memory_type\": \"implementation_notes\"}}" "200" 2>/dev/null || echo "{}")
        
        if echo "$MEMORY_RESPONSE" | jq -e '.result.success' >/dev/null 2>&1; then
            # Search for the memory
            SEARCH_RESPONSE=$(mcp_request "tools/call" "{\"name\": \"search_memories\", \"arguments\": {\"project_id\": 2, \"query\": \"Integration test\"}}" "200" 2>/dev/null || echo "{}")
            
            if echo "$SEARCH_RESPONSE" | jq -e '.result.memories | length > 0' >/dev/null 2>&1; then
                success "Integration workflow: Session -> Memory -> Search"
            else
                failure "Integration workflow" "Memory not found in search"
            fi
        else
            failure "Integration workflow" "Failed to store memory"
        fi
    else
        failure "Integration workflow" "Failed to create session"
    fi
    
    echo

    # ========================================================================
    # GENERATE REPORT
    # ========================================================================
    log "=== GENERATING REPORT ==="
    
    # Collect MCP server information
    SERVER_INFO=$(mcp_request "initialize" "{\"protocolVersion\": \"2024-11-05\", \"capabilities\": {}}" "200" 2>/dev/null || echo "{}")
    TOOLS_COUNT=$(echo "$TOOLS_RESPONSE" | jq '.result.tools | length' 2>/dev/null || echo "0")
    RESOURCES_COUNT=$(echo "$RESOURCES_RESPONSE" | jq '.result.resources | length' 2>/dev/null || echo "0")
    PROMPTS_COUNT=$(echo "$PROMPTS_RESPONSE" | jq '.result.prompts | length' 2>/dev/null || echo "0")
    
    # Create JSON report
    cat > "$REPORT_FILE" << EOF
{
  "test_suite": "MCP Tests",
  "timestamp": "$(date -Iseconds)",
  "mcp_endpoint": "$MCP_ENDPOINT",
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
  "mcp_info": {
    "server_info": $SERVER_INFO,
    "tools_count": $TOOLS_COUNT,
    "resources_count": $RESOURCES_COUNT,
    "prompts_count": $PROMPTS_COUNT,
    "tool_names": [$(echo "$TOOL_NAMES" | sed 's/^/"/;s/$/"/;' | paste -sd, -)]
  }
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
    echo -e "Tools Available: $TOOLS_COUNT"
    echo -e "Resources Available: $RESOURCES_COUNT"
    echo -e "Prompts Available: $PROMPTS_COUNT"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All MCP tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Check the report for details.${NC}"
        exit 1
    fi
}

# Run the test suite
main "$@" 