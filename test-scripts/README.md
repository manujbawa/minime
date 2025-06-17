# MiniMe-MCP Test Scripts

This directory contains comprehensive test scripts to validate MiniMe-MCP deployments. These scripts ensure all components are working correctly after deployment.

## Quick Start

### Run All Tests
```bash
# Test existing container
./run-all-tests.sh [container-name] [port]

# Build and test from scratch
./build-and-test.sh [container-name]
```

### Examples
```bash
# Test default container 'minime-test' on port 8000
./run-all-tests.sh

# Test custom container on different port
./run-all-tests.sh my-container 8080

# Complete build and test pipeline
./build-and-test.sh
```

## Test Categories

### 📋 Core System Tests
- **test-health.sh** - System health check
- **test-mcp-status.sh** - MCP server status
- **test-database.sh** - Database connectivity
- **test-embeddings.sh** - Embedding models

### 🔌 API Endpoint Tests
- **test-learning-api.sh** - Learning pipeline APIs
- **test-project-api.sh** - Project management APIs
- **test-memory-api.sh** - Memory storage APIs

### 🛠️ MCP Tool Tests
- **test-mcp-tools.sh** - MCP tools discovery
- **test-mcp-schema.sh** - Schema validation
- **test-learning-triggers.sh** - Learning triggers

### 🖥️ UI Tests
- **test-ui-main.sh** - Main UI page
- **test-ui-mcp-tools.sh** - MCP Tools page
- **test-ui-meta-learning.sh** - Meta-Learning page

### 🐳 Container Health Tests
- **test-container-health.sh** - Container status
- **test-container-logs.sh** - Log analysis

### ⚡ Performance Tests
- **test-performance.sh** - Response time check
- **test-resource-usage.sh** - Memory usage check

## Individual Test Usage

Each test script can be run independently:

```bash
# Run individual test
./test-health.sh [container-name] [port]

# Examples
./test-health.sh minime-test 8000
./test-mcp-tools.sh my-container 8080
```

## Test Output

### Success Example
```
✅ HEALTH CHECK: System healthy - Complete System - Memory + Sequential Thinking + Meta-Learning
✅ MCP STATUS: Server ready with 17 tools
✅ DATABASE: Connected and functional
```

### Failure Example
```
❌ HEALTH CHECK: System unhealthy - Status: unhealthy, DB: unhealthy, Embeddings: healthy
❌ MCP STATUS: Server not ready - Message: unknown, Tools: 0
```

## Prerequisites

- **Docker** - Container runtime
- **jq** - JSON processing
- **curl** - HTTP requests
- **npm** - For UI builds (build-and-test only)

### Install jq
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

## Test Validation

The test scripts validate:

1. **System Health** - All services healthy
2. **MCP Compatibility** - 17 tools with full schemas
3. **Database Operations** - CRUD functionality
4. **Learning Pipeline** - Pattern detection and insights
5. **UI Accessibility** - All pages load correctly
6. **Container Stability** - Resource usage and logs
7. **Performance** - Response times under 5 seconds

## Exit Codes

- `0` - Test passed
- `1` - Test failed

## Troubleshooting

### Common Issues

1. **Container not running**
   ```bash
   docker run -d --name minime-test -p 8000:8000 minime-mcp:test
   ```

2. **Port conflicts**
   ```bash
   ./run-all-tests.sh minime-test 8080
   ```

3. **jq not found**
   ```bash
   brew install jq  # macOS
   ```

4. **Permission denied**
   ```bash
   chmod +x *.sh
   ```

### Debugging Failed Tests

1. Check container logs:
   ```bash
   docker logs minime-test
   ```

2. Check container health:
   ```bash
   docker ps
   curl http://localhost:8000/health
   ```

3. Run individual tests for details:
   ```bash
   ./test-health.sh minime-test 8000
   ```

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run MiniMe-MCP Tests
  run: |
    cd test-scripts
    ./build-and-test.sh ci-test
```

## Test Development

To add new tests:

1. Create new test script following the pattern
2. Add to `run-all-tests.sh` 
3. Make executable: `chmod +x test-new-feature.sh`
4. Test standalone: `./test-new-feature.sh`