# MiniMe MCP - AI Memory & Sequential Thinking Server

**Transform your AI development workflow with persistent memory, intelligent context management, and structured reasoning capabilities.**

MiniMe MCP is a production-ready Model Context Protocol (MCP) server that serves as your "digital developer twin" - learning from your coding patterns, storing contextual memories, and facilitating complex reasoning workflows across all your projects.

## 🚀 Quick Start (2 Minutes)

### Prerequisites
- **Docker Desktop** or Docker Engine
- **Node.js** 18+ 
- **Cursor IDE** or **VS Code** with Claude extension

### 1. Install MCP Client
```bash
npm install -g @minimemcp/mcp-client
```

### 2. Run MiniMe Server
```bash
# Docker will automatically create the volume if it doesn't exist
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

> **💡 Note**: The `minime-data` volume will be automatically created by Docker to persist your project data, memories, and database.

### 3. Configure Cursor IDE
1. Open Cursor Settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Navigate to **Tools and Integration** → **MCP Tools**
3. Click **Add** button
4. Paste this configuration:

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

5. Restart Cursor

### 4. Start Using AI Memory
- **MCP Server**: http://localhost:8000
- **Web UI Dashboard**: http://localhost:9000

Say to Claude in Cursor: *"Let's get into planning mode: I want to build a React dashboard"* and watch MiniMe automatically create project briefs, tasks, and intelligent suggestions based on your past development patterns!

## 🧠 What Makes MiniMe Special

### 🎯 **Intelligent Planning Mode**
Ask Claude: *"Help me plan this project"* and MiniMe automatically:
- Creates comprehensive project documentation
- Breaks down requirements into actionable tasks
- Suggests improvements based on your past patterns
- Provides structured reasoning for complex decisions

### 🔍 **Persistent AI Memory**
- **Semantic Search**: Find solutions from your entire development history
- **Pattern Learning**: Discovers your preferred technologies, architectures, and approaches
- **Context Awareness**: Remembers project contexts, decisions, and lessons learned
- **Cross-Project Insights**: Applies learnings from one project to another

### 🧩 **Sequential Thinking Engine**
- **Structured Reasoning**: Break down complex technical decisions step-by-step
- **Branching Logic**: Explore multiple solution paths
- **Decision Audit Trail**: Track how and why decisions were made
- **Collaborative Thinking**: Build on previous reasoning sessions

## 🛠 Available Tools

Once configured, you'll have access to these powerful MiniMe tools in Cursor:

### **Planning & Documentation**
- **`create_project_brief`**: Generate enterprise-grade project documentation
- **`create_tasks`**: Convert requirements into actionable tasks
- **`suggest_tasks`**: AI-powered project improvement suggestions

### **Memory Management**
- **`store_memory`**: Save development information with AI context understanding
- **`search_memories`**: Find relevant memories using semantic search
- **`get_learning_insights`**: Discover patterns from your development history

### **Progress Tracking**
- **`store_progress`**: Track project evolution with automatic versioning
- **`get_progress_history`**: Generate comprehensive project status reports

### **Structured Reasoning**
- **`start_thinking_sequence`**: Begin complex technical decision analysis
- **`add_thought`**: Build on reasoning with confidence tracking
- **`complete_thinking_sequence`**: Finalize decisions with actionable outcomes

## 📦 Installation Options

### Option 1: Docker Hub (Recommended)
```bash
# Pull and run latest version
docker pull manujbawa/minimemcp:latest
docker run -d \
  --name minimemcp \
  -p 8000:8000 \
  -p 9000:9000 \
  -v minime-data:/data \
  manujbawa/minimemcp:latest
