#!/bin/bash

# ============================================================================
# UI Test Suite for MiniMe-MCP
# ============================================================================
# Tests React frontend functionality, UI components, and user interactions
# ============================================================================

set -e

# Configuration
CONTAINER_NAME="minime-mcp"
BASE_URL="http://localhost:8000"
OUTPUT_DIR="test-scripts/output"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/ui_test_report_$TIMESTAMP.json"

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
    local expected_status="$3"
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n 1)
    
    if [[ -n "$expected_status" ]] && [[ "$status" != "$expected_status" ]]; then
        echo "HTTP $status: $body"
        return 1
    fi
    
    echo "$body"
    return 0
}

# Test UI page
test_ui_page() {
    local test_name="$1"
    local endpoint="$2"
    local content_check="$3"
    local expected_status="${4:-200}"
    
    log "Testing UI: $test_name"
    
    if response=$(http_request "GET" "$endpoint" "$expected_status" 2>&1); then
        if [[ -n "$content_check" ]]; then
            if echo "$response" | grep -q "$content_check"; then
                success "$test_name"
            else
                failure "$test_name" "Content check failed: '$content_check' not found"
            fi
        else
            success "$test_name"
        fi
    else
        failure "$test_name" "$response"
    fi
}

# Test static asset
test_static_asset() {
    local test_name="$1"
    local asset_path="$2"
    local content_type="$3"
    
    log "Testing Asset: $test_name"
    
    response=$(curl -s -I "$BASE_URL$asset_path")
    status=$(echo "$response" | head -n 1 | grep -o '[0-9]\{3\}')
    
    if [[ "$status" == "200" ]]; then
        if [[ -n "$content_type" ]]; then
            if echo "$response" | grep -q "Content-Type.*$content_type"; then
                success "$test_name"
            else
                failure "$test_name" "Wrong content type, expected: $content_type"
            fi
        else
            success "$test_name"
        fi
    else
        failure "$test_name" "HTTP $status"
    fi
}

# Test JavaScript functionality
test_js_functionality() {
    local test_name="$1"
    local js_check="$2"
    
    log "Testing JS: $test_name"
    
    # Use headless browser simulation with curl to check for JS content
    response=$(http_request "GET" "/" "200" 2>&1)
    
    if echo "$response" | grep -q "$js_check"; then
        success "$test_name"
    else
        failure "$test_name" "JavaScript check failed: '$js_check' not found"
    fi
}

# ============================================================================
# TEST SUITE
# ============================================================================

