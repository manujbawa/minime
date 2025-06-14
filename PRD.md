# MiniMe-MCP: Multi-Project Memory & Sequential Thinking Server
## Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2025-06-14  
**Status:** In Development  

---

## Executive Summary

MiniMe-MCP is a containerized Model Context Protocol (MCP) server that provides persistent memory storage and structured sequential thinking capabilities across multiple projects. It serves as a "digital twin" that learns coding patterns, stores contextual memories, and facilitates complex reasoning workflows for AI systems and developers.

## Product Vision

Create an intelligent, persistent memory and reasoning system that can:
- Store and retrieve contextual memories across multiple development projects
- Provide structured sequential thinking capabilities for complex problem-solving
- Learn and adapt to coding patterns and developer preferences
- Operate securely in containerized environments without external dependencies

## Core Value Propositions

1. **Multi-Project Intelligence**: Separate memory and thinking contexts for different projects
2. **Persistent Learning**: Memories and thought processes survive system restarts
3. **Vector-Based Retrieval**: Advanced similarity search using pgvector
4. **Structured Reasoning**: Step-by-step thinking with branching and revision capabilities
5. **Zero External Dependencies**: Fully self-contained with local LLM inference
6. **Security-First Design**: Containerized with non-root operations and secure base images

## Target Users

- **AI Developers**: Building systems that need persistent memory and reasoning
- **Development Teams**: Requiring shared knowledge bases across projects
- **Researchers**: Needing structured thinking and knowledge management tools
- **Enterprise**: Organizations requiring local, secure AI memory systems

---

## Technical Architecture

### System Overview

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
                    │   deepseek-     │
                    │   coder:6.7b    │
                    └─────────────────┘