```

> **💡 Note**: Add `-v minime-data:/data` to persist your data across container restarts.

**Docker Hub**: https://hub.docker.com/r/manujbawa/minimemcp

### Option 2: NPM Package
```bash
# Global installation for command-line usage
npm install -g @minimemcp/mcp-client
```

**NPM Package**: https://www.npmjs.com/package/@minimemcp/mcp-client

## 🎯 VS Code Configuration

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

## 🖥 Claude Desktop Configuration

### 1. Install Claude Desktop
Download from [claude.ai/desktop](https://claude.ai/desktop)

### 2. Configure MCP Server
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

### 3. Restart Claude Desktop
Close and reopen Claude Desktop. The MiniMe tools should appear in your chat.

## ✅ Verification

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
MINIME_SERVER_URL=http://localhost:8000 minime-mcp
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
4. Try: "Let's get into planning mode: I want to build a Python API"
5. Verify the tools execute and create project documentation

## 🔧 Troubleshooting

### Docker Container Issues
```bash
# Check if Docker is running
docker --version

# Check container status
docker ps -a -f name=minimemcp

# View container logs
docker logs minimemcp

# Restart container
docker restart minimemcp
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :8000
lsof -i :9000

# Use different ports if needed
docker run -d --name minimemcp -p 8001:8000 -p 9001:9000 manujbawa/minimemcp:latest
```

### MCP Client Issues
```bash
# Check if globally installed
which minime-mcp

# Reinstall if missing
npm uninstall -g @minimemcp/mcp-client
npm install -g @minimemcp/mcp-client

# Test connection
MINIME_SERVER_URL=http://localhost:8000 MINIME_DEBUG=true minime-mcp
```

### IDE Integration Problems
- Verify server is running: `docker ps -f name=minimemcp`
- Test MCP client manually: `MINIME_SERVER_URL=http://localhost:8000 minime-mcp`
- Ensure correct configuration: `"command": "minime-mcp"` (not npx)
- Restart IDE after configuration changes
- Check IDE extension logs for MCP errors

## 🎉 Next Steps

After installation:

1. **Explore UI**: Visit http://localhost:9000
2. **Try Planning Mode**: Ask Claude "Let's get into planning mode for a new project"
3. **Store Memories**: Start building your knowledge base with development decisions
4. **Track Progress**: Use project briefs and progress tracking features
5. **Sequential Thinking**: Try complex reasoning workflows for architectural decisions

## 🏗 Architecture Overview

### Multi-Project Container System

```
┌─────────────────────────────────────────────────────────┐
│                    MiniMe MCP Server                    │
│                     HTTP/REST API                       │
│                     (Port 8000)                        │
├─────────────────────────────────────────────────────────┤
│  Memory Storage  │  Sequential       │  Project        │
│  • Vector Search │  Thinking         │  Management     │
│  • Embeddings    │  • Sequences      │  • Briefs       │
│  • Patterns      │  • Branching      │  • Tasks        │
└─────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   + pgvector    │
                    │   Multi-tenant  │
                    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │     Ollama      │
                    │  nomic-embed-   │
                    │     text        │
                    └─────────────────┘
```

## 🔒 Security Features

- **Non-root container execution** (UID/GID 1001)
- **Debian 12 security-hardened base**
- **No exposed secrets in runtime**
- **Container isolation with volume persistence**
- **Regular security scanning and updates**

## 📊 Key Features

### **Multi-Project Isolation**
- Complete data separation between projects
- Session-based organization within projects
- No cross-project data leakage possible

### **Vector Memory Storage**
- pgvector integration for semantic search
- 1536-dimensional embeddings (OpenAI compatible)
- HNSW indexing for fast similarity search
- Memory relationships and categorization

### **Sequential Thinking System**
- Structured step-by-step reasoning
- Branching logic for exploring alternatives
- Revision support for improving thoughts
- Confidence tracking and decision audit trails

### **Learning Intelligence**
- Pattern detection across all projects
- Technology preference learning
- Anti-pattern identification
- Success metric correlation

---

# 👨‍💻 Developer Information

*The following section is for developers who want to contribute or build from source.*

## 🛠 Development Setup

