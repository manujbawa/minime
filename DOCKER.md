# MiniMe-MCP Docker Volume Setup

Similar to n8n, MiniMe-MCP uses Docker volumes for persistent data storage. All your memories, thinking sequences, and learned patterns are preserved across container restarts.

## Quick Start

### 1. Create and Run with Default Volume

```bash
# Create volume and run (similar to n8n)
docker volume create minime_data
docker run -it --rm --name minime-mcp -p 8000:8000 -v minime_data:/data minime-mcp:latest
```

### 2. Using the Convenience Script

```bash
# Simple run with default settings
./docker-run.sh run

# Custom volume name
./docker-run.sh run my_project_data

# Background mode with custom port
./docker-run.sh run --port 8080 -d

# Build and run
./docker-run.sh run --build
```

## Volume Contents

The `/data` volume contains:

```
/data/
├── postgres/          # PostgreSQL database files
│   ├── memories       # Your stored memories
│   ├── thinking_sequences  # Sequential reasoning data
│   └── meta_learning  # Cross-project patterns
├── ollama/           # Downloaded embedding models
│   └── models/       # Embedding model files
└── logs/             # Application logs
```

## Common Commands

### Volume Management
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect minime_data

# Backup volume to tar file
docker run --rm -v minime_data:/data -v $(pwd):/backup alpine tar czf /backup/minime-backup.tar.gz -C /data .

# Restore volume from tar file
docker run --rm -v minime_data:/data -v $(pwd):/backup alpine tar xzf /backup/minime-backup.tar.gz -C /data
```

### Container Management
```bash
# Check status
./docker-run.sh status

# View logs
./docker-run.sh logs

# Stop container
./docker-run.sh stop

# Open shell in container
./docker-run.sh shell
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | auto-generated | Database password |
| `MCP_PORT` | 8000 | HTTP server port |
| `LOG_LEVEL` | info | Logging level |
| `OLLAMA_HOST` | auto-detected | Ollama service URL |

## Custom Configuration

### Custom Database Password
```bash
docker run -it --rm --name minime-mcp \
  -p 8000:8000 \
  -v minime_data:/data \
  -e POSTGRES_PASSWORD=your_secure_password \
  minime-mcp:latest
```

### Different Port
```bash
docker run -it --rm --name minime-mcp \
  -p 9000:8000 \
  -v minime_data:/data \
  minime-mcp:latest
```

## Health Checks

The container includes automatic health monitoring:

```bash
# Check health via API
curl http://localhost:8000/health

# Docker health status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Data Persistence

**✅ All data persists across container restarts**
- Your memories and thinking sequences
- Downloaded embedding models  
- Learning patterns and insights
- Database and configuration

**🔄 Easy migration between environments**
- Export volume as backup
- Import on different machine
- Share volumes between team members

## Multiple Projects

You can run separate instances for different projects:

```bash
# Project A
docker volume create project_a_data
docker run -d --name minime-project-a -p 8000:8000 -v project_a_data:/data minime-mcp:latest

# Project B  
docker volume create project_b_data
docker run -d --name minime-project-b -p 8001:8000 -v project_b_data:/data minime-mcp:latest
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs minime-mcp

# Check volume permissions
docker run --rm -v minime_data:/data alpine ls -la /data
```

### Reset Everything
```bash
# WARNING: This deletes all data!
./docker-run.sh clean
```

### Database Issues
```bash
# Connect to container and check database
docker exec -it minime-mcp psql -U minime minime_memories
```

## API Access

Once running, access these endpoints:

- **Health Check**: `http://localhost:8000/health`
- **Project Management**: `http://localhost:8000/api/projects`
- **Memory Search**: `http://localhost:8000/api/projects/{name}/memories`
- **Thinking Sequences**: `http://localhost:8000/api/projects/{name}/thinking`
- **Analytics**: `http://localhost:8000/api/analytics`

## MCP Client Connection

For MCP clients (like Claude Desktop):

```json
{
  "mcpServers": {
    "minime": {
      "command": "docker",
      "args": ["exec", "-i", "minime-mcp", "node", "/app/src/server.js", "--stdio"],
      "env": {
        "MCP_STDIO": "true"
      }
    }
  }
}
```