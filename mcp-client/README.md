# MiniMe MCP Client

MCP stdio client for connecting Cursor/VS Code to MiniMe AI Memory Server.

## Installation

```bash
npm install -g @minimemcp/mcp-client
```

## Quick Start

### 1. Run MiniMe Server

```bash
docker run -d --name minimemcp -p 8000:8000 -p 9000:9000 manujbawa/minimemcp:latest
```

### 2. Configure Cursor

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

### 3. Available Tools

- **store_memory**: Save important information
- **search_memories**: Find relevant memories
- **get_learning_insights**: Discover patterns
- **create_tasks**: Convert requirements to tasks
- **sequential_thinking**: Complex reasoning workflows
- **And more...**

## Troubleshooting

```bash
# Check if server is running
docker ps -f name=minimemcp

# Test connection
MINIME_SERVER_URL=http://localhost:8000 minime-mcp

# Enable debug mode in Cursor config
"MINIME_DEBUG": "true"
```

## License

MIT