### Requirements
- **Docker Desktop** (recommended) or Docker Engine
- **Node.js** 18+
- **Git**
- **Make** (for build automation)

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
# Build and deployment
make help          # Show all commands
make build         # Build Docker image
make up            # Start services
make down          # Stop services
make restart       # Restart services
make rebuild       # Complete rebuild

# Monitoring and debugging
make logs          # View logs
make status        # Check container status
make health        # Run health checks
make shell         # Open container shell
make debug         # Start with debug logging
make debug-logs    # Watch debug logs

# Docker Hub publishing
make login-hub     # Login to Docker Hub
make tag-hub       # Tag images for Docker Hub
make publish       # Publish to Docker Hub

# Cleanup
make clean         # Clean up (WARNING: deletes data)
make clean-images  # Clean old images only
```

### 4. Project Structure
```
MiniMe-MCP/
├── README.md                     # This file
├── INSTALLATION.md               # Detailed installation guide
├── PRD.md                       # Product requirements
├── CLAUDE.md                    # Claude Code instructions
├── src/                         # MCP server source code
│   ├── server.js               # Main HTTP server
│   ├── mcp-stdio.js            # MCP stdio transport
│   ├── package.json            # Node.js dependencies
│   └── services/               # Core services
│       ├── mcp-tools.js        # MCP tool implementations
│       ├── database-service.js # Database operations
│       ├── learning-pipeline.js # AI learning system
│       └── ai-task-suggestion.js # Intelligent task suggestions
├── ui/                         # React web dashboard
│   ├── src/                    # React components
│   ├── package.json            # UI dependencies
│   └── server.js               # UI server
├── mcp-client/                 # NPM package source
│   ├── src/index.js            # MCP client implementation
│   ├── bin/minime-mcp          # CLI binary
│   ├── package.json            # Package configuration
│   └── README.md               # Client documentation
├── build/                      # Docker build context
│   ├── Makefile                # Build automation
│   ├── Dockerfile.local-models # Production Dockerfile
│   ├── database/               # Database schemas
│   │   ├── schema.sql          # Complete schema
│   │   ├── migrations/         # Version migrations
│   │   └── init.sql            # Database initialization
│   ├── docker-entrypoint.sh    # Container startup
│   └── *.sh                    # Build scripts
└── test-scripts/               # Testing utilities
```

### 5. Local Development Workflow
```bash
# Start with debug logging
make debug

# Watch debug logs in another terminal
make debug-logs

# Make code changes in src/ or ui/
# Rebuild after changes
make debug-rebuild

# Test specific components
make test
```

### 6. Database Development
```bash
# Access database directly
make shell-db

# Check database logs
make logs-db

# Reset database (WARNING: deletes data)
make clean && make build && make up
```

### 7. Contributing Guidelines

#### Code Style
- Follow existing patterns in the codebase
- Use explicit error handling
- Add logging for debugging
- Document complex functions

#### MCP Tools Development
- Add tools to `src/services/mcp-tools.js`
- Include comprehensive descriptions with examples
- Add AUTO-TRIGGER patterns for agent usage
- Test tools via HTTP API and MCP client

#### Database Changes
- Create migration files in `build/database/migrations/`
- Update schema.sql for new installations
- Test migrations with sample data

#### UI Development
```bash
# UI-specific development
cd ui
npm install
npm run dev  # Start development server

# Build for production
npm run build
```

### 8. Testing
```bash
# Health checks
make health

# MCP client testing
cd mcp-client
MINIME_SERVER_URL=http://localhost:8000 MINIME_DEBUG=true node src/index.js

# API testing
curl http://localhost:8000/health
curl http://localhost:8000/mcp/status

# UI testing
curl http://localhost:9000
```

### 9. Security Scanning
```bash
# Run Trivy security scan
trivy image --severity HIGH,CRITICAL minimemcp:latest

# Check for vulnerabilities
npm audit