```

### Technology Stack

- **Runtime**: Node.js 20 (LTS)
- **Language**: JavaScript ES modules
- **Framework**: Express.js + MCP SDK 1.12.3
- **Transport**: Streamable HTTP (latest MCP standard)
- **Database**: PostgreSQL 15 + pgvector extension
- **LLM**: Ollama with nomic-embed-text (embedding model)
- **Container**: Docker with Debian 12-slim (security-focused)
- **User Context**: Non-root operation (UID/GID 1000:1000)

### Database Schema

#### Core Tables
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

---

## Feature Specifications

### 1. Project Management

**Requirements:**
- Create, read, update, delete projects
- Project isolation (no data leakage between projects)
- Project metadata and configuration storage
- List and search projects

**API Endpoints:**
```
POST   /api/projects                     # Create project
GET    /api/projects                     # List projects
GET    /api/projects/:projectId          # Get project details
PUT    /api/projects/:projectId          # Update project
DELETE /api/projects/:projectId          # Delete project
```

**Data Model:**
```typescript
interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}
```

### 2. Session Management

**Requirements:**
- Create sessions within projects
- Support different session types: 'memory', 'thinking', 'mixed'
- Session-scoped data isolation
- Session metadata storage

**API Endpoints:**
```
POST   /api/projects/:projectId/sessions           # Create session
GET    /api/projects/:projectId/sessions           # List sessions
GET    /api/projects/:projectId/sessions/:sessionId # Get session
DELETE /api/projects/:projectId/sessions/:sessionId # Delete session
```

**Data Model:**
```typescript
interface Session {
  id: number;
  project_id: number;
  session_name: string;
  session_type: 'memory' | 'thinking' | 'mixed';
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}
```

### 3. Memory Storage System

**Requirements:**
- Store contextual memories with vector embeddings
- Vector similarity search using pgvector
- Memory categorization and tagging
- Project and session scoped memory retrieval
- Bulk memory operations

**API Endpoints:**
```
POST   /api/projects/:projectId/sessions/:sessionId/memories # Store memory
GET    /api/projects/:projectId/sessions/:sessionId/memories # Get memories
POST   /api/projects/:projectId/memories/search              # Vector search
GET    /api/projects/:projectId/memories                     # All project memories
DELETE /api/projects/:projectId/memories/:memoryId           # Delete memory
```

**Data Model:**
```typescript
interface Memory {
  id: number;
  project_id: number;
  session_id?: number;
  content: string;
  memory_type: string;
  embedding: number[]; // Vector embedding
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}
```

### 4. Sequential Thinking System

**Requirements:**
- Create structured thinking sequences
- Step-by-step thought progression with numbering
- Thought revision capabilities
- Branching logic for alternative reasoning paths
- Sequence completion tracking
- Visual formatting and display

**API Endpoints:**
```
POST   /api/projects/:projectId/sessions/:sessionId/thinking/sequences  # Create sequence
GET    /api/projects/:projectId/sessions/:sessionId/thinking/sequences  # List sequences
POST   /api/projects/:projectId/thinking/sequences/:sequenceId/thoughts # Add thought
GET    /api/projects/:projectId/thinking/sequences/:sequenceId/thoughts # Get thoughts
PUT    /api/projects/:projectId/thinking/thoughts/:thoughtId            # Revise thought
POST   /api/projects/:projectId/thinking/thoughts/:thoughtId/branch     # Create branch
```

**Data Models:**
```typescript
interface ThinkingSequence {
  id: number;
  project_id: number;
  session_id: number;
  sequence_name: string;
  description?: string;
  is_complete: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface Thought {
  id: number;
  sequence_id: number;
  thought_number: number;
  total_thoughts: number;
  content: string;
  next_thought_needed: boolean;
  is_revision: boolean;
  revises_thought_id?: number;
  branch_from_thought_id?: number;
  branch_id?: string;
  metadata: Record<string, any>;
  created_at: Date;
}
```

### 5. LLM Integration

**Requirements:**
- Local Ollama integration with deepseek-coder model
- Embedding generation for memory storage
- Inference capabilities for reasoning enhancement
- Model health monitoring
- Graceful fallback when model unavailable

**Internal APIs:**
```typescript
interface LLMService {
  generateEmbedding(text: string): Promise<number[]>;
  chat(messages: ChatMessage[]): Promise<string>;
  isHealthy(): Promise<boolean>;
}
```

---

## Non-Functional Requirements

### Performance
- **Response Time**: < 200ms for memory retrieval, < 500ms for vector search
- **Throughput**: Support 100+ concurrent requests
- **Memory Usage**: < 2GB RAM under normal load
- **Storage**: Efficient vector storage with pgvector indexing

### Security
- **Container Security**: Non-root user (1000:1000), minimal attack surface
- **Network**: No external dependencies, local-only operation
- **Data**: Project isolation, no cross-project data access
- **Base Image**: Debian 12-slim for security updates

### Reliability
- **Uptime**: 99.9% availability target
- **Data Integrity**: ACID transactions, foreign key constraints
- **Error Handling**: Graceful degradation, comprehensive error responses
- **Recovery**: Automatic service restart, data persistence

### Scalability
- **Multi-Project**: Support 1000+ projects per instance
- **Data Growth**: Handle 10M+ memories with efficient vector search
- **Sessions**: Support 100+ concurrent thinking sessions
- **Storage**: PostgreSQL with proper indexing and partitioning

### Maintainability
- **Code Quality**: TypeScript with strict typing, comprehensive testing
- **Documentation**: API documentation, deployment guides
- **Monitoring**: Health checks, structured logging
- **Updates**: Container-based deployment for easy updates

---

## Development Phases

### Phase 1: Foundation (✅ Complete)
- ✅ Docker containerization with PostgreSQL + pgvector
- ✅ Ollama integration with nomic-embed-text model
- ✅ Streamable HTTP transport (MCP SDK 1.12.3)
- ✅ Security hardening with Debian 12 + non-root user

### Phase 2: Core API (✅ Complete)
- ✅ Database schema implementation
- ✅ Project and session management APIs
- ✅ Basic memory storage and retrieval
- ✅ PostgreSQL connection and data access layer

### Phase 3: Memory System (✅ Complete)
- ✅ Vector embedding generation
- ✅ Memory storage with pgvector integration
- ✅ Vector similarity search implementation
- ✅ Memory categorization and tagging

### Phase 4: Sequential Thinking (✅ Complete)
- ✅ Thinking sequence management
- ✅ Thought processing with branching
- ✅ Revision and history tracking
- ✅ Visual formatting and display

### Phase 5: Integration & Polish (✅ Complete)
- ✅ MCP tools service integration
- ✅ Comprehensive error handling
- ✅ Performance optimization
- ✅ Documentation and testing

### Phase 6: Production Ready (✅ Complete)
- ✅ Streamable HTTP transport upgrade
- ✅ Session management and resumability
- ✅ Migration guide for SSE users
- ✅ Comprehensive API documentation
- ✅ Health monitoring and status endpoints

### Phase 7: Advanced Features (🔄 Current)
- ⏳ Web UI implementation (React/Vue frontend)
- ⏳ Advanced search and filtering
- ⏳ Bulk operations and import/export
- ⏳ Analytics and insights
- ⏳ API versioning and migration tools

---

## Success Metrics

### Technical Metrics
- **API Response Time**: < 200ms average
- **Memory Usage**: < 2GB RAM
- **Storage Efficiency**: < 1MB per 1000 memories
- **Uptime**: > 99.9%
- **Error Rate**: < 0.1%

### Feature Metrics
- **Project Creation**: Support 1000+ projects
- **Memory Storage**: 10M+ memories with fast retrieval
- **Vector Search**: < 100ms for similarity queries
- **Thinking Sequences**: Support complex multi-branch reasoning
- **Concurrent Users**: 100+ simultaneous sessions

### User Experience Metrics
- **API Usability**: Clear, consistent REST API design
- **Documentation Quality**: Complete API documentation
- **Setup Time**: < 5 minutes for Docker deployment
- **Data Integrity**: Zero data loss incidents
- **Development Velocity**: Enable faster AI system development

---

## Risk Assessment

### Technical Risks
- **Memory Consumption**: Large vector embeddings could exhaust RAM
  - *Mitigation*: Implement pagination, lazy loading, memory monitoring
- **Database Performance**: Complex queries could slow down responses
  - *Mitigation*: Proper indexing, query optimization, connection pooling
- **LLM Reliability**: Ollama service could become unavailable
  - *Mitigation*: Health checks, graceful degradation, retry logic

### Security Risks
- **Container Vulnerabilities**: Base image security issues
  - *Mitigation*: Regular security updates, minimal base image, security scanning
- **Data Exposure**: Cross-project data leakage
  - *Mitigation*: Strict project isolation, comprehensive testing, access controls

### Operational Risks
- **Resource Exhaustion**: Unbounded growth of stored data
  - *Mitigation*: Storage quotas, cleanup policies, monitoring
- **Migration Complexity**: Schema changes could break existing data
  - *Mitigation*: Database migrations, versioning, rollback procedures

---

## Appendices

### A. Database Migrations
[Detailed SQL migration scripts for schema setup and updates]

### B. API Reference
[Complete OpenAPI/Swagger specification]

### C. Deployment Guide
[Docker deployment instructions and configuration options]

### D. Development Setup
[Local development environment setup instructions]

---

**Document Control:**
- **Author**: Claude Code Assistant
- **Review**: Pending
- **Approval**: Pending
- **Next Review**: 2025-07-14