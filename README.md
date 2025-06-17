# MiniMe-MCP: Multi-Project Memory & Sequential Thinking Server

## Project Overview

MiniMe-MCP is a containerized Model Context Protocol (MCP) server that provides persistent memory storage and structured sequential thinking capabilities across multiple projects. It serves as a "digital twin" that learns coding patterns, stores contextual memories, and facilitates complex reasoning workflows for AI systems and developers.

🔗 **For complete specifications, see [PRD.md](PRD.md)**

## Architecture

### Multi-Project Container System

```
┌─────────────────────────────────────────────────────────┐
│                    MiniMe-MCP Server                    │
│                     HTTP/REST API                      │
│                     (Port 8000)                        │
├─────────────────────────────────────────────────────────┤
│  Project Management  │  Memory Storage  │  Sequential   │
│  • Create/List       │  • Store/Retrieve│  Thinking     │
│  • Update/Delete     │  • Vector Search │  • Sequences  │
│  • Session Mgmt      │  • Embeddings    │  • Branching  │
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

## Current Status

✅ **Phase 1 Complete: Foundation**
- Multi-stage Docker build with Debian 12-slim (security-focused)
- PostgreSQL 15 + pgvector extension for vector similarity search
- Ollama integration with nomic-embed-text model for embeddings
- Non-root container operation (UID/GID 1000:1000)
- Complete database schema for multi-project isolation

✅ **Phase 2 Complete: Database Architecture**
- Multi-tenant schema with project isolation
- Memory storage with 1536-dimensional vector embeddings
- Sequential thinking system with branching and revision support
- Performance-optimized indexes and views
- Migration system with version control

🔄 **Phase 3 In Progress: Core API Implementation**
- PostgreSQL data access layer
- Project and session management APIs
- Memory storage and retrieval endpoints

## Key Features

### Multi-Project Isolation
- **Projects**: Top-level isolation boundary for different codebases
- **Sessions**: Grouping mechanism within projects (memory, thinking, mixed)
- **Complete Data Separation**: No cross-project data leakage possible

### Vector Memory Storage
- **pgvector Integration**: High-performance vector similarity search
- **1536-dimensional Embeddings**: Compatible with OpenAI and similar models  
- **HNSW Indexing**: Fast approximate nearest neighbor search
- **Memory Relationships**: Connect and categorize related memories

### Sequential Thinking System
- **Structured Reasoning**: Step-by-step thought progression with numbering
- **Revision Support**: Update and improve previous thoughts
- **Branching Logic**: Explore alternative reasoning paths from any point
- **Progress Tracking**: Monitor completion and reasoning flow

## Quick Start

### Single Container Build (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd minime-mcp

# Quick start - builds everything and starts the container
make all

# Check service health
make health
```

### Service URLs
- **Web UI**: http://localhost:8080
- **MCP Server**: http://localhost:8000
- **MCP Health**: http://localhost:8000/health
- **UI Health**: http://localhost:8080/health
- **MCP Status**: http://localhost:8000/mcp/status

### Common Commands

```bash
# Service management
make up          # Start container
make down        # Stop container
make restart     # Restart container
make status      # Show status and health

# Logs and debugging
make logs        # All logs
make logs-mcp    # MCP server logs
make logs-db     # Database logs
make debug       # Start with extensive MCP tool debugging
make debug-logs  # Watch debug logs (filtered)
make shell       # Open shell in container

# Cleanup
make clean       # Clean up everything
make rebuild     # Complete rebuild
```

### Project Structure

```
minime-mcp/
├── README.md              # This file
├── Makefile              # Root makefile (delegates to build/)
├── src/                  # MCP server source code
├── ui/                   # Web UI source code
├── build/                # Build scripts, Dockerfiles, database
│   ├── Makefile         # Main build system
│   ├── Dockerfile.*     # Container definitions
│   ├── database/        # SQL schemas and migrations
│   └── *.sh            # Build and setup scripts
└── test-scripts/        # Testing and validation scripts
```

### Advanced: Build with Local Models ⚡

The build system automatically detects and copies local Ollama models to reduce startup time:

```bash
# All handled automatically by make all
# Local models are detected in ~/.ollama and copied to container
# Saves 5-15 minutes on startup
```

> **💡 Pro Tip:** Local model copying includes only the essential `nomic-embed-text` model (274MB) to keep the container small while eliminating runtime downloads. See [LOCAL_MODELS.md](LOCAL_MODELS.md) for details.

### Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "0.1.0", 
  "phase": "Complete Installation - All Services",
  "services": {
    "database": "configured",
    "ollama": "configured", 
    "model": "nomic-embed-text"
  }
}
```

## Database Schema

### Multi-Tenant Design
```sql
-- Project isolation
projects (id, name, description, created_at, updated_at)
sessions (id, project_id, session_name, session_type, metadata, created_at, updated_at)

-- Memory storage with vector search  
memories (id, project_id, session_id, content, memory_type, embedding, metadata, created_at, updated_at)

-- Sequential thinking system
thinking_sequences (id, project_id, session_id, sequence_name, description, is_complete, metadata, created_at, updated_at)
thoughts (id, sequence_id, thought_number, total_thoughts, content, next_thought_needed, is_revision, revises_thought_id, branch_from_thought_id, branch_id, metadata, created_at)
thinking_branches (id, sequence_id, branch_id, branch_from_thought_id, branch_name, description, is_active, created_at)
```

## File Structure

```
MiniMe-MCP/
├── PRD.md                    # Complete product requirements
├── README.md                 # This file
├── CLAUDE.md                 # Claude Code instructions
└── build/                    # Docker build context
    ├── Dockerfile            # Multi-stage optimized build
    ├── docker-compose.yml     # Development setup
    ├── Makefile              # Build automation
    ├── package.json          # Node.js dependencies
    ├── server.js             # MCP server implementation
    ├── database/             # Database architecture
    │   ├── schema.sql        # Complete multi-tenant schema
    │   ├── init.sql          # Database initialization
    │   ├── migrations/       # Version-controlled schema changes
    │   └── README.md         # Database documentation
    └── docker-entrypoint-postgres-only.sh  # Container startup script
```

## Development Roadmap

### ✅ Phase 1: Foundation (Complete)
- Docker containerization with PostgreSQL + pgvector
- Ollama integration with deepseek-coder model
- Basic HTTP server with health endpoints
- Security hardening with Debian 12 + non-root user

### ✅ Phase 2: Database Architecture (Complete) 
- Multi-tenant database schema design
- Vector embedding storage with pgvector
- Sequential thinking system with branching
- Migration system and documentation

### 🔄 Phase 3: Core API (In Progress)
- PostgreSQL data access layer
- Project and session management APIs
- Memory storage and retrieval endpoints
- Basic sequential thinking endpoints

### ⏳ Phase 4: Memory System
- Vector embedding generation
- Memory storage with pgvector integration
- Vector similarity search implementation
- Memory categorization and tagging

### ⏳ Phase 5: Sequential Thinking
- Thinking sequence management
- Thought processing with branching
- Revision and history tracking
- Visual formatting and display

### ⏳ Phase 6: Integration & Polish
- LLM service integration
- Comprehensive error handling
- Performance optimization
- Documentation and testing

## Contributing

This project follows a phased development approach. See [PRD.md](PRD.md) for complete specifications and contribution guidelines.

## License

MIT License - See LICENSE file for details.