# MiniMe-MCP API Documentation

**Version:** 0.1.0  
**Transport:** Streamable HTTP (MCP SDK 1.12.3)  
**Protocol:** Model Context Protocol  
**Date:** 2025-06-14

---

## 🚀 Quick Start

### Base URL
```
http://localhost:8000
```

### MCP Endpoint
```
http://localhost:8000/mcp
```

### Authentication
No authentication required for local development. Session management is handled automatically via UUID-based session IDs.

---

## 📡 MCP Protocol (Streamable HTTP)

### Transport Features
- ✅ **Session Management**: Automatic UUID session tracking
- ✅ **Resumability**: Client can reconnect and replay events
- ✅ **Unified Endpoint**: Single `/mcp` handles GET/POST/DELETE
- ✅ **Error Handling**: Proper HTTP status codes and JSON-RPC errors
- ✅ **Content Negotiation**: JSON and SSE stream support

### Session Lifecycle

#### 1. Initialize Session
```http
POST /mcp
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {}
    }
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "MiniMe-MCP",
      "version": "0.1.0"
    }
  },
  "id": 1
}
```

#### 2. Tool Discovery
```http
POST /mcp
Content-Type: application/json
X-Session-ID: <session-uuid>

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "store_memory",
        "description": "Store a new memory with automatic embedding generation",
        "inputSchema": {
          "type": "object",
          "properties": {
            "content": { "type": "string" },
            "project_name": { "type": "string" },
            "memory_type": { "type": "string" }
          },
          "required": ["content", "project_name"]
        }
      }
    ]
  },
  "id": 2
}
```

#### 3. Execute Tool
```http
POST /mcp
Content-Type: application/json
X-Session-ID: <session-uuid>

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "store_memory",
    "arguments": {
      "content": "Discovered that React useEffect cleanup prevents memory leaks in our dashboard components",
      "project_name": "web-dashboard",
      "memory_type": "insight",
      "importance": 8
    }
  },
  "id": 3
}
```

#### 4. Terminate Session
```http
DELETE /mcp
X-Session-ID: <session-uuid>
```

### Available MCP Tools

| Tool Name | Description | Input Schema |
|-----------|-------------|--------------|
| `store_memory` | Store memory with embedding | `{content, project_name, memory_type?, importance?, tags?}` |
| `search_memories` | Semantic memory search | `{query, project_name?, limit?, memory_type?}` |
| `get_projects` | List all projects | `{include_stats?}` |
| `get_project_sessions` | Get project sessions | `{project_name, active_only?}` |
| `start_thinking_sequence` | Begin structured reasoning | `{project_name, session_name?, description?}` |
| `add_thought` | Add thought to sequence | `{sequence_id, content, thought_type?, confidence?}` |
| `get_thinking_sequence` | Retrieve thinking sequence | `{sequence_id, format?, include_branches?}` |
| `list_thinking_sequences` | List thinking sequences | `{project_name?, include_completed?}` |
| `complete_thinking_sequence` | Complete reasoning | `{sequence_id, summary?}` |
| `get_insights` | Retrieve meta-learning insights | `{project_name?, timeframe?}` |
| `get_coding_patterns` | Get detected patterns | `{project_name?, pattern_type?}` |

---

## 🏥 Health & Status Endpoints

### System Health
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "phase": "Complete System - Memory + Sequential Thinking + Meta-Learning",
  "services": {
    "database": "healthy",
    "embeddings": "healthy",
    "sequentialThinking": "active",
    "metaLearning": "active",
    "defaultEmbeddingModel": "nomic-embed-text",
    "availableEmbeddingModels": 1
  },
  "statistics": {
    "database": {
      "projects": 1,
      "memories": {
        "total_memories": "156",
        "memories_with_embeddings": "156",
        "avg_importance": 7.2,
        "unique_memory_types": "5"
      }
    }
  },
  "capabilities": {
    "memoryManagement": true,
    "sequentialThinking": true,
    "metaLearning": true,
    "patternDetection": true,
    "crossProjectInsights": true,
    "vectorSimilarity": true
  },
  "timestamp": "2025-06-14T22:30:00.000Z"
}
```

### MCP Status
```http
GET /mcp/status
```

**Response:**
```json
{
  "message": "MCP server ready with Streamable HTTP transport",
  "version": "0.1.0",
  "transport": {
    "type": "Streamable HTTP",
    "endpoint": "/mcp",
    "features": ["session_management", "resumability", "unified_get_post"]
  },
  "capabilities": {
    "tools": {
      "count": 11,
      "available": [
        {"name": "store_memory", "description": "Store a new memory..."},
        {"name": "search_memories", "description": "Search for memories..."}
      ]
    }
  },
  "services": {
    "embeddings": "available",
    "learning": "active",
    "sequentialThinking": "active",
    "projectManagement": "active"
  }
}
```

---

## 📁 Project Management API

### List Projects
```http
GET /api/projects?stats=true
```

### Create Project
```http
POST /api/projects
Content-Type: application/json