# Update dependencies
npm update
```

### 10. Publishing Workflow

#### NPM Package
```bash
cd mcp-client
npm version patch  # Increment version
npm publish       # Publish to NPM
```

#### Docker Hub
```bash
cd build
make publish      # Build, tag, and push to Docker Hub
```

## 🗂 Database Schema

### Multi-Tenant Design
```sql
-- Project isolation
projects (id, name, description, created_at, updated_at)
sessions (id, project_id, session_name, session_type, metadata)

-- Memory storage with vector search  
memories (id, project_id, session_id, content, memory_type, embedding, metadata)

-- Sequential thinking system
thinking_sequences (id, project_id, session_id, sequence_name, description, is_complete)
thoughts (id, sequence_id, thought_number, content, confidence, metadata)

-- Progress tracking  
progress_entries (id, project_id, progress_description, version, completion_percentage)

-- Task tracking through memories system (consolidated)
-- Tasks are stored as memory_type = 'task' with rich metadata:
-- metadata: {title, task_type, status, priority, completed_at, ...}

-- Learning and pattern detection
learning_insights (id, insight_type, pattern_data, confidence_score, projects_analyzed)
```

## 🔧 Configuration Options

### Environment Variables
```bash
# Server configuration
MINIME_SERVER_URL=http://localhost:8000    # Server URL
MCP_PORT=8000                              # MCP server port
UI_PORT=9000                               # UI server port

# Database configuration
POSTGRES_PASSWORD=minime_password          # Database password
POSTGRES_DB=minime_memories               # Database name
POSTGRES_USER=minime                      # Database user

# Features
USE_LOCAL_MODELS=true                     # Use embedded Ollama models
LOAD_SAMPLE_DATA=true                     # Load sample data on startup
MCP_DEBUG=false                           # Enable MCP debug logging

# AI/ML configuration
EMBEDDING_MODEL=nomic-embed-text          # Ollama embedding model
EMBEDDING_DIMENSIONS=768                  # Embedding vector dimensions
```

### Docker Build Arguments
```bash
# Custom build with arguments
docker build -f Dockerfile.local-models \
  --build-arg USER_ID=1001 \
  --build-arg GROUP_ID=1001 \
  --build-arg USE_LOCAL_MODELS=true \
  -t minimemcp:custom .
```

## 📈 Monitoring and Debugging

### Container Health
```bash
# Comprehensive health check
docker exec minimemcp curl http://localhost:8000/health

# Service-specific checks
curl http://localhost:8000/mcp/status      # MCP service status
curl http://localhost:9000/health          # UI service status
```

### Log Analysis
```bash
# All logs
docker logs minimemcp

# Filtered logs
docker logs minimemcp | grep -E "(ERROR|WARN)"
docker logs minimemcp | grep "MCP"

# Real-time debugging
make debug-logs
```

### Performance Monitoring
```bash
# Container resource usage
docker stats minimemcp

# Database performance
make shell-db
# Run EXPLAIN ANALYZE on queries
```

## 🚀 Deployment

### Production Deployment
```bash
# Pull production image
docker pull manujbawa/minimemcp:latest

# Run with production configuration
docker run -d \
  --name minimemcp-prod \
  -p 8000:8000 \
  -p 9000:9000 \
  -v minime-prod-data:/data \
  -e POSTGRES_PASSWORD=secure_password \
  -e USE_LOCAL_MODELS=true \
  -e LOAD_SAMPLE_DATA=false \
  --restart unless-stopped \
  manujbawa/minimemcp:latest
```

### Backup and Recovery
```bash
# Backup data volume
docker run --rm -v minime-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minime-backup.tar.gz /data

# Restore data volume
docker run --rm -v minime-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/minime-backup.tar.gz -C /
```

## 📝 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/MiniMe-MCP/issues)
- **Documentation**: [Full Installation Guide](INSTALLATION.md)
- **Docker Hub**: https://hub.docker.com/r/manujbawa/minimemcp
- **NPM Package**: https://www.npmjs.com/package/@minimemcp/mcp-client