main() {
    log "Starting UI Test Suite for MiniMe-MCP"
    log "Base URL: $BASE_URL"
    log "Container: $CONTAINER_NAME"
    log "Report: $REPORT_FILE"
    echo

    # Wait for UI to be ready
    log "Waiting for UI to be ready..."
    for i in {1..60}; do
        if curl -s "$BASE_URL/" >/dev/null 2>&1; then
            success "UI is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            failure "UI readiness check" "UI failed to respond within 60 seconds"
            exit 1
        fi
        sleep 1
    done
    echo

    # ========================================================================
    # BASIC PAGE TESTS
    # ========================================================================
    log "=== BASIC PAGE TESTS ==="
    
    test_ui_page "Main Index Page" "/" "<!DOCTYPE html>"
    test_ui_page "HTML Structure" "/" "<div id=\"root\">"
    test_ui_page "React App Mount Point" "/" "id=\"root\""
    test_ui_page "Page Title" "/" "<title>MiniMe-MCP</title>"
    test_ui_page "Meta Viewport" "/" "viewport"
    
    echo

    # ========================================================================
    # STATIC ASSET TESTS
    # ========================================================================
    log "=== STATIC ASSET TESTS ==="
    
    # Test main assets
    test_static_asset "Main CSS Bundle" "/assets/index.css" "text/css"
    test_static_asset "Main JS Bundle" "/assets/index.js" "javascript"
    
    # Test asset loading
    response=$(http_request "GET" "/" "200")
    
    # Extract asset paths from HTML
    css_assets=$(echo "$response" | grep -o '/assets/[^"]*\.css' | head -5)
    js_assets=$(echo "$response" | grep -o '/assets/[^"]*\.js' | head -5)
    
    # Test CSS assets
    if [[ -n "$css_assets" ]]; then
        for asset in $css_assets; do
            test_static_asset "CSS Asset: $(basename $asset)" "$asset" "text/css"
        done
    else
        warning "No CSS assets found in HTML"
    fi
    
    # Test JS assets
    if [[ -n "$js_assets" ]]; then
        for asset in $js_assets; do
            test_static_asset "JS Asset: $(basename $asset)" "$asset" "javascript"
        done
    else
        warning "No JS assets found in HTML"
    fi
    
    echo

    # ========================================================================
    # REACT APPLICATION TESTS
    # ========================================================================
    log "=== REACT APPLICATION TESTS ==="
    
    # Test React-specific content
    test_ui_page "React Root Element" "/" "id=\"root\""
    test_ui_page "React Scripts" "/" "react"
    
    # Test for common React patterns in the built assets
    main_js=$(echo "$response" | grep -o '/assets/index-[^"]*\.js' | head -1)
    if [[ -n "$main_js" ]]; then
        js_content=$(http_request "GET" "$main_js" "200")
        
        if echo "$js_content" | grep -q "React"; then
            success "React library loaded"
        else
            warning "React library not detected in main bundle"
        fi
        
        if echo "$js_content" | grep -q "useState\|useEffect"; then
            success "React hooks detected"
        else
            warning "React hooks not detected in bundle"
        fi
    fi
    
    echo

    # ========================================================================
    # UI COMPONENT TESTS
    # ========================================================================
    log "=== UI COMPONENT TESTS ==="
    
    # Test for Material-UI components (if used)
    if [[ -n "$main_js" ]]; then
        if echo "$js_content" | grep -q "mui\|material"; then
            success "Material-UI components detected"
        else
            warning "Material-UI not detected"
        fi
    fi
    
    # Test for routing
    if echo "$js_content" | grep -q "router\|Router"; then
        success "React Router detected"
    else
        warning "React Router not detected"
    fi
    
    # Test for state management
    if echo "$js_content" | grep -q "redux\|zustand\|context"; then
        success "State management detected"
    else
        warning "State management library not clearly detected"
    fi
    
    echo

    # ========================================================================
    # API INTEGRATION TESTS
    # ========================================================================
    log "=== API INTEGRATION TESTS ==="
    
    # Test for API calls in the JavaScript
    if [[ -n "$js_content" ]]; then
        if echo "$js_content" | grep -q "fetch\|axios\|api"; then
            success "API integration detected"
        else
            warning "API integration not clearly detected"
        fi
        
        if echo "$js_content" | grep -q "/api/"; then
            success "API endpoints referenced"
        else
            warning "API endpoints not found in JS"
        fi
    fi
    
    echo

    # ========================================================================
    # RESPONSIVE DESIGN TESTS
    # ========================================================================
    log "=== RESPONSIVE DESIGN TESTS ==="
    
    # Test viewport meta tag
    if echo "$response" | grep -q "viewport.*width=device-width"; then
        success "Responsive viewport meta tag"
    else
        failure "Responsive viewport meta tag" "Missing or incorrect viewport meta tag"
    fi
    
    # Test for responsive CSS
    main_css=$(echo "$response" | grep -o '/assets/index-[^"]*\.css' | head -1)
    if [[ -n "$main_css" ]]; then
        css_content=$(http_request "GET" "$main_css" "200")
        
        if echo "$css_content" | grep -q "@media"; then
            success "Media queries detected"
        else
            warning "No media queries found in CSS"
        fi
        
        if echo "$css_content" | grep -q "flex\|grid"; then
            success "Modern CSS layout detected"
        else
            warning "Modern CSS layout not clearly detected"
        fi
    fi
    
    echo

    # ========================================================================
    # PERFORMANCE TESTS
    # ========================================================================
    log "=== PERFORMANCE TESTS ==="
    
    # Test page load time
    start_time=$(date +%s%3N)
    http_request "GET" "/" "200" >/dev/null
    end_time=$(date +%s%3N)
    load_time=$((end_time - start_time))
    
    if [ $load_time -lt 2000 ]; then
        success "Page load time: ${load_time}ms"
    else
        failure "Page load time" "Too slow: ${load_time}ms"
    fi
    
    # Test asset sizes
    if [[ -n "$main_js" ]]; then
        js_size=$(curl -s -I "$BASE_URL$main_js" | grep -i content-length | cut -d' ' -f2 | tr -d '\r')
        if [[ -n "$js_size" ]] && [[ $js_size -lt 1048576 ]]; then  # 1MB
            success "JS bundle size acceptable: $(echo "scale=2; $js_size/1024" | bc)KB"
        else
            warning "JS bundle size large: $(echo "scale=2; $js_size/1024" | bc)KB"
        fi
    fi
    
    if [[ -n "$main_css" ]]; then
        css_size=$(curl -s -I "$BASE_URL$main_css" | grep -i content-length | cut -d' ' -f2 | tr -d '\r')
        if [[ -n "$css_size" ]] && [[ $css_size -lt 524288 ]]; then  # 512KB
            success "CSS bundle size acceptable: $(echo "scale=2; $css_size/1024" | bc)KB"
        else
            warning "CSS bundle size large: $(echo "scale=2; $css_size/1024" | bc)KB"
        fi
    fi
    
    echo

    # ========================================================================
    # ACCESSIBILITY TESTS
    # ========================================================================
    log "=== ACCESSIBILITY TESTS ==="
    
    # Test for basic accessibility features
    if echo "$response" | grep -q "lang="; then
        success "Language attribute present"
    else
        failure "Language attribute" "Missing lang attribute on html element"
    fi
    
    # Test for semantic HTML in the built content
    if [[ -n "$js_content" ]]; then
        if echo "$js_content" | grep -q "aria-\|role="; then
            success "ARIA attributes detected"
        else
            warning "ARIA attributes not clearly detected"
        fi
    fi
    
    echo

    # ========================================================================
    # SECURITY TESTS
    # ========================================================================
    log "=== SECURITY TESTS ==="
    
    # Test security headers
    headers=$(curl -s -I "$BASE_URL/")
    
    if echo "$headers" | grep -q "X-Content-Type-Options"; then
        success "X-Content-Type-Options header present"
    else
        warning "X-Content-Type-Options header missing"
    fi
    
    if echo "$headers" | grep -q "X-Frame-Options\|Content-Security-Policy"; then
        success "Frame protection headers present"
    else
        warning "Frame protection headers missing"
    fi
    
    # Test for inline scripts (security risk)
    if echo "$response" | grep -q "<script[^>]*>[^<]"; then
        warning "Inline scripts detected (potential security risk)"
    else
        success "No inline scripts detected"
    fi
    
    echo

    # ========================================================================
    # GENERATE REPORT
    # ========================================================================
    log "=== GENERATING REPORT ==="
    
    # Collect asset information
    ASSET_INFO="{
        \"main_js\": \"$main_js\",
        \"main_css\": \"$main_css\",
        \"js_size_bytes\": ${js_size:-0},
        \"css_size_bytes\": ${css_size:-0},
        \"page_load_time_ms\": $load_time
    }"
    
    # Create JSON report
    cat > "$REPORT_FILE" << EOF
{
  "test_suite": "UI Tests",
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
  "asset_info": $ASSET_INFO
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
        echo -e "\n${GREEN}🎉 All UI tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Check the report for details.${NC}"
        exit 1
    fi
}

# Run the test suite
main "$@" 