{
  "name": "web-dashboard",
  "description": "React-based analytics dashboard",
  "settings": {
    "default_memory_type": "code",
    "auto_embedding": true
  }
}
```

### Get Project Details
```http
GET /api/projects/web-dashboard
```

### List Project Sessions
```http
GET /api/projects/web-dashboard/sessions?active=false
```

---

## 🧠 Memory Management API

### List Memories
```http
GET /api/projects/web-dashboard/memories?limit=20&memory_type=insight
```

### Search Memories (REST)
```http
GET /api/projects/web-dashboard/memories?q=React performance&limit=10
```

---

## 💭 Sequential Thinking API

### List Thinking Sequences
```http
GET /api/projects/web-dashboard/thinking?completed=true
```

### Get Thinking Sequence
```http
GET /api/thinking/123?format=detailed&branches=true
```

---

## 🧬 Embedding Services API

### List Available Models
```http
GET /api/embeddings/models
```

**Response:**
```json
{
  "models": [
    {
      "model_name": "nomic-embed-text",
      "provider": "ollama",
      "dimensions": 768,
      "is_default": true,
      "status": "active"
    }
  ],
  "count": 1
}
```

### Generate Embedding
```http
POST /api/embeddings/generate
Content-Type: application/json

{
  "text": "React useEffect cleanup prevents memory leaks",
  "model": "nomic-embed-text"
}
```

### Calculate Similarity
```http
POST /api/embeddings/similarity
Content-Type: application/json

{
  "textA": "React hooks for state management",
  "textB": "useState and useEffect in React",
  "model": "nomic-embed-text"
}
```

---

## 📊 Analytics API

### System Analytics
```http
GET /api/analytics?timeframe=30+days&project_name=web-dashboard
```

**Response:**
```json
{
  "database": {
    "projects": 3,
    "total_memories": 245,
    "avg_importance": 7.1
  },
  "thinking": {
    "total_sequences": 12,
    "completed_sequences": 10,
    "avg_confidence": 82.5,
    "completion_rate": 83.3
  },
  "timeframe": "30 days",
  "project": "web-dashboard"
}
```

---

## ❌ Error Handling

### HTTP Status Codes
- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request format
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate name)
- `410 Gone` - Deprecated endpoint (SSE transport)
- `500 Internal Server Error` - Server error

### JSON-RPC Error Codes
- `-32000` - Server error (transport-related)
- `-32001` - Invalid session
- `-32002` - Method not found
- `-32600` - Invalid request
- `-32700` - Parse error

### Error Response Format
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Bad Request: Server not initialized",
    "data": {
      "details": "Session must be initialized before sending requests"
    }
  },
  "id": null
}
```

---

## 🔧 Migration from SSE

### Legacy Endpoints (Deprecated)
```http
GET /mcp/sse  # Returns 410 Gone with migration info
```

### Migration Steps
1. Update client configuration from `"type": "sse"` to `"type": "streamableHttp"`
2. Change URL from `/mcp/sse` to `/mcp`
3. Add required headers for content negotiation
4. Handle session management (automatic with new transport)

---

## 📝 Examples

### Complete MCP Session Example
```javascript
// 1. Initialize session
const initResponse = await fetch('/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { roots: {} }
    },
    id: 1
  })
});

// 2. Store a memory
const storeResponse = await fetch('/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-ID': sessionId
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'store_memory',
      arguments: {
        content: 'React performance optimization using useMemo',
        project_name: 'web-app',
        memory_type: 'insight',
        importance: 8
      }
    },
    id: 2
  })
});

// 3. Search memories
const searchResponse = await fetch('/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-ID': sessionId
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'search_memories',
      arguments: {
        query: 'React performance',
        project_name: 'web-app',
        limit: 5
      }
    },
    id: 3
  })
});
```

---

## 🛡️ Security Considerations

- No authentication required for local development
- All endpoints run on localhost only
- Project isolation prevents cross-project data leakage
- Session IDs are cryptographically secure UUIDs
- Input validation on all endpoints
- Rate limiting on embedding generation
- Container runs as non-root user (1000:1000)

---

## 📚 Additional Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Streamable HTTP Transport](https://docs.anthropic.com/en/docs/build-with-claude/mcp)
- [UserGuide.md](./UserGuide.md) - Complete user documentation
- [PRD.md](./PRD.md) - Product requirements and architecture
- [ui-design.md](./ui-design.md) - Web UI specifications

---

*Last updated: 2025-06-14 with MCP SDK 1.12.3 and Streamable HTTP transport*