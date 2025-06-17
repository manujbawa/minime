# MiniMe MCP - Installation Guide

Complete installation and configuration guide for MiniMe MCP (Model Context Protocol) server with persistent memory, sequential thinking, and meta-learning capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [MCP Client Setup](#mcp-client-setup)
- [Docker Server Setup](#docker-server-setup)
- [Cursor IDE Configuration](#cursor-ide-configuration)
- [VS Code Configuration](#vs-code-configuration)
- [Claude Desktop Configuration](#claude-desktop-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Developer Setup](#developer-setup)

## Prerequisites

- **Docker Desktop** (recommended) or Docker Engine
- **Node.js** 18+ (for npm)
- **Cursor IDE** or **VS Code** with Claude extension
- **curl** (for testing)

### System Requirements

- **Memory**: 4GB+ RAM
- **Storage**: 2GB+ free space
- **OS**: macOS, Linux, or Windows with WSL2

## Quick Start

### 1. Install MCP Client

```bash
# Install the MiniMe MCP client globally
npm install -g @minimemcp/mcp-client
```

### 2. Start MiniMe Server with Docker

```bash
# Pull and run the MiniMe server
docker run -d \
  --name minimemcp \
  -p 8000:8000 \
  -p 9000:9000 \
  -v minime-data:/data \
  -e POSTGRES_PASSWORD=minime_password \
  -e USE_LOCAL_MODELS=true \
  -e LOAD_SAMPLE_DATA=true \
  manujbawa/minimemcp:latest
```

### 3. Access Services

- **MCP Server**: http://localhost:8000
- **Web UI Dashboard**: http://localhost:9000
- **Health Check**: http://localhost:8000/health

### 4. Test Connection

```bash
# Verify the MCP client can connect
MINIME_SERVER_URL=http://localhost:8000 minime-mcp
```

## Docker Server Setup

### Using Docker Hub Image (Recommended)

```bash
# Pull the latest image
docker pull manujbawa/minimemcp:latest

# Run with persistent data
docker run -d \
  --name minimemcp \
  -p 8000:8000 \
  -p 9000:9000 \
  -v minime-data:/data \
  -e POSTGRES_PASSWORD=minime_password \
  -e USE_LOCAL_MODELS=true \
  -e LOAD_SAMPLE_DATA=true \
  manujbawa/minimemcp:latest
```

### Docker Management Commands

```bash
# Check container status
docker ps -f name=minimemcp

# View logs
docker logs minimemcp -f

# Stop container
docker stop minimemcp

# Start container
docker start minimemcp

# Remove container (WARNING: deletes data if no volume)
docker rm minimemcp

# Remove container and volume (WARNING: deletes all data)
docker rm minimemcp && docker volume rm minime-data
```

### Container Health Check

```bash
# Check if container is running
docker ps -f name=minimemcp

# Test health endpoint
curl http://localhost:8000/health

# Check container logs
docker logs minimemcp --tail 50
```

## MCP Client Setup

### Install MCP Client

Install the MiniMe MCP client globally:

```bash
npm install -g @minimemcp/mcp-client
```

This creates a global `minime-mcp` command that will be used in IDE configurations.

### Verify Installation

```bash
# Check if minime-mcp command is available
which minime-mcp

# Test connection to server (ensure Docker container is running first)
MINIME_SERVER_URL=http://localhost:8000 minime-mcp
```

### Alternative: NPX Method

If you prefer not to install globally:

```bash
# Use npx (downloads and runs automatically)
MINIME_SERVER_URL=http://localhost:8000 npx @minimemcp/mcp-client
```

**Note**: The IDE configurations below assume global installation with `minime-mcp` command.

## Cursor IDE Configuration

### 1. Start MiniMe Server

First, ensure your MiniMe server is running:

```bash
# Check Docker container status
docker ps -f name=minimemcp
```

### 2. Configure MCP in Cursor

1. Open Cursor Settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Navigate to **Tools and Integration** → **MCP Tools**
3. Click **Add** button
4. Paste the following JSON configuration:

```json
{
  "mcpServers": {
    "minime": {
      "command": "minime-mcp",
      "env": {
        "MINIME_SERVER_URL": "http://localhost:8000",
        "MINIME_DEBUG": "true"
      }
    }
  }
}
```

### 3. Restart Cursor

After adding the configuration:
1. Close Cursor completely
2. Reopen Cursor
3. The MiniMe tools should now appear in Claude chat

### 4. Available Tools

Once configured, you'll have access to these MiniMe tools in Cursor:

- **store_memory**: Save important information
- **search_memories**: Find relevant memories using semantic search
- **get_learning_insights**: Discover patterns from your development history
- **create_tasks**: Convert requirements into actionable tasks
- **get_project_progress**: Track project milestones
- **sequential_thinking**: Complex reasoning workflows
- **And many more!**

## VS Code Configuration

### 1. Install Claude Extension

Install the Claude Dev extension from VS Code marketplace.

### 2. Configure MCP Server

Open VS Code Settings JSON (`Ctrl+Shift+P` → "Preferences: Open User Settings (JSON)"):

```json
{
  "claude.mcpServers": {
    "minime": {
      "command": "minime-mcp",
      "env": {
        "MINIME_SERVER_URL": "http://localhost:8000",
        "MINIME_DEBUG": "true"
      }
    }
  }
}
```

### 3. Workspace Settings

Alternatively, create `.vscode/settings.json` in your project:

```json
{
  "claude.mcpServers": {
    "minime": {
      "command": "minime-mcp",
      "env": {
        "MINIME_SERVER_URL": "http://localhost:8000",
        "MINIME_DEBUG": "true"
      }
    }
  }
}
```

## Claude Desktop Configuration

### 1. Start MiniMe Server

Ensure your MiniMe server is running:

```bash
cd MiniMe-MCP
make all
```

### 2. Install Claude Desktop

Download from [claude.ai/desktop](https://claude.ai/desktop)

### 3. Configure MCP Server

Edit Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "minime": {
      "command": "minime-mcp",
      "env": {
        "MINIME_SERVER_URL": "http://localhost:8000",
        "MINIME_DEBUG": "true"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

Close and reopen Claude Desktop. The MiniMe tools should appear in your chat.

## Verification

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "embeddings": "healthy" 
  }
}
```

### 2. Test MCP Client

```bash
# Test the MCP client directly
npx @minimemcp/mcp-client
# Should connect and show available tools
```

### 3. Verify UI Access

1. Open http://localhost:9000
2. Navigate to "Projects" 
3. Click "View Details" on any project
4. Verify all tabs load (Overview, Briefs, Progress, Tasks, Timeline, Thinking)

### 4. Test IDE Integration

**In Cursor/VS Code with Claude:**

1. Open chat with Claude
2. Ask: "What MCP tools are available?"
3. You should see MiniMe tools listed
4. Try: "Store a memory about this project"
5. Verify the tool executes successfully

**Expected MiniMe Tools:**
- store_memory
- search_memories  
- get_learning_insights
- create_tasks
- get_project_progress
- sequential_thinking
- store_progress
- get_project_briefs

## Troubleshooting

### Common Issues

**1. Docker Container Not Starting**
```bash
# Check if Docker is running
docker --version

# Check container status
docker ps -a -f name=minimemcp

# View container logs
docker logs minimemcp

# Remove and recreate container
docker stop minimemcp
docker rm minimemcp
docker run -d --name minimemcp -p 8000:8000 -p 9000:9000 manujbawa/minimemcp:latest
```

**2. Port Already in Use**
```bash
# Check what's using ports
lsof -i :8000
lsof -i :9000

# Find and stop conflicting processes
docker ps | grep 8000
kill -9 <PID>

# Or use different ports
docker run -d --name minimemcp -p 8001:8000 -p 9001:9000 manujbawa/minimemcp:latest
```

**3. MCP Client Not Found**
```bash
# Check if globally installed
which minime-mcp

# Reinstall if missing
npm uninstall -g @minimemcp/mcp-client
npm install -g @minimemcp/mcp-client

# Verify installation
minime-mcp --version

# Clear npm cache if issues persist
npm cache clean --force
```

**4. Connection Issues**
```bash
# Test server health
curl http://localhost:8000/health

# Test MCP client connection
MINIME_SERVER_URL=http://localhost:8000 MINIME_DEBUG=true minime-mcp

# Check container network
docker inspect minimemcp | grep IPAddress
```

**5. Docker Permission Issues (Linux)**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Restart shell or logout/login
newgrp docker

# Test docker without sudo
docker ps
```

**6. Memory/Performance Issues**
```bash
# Check container resource usage
docker stats minimemcp

# Restart container
docker restart minimemcp

# Increase Docker memory limit in Docker Desktop settings
# Recommended: 4GB+ RAM allocation
```

**7. IDE Integration Issues**
```bash
# Verify server is running
docker ps -f name=minimemcp

# Test MCP client manually
MINIME_SERVER_URL=http://localhost:8000 minime-mcp

# Check IDE configuration
# Ensure "command": "minime-mcp" and not "npx" with args

# Restart IDE after configuration changes
# Check IDE extension logs for MCP errors
```

**8. UI Not Loading**
```bash
# Check UI server status
curl http://localhost:9000

# Check container logs
docker logs minimemcp | grep -i ui

# Access container shell for debugging
docker exec -it minimemcp /bin/sh
```

**9. Database/Embedding Issues**
```bash
# Check container logs for database errors
docker logs minimemcp | grep -i postgres

# Check if embeddings are working
curl http://localhost:8000/mcp/status

# Restart container to reinitialize
docker restart minimemcp
```

### Debug Mode

Enable detailed logging:

```bash
# Start with debug enabled
make debug

# Watch debug logs
make debug-logs

# Or enable in IDE configuration
"MINIME_DEBUG": "true"
```

### Log Locations

- **Container logs**: `make logs`
- **MCP-specific logs**: `make logs-mcp`
- **Database logs**: `make logs-db`
- **Client debug**: Set `MINIME_DEBUG=true`

### Getting Help

1. **Check status**: `make status`
2. **Check health**: `make health`
3. **View logs**: `make logs`
4. **Test client**: `npx @minimemcp/mcp-client`

## Developer Setup

For developers who want to build from source or contribute to the project:

### 1. Clone Repository

```bash
git clone https://github.com/your-org/MiniMe-MCP.git
cd MiniMe-MCP
```

### 2. Build from Source

```bash
# One-command setup - builds and starts everything
cd build
make all
```

This will:
- Build Docker image with local models (PostgreSQL + Ollama)
- Start MiniMe MCP server on port 8000
- Start Web UI on port 9000
- Load sample data and run health checks

### 3. Development Commands

```bash
make help          # Show all commands
make build         # Build Docker image
make up            # Start services
make down          # Stop services
make logs          # View logs
make restart       # Restart services
make status        # Check container status
make health        # Run health checks
make clean         # Clean up (WARNING: deletes data)
make rebuild       # Complete rebuild
make shell         # Open container shell
make debug         # Start with debug logging
make debug-logs    # Watch debug logs
make publish       # Publish to Docker Hub
```

### 4. Local Development

For active development with code changes:

```bash
# Start with debug logging
make debug

# Watch debug logs in another terminal
make debug-logs

# Rebuild after code changes
make debug-rebuild
```

## Next Steps

After installation:

1. **Explore UI**: Visit http://localhost:9000
2. **Try MCP Tools**: Use in Cursor/VS Code with Claude
3. **Store Memories**: Start building your knowledge base
4. **Track Progress**: Use project briefs and progress tracking
5. **Sequential Thinking**: Try complex reasoning workflows

The MiniMe MCP server is now ready to enhance your AI development workflow with persistent memory, intelligent context management, and structured thinking capabilities.