# MiniMe-MCP Docker Setup

⚠️ **IMPORTANT**: This system now uses a **single container architecture** with all services bundled together for simplicity.

## 🚀 Quick Start

### Single Container Setup (Recommended)

```bash
# Build and start everything
make all

# Check status
make status

# Access the system
curl http://localhost:8000/health
```

For advanced Docker operations, see build/ directory.

### 2. Using the Convenience Script

```bash
# Start all services
./docker-run.sh up -d

# Custom port
./docker-run.sh up --port 8080 -d

# Build and start
./docker-run.sh up --build -d

# Check status
./docker-run.sh status
```

### 3. Using Make (Easiest)

```bash
cd build
make up      # Start all services
make status  # Check status  
make logs    # View logs
make down    # Stop all services
```

## 🏗️ Service Architecture

**Critical: Services start in dependency order**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │ -> │     Ollama      │ -> │   MCP Server    │
│   (Database)    │    │  (Embeddings)   │    │  (Node.js App)  │
│ Port: 5432      │    │ Port: 11434     │    │ Port: 8000      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Data Persistence

Data is stored in **named Docker volumes**:

```
postgres-data/        # PostgreSQL database files
├── memories          # Your stored memories
├── thinking_sequences # Sequential reasoning data
└── meta_learning     # Cross-project patterns

ollama-data/          # Downloaded embedding models
└── models/           # Embedding model files

app-logs/             # Application logs
```

## 🔧 Service Management

### Service Control
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart minime-mcp

# View service status
docker-compose ps
```

### Volume Management
```bash
# List volumes
docker volume ls | grep minime

# Backup PostgreSQL data
docker-compose exec postgres pg_dump -U minime minime_memories > backup.sql

# Backup all volumes
docker run --rm -v postgres-data:/postgres -v ollama-data:/ollama -v $(pwd):/backup alpine tar czf /backup/minime-backup.tar.gz postgres ollama
```

### Service Logs and Access
```bash
# View all logs
docker-compose logs -f

# Service-specific logs
docker-compose logs -f minime-mcp
docker-compose logs -f postgres
docker-compose logs -f ollama

# Shell access
docker-compose exec minime-mcp /bin/sh
docker-compose exec postgres psql -U minime -d minime_memories
```

## 🌍 Environment Configuration

Create `build/.env` from template:

```bash
cp build/.env.template build/.env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | minime_secure_password | Database password |
| `MCP_PORT` | 8000 | HTTP server port |
| `LOG_LEVEL` | info | Logging level |
| `WAIT_FOR_SERVICES` | true | Wait for dependencies |
| `STARTUP_DELAY` | 10 | Additional startup delay (seconds) |

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

## 🏥 Health Monitoring

**All services have health checks with proper dependencies:**

```bash
# Check all service health
make health
# or
docker-compose ps

# Individual health checks
curl http://localhost:8000/health          # MCP Server
curl http://localhost:11434/api/version    # Ollama
docker-compose exec postgres pg_isready -U minime  # PostgreSQL
```

### Startup Sequence Monitoring

```bash
# Watch startup progress
docker-compose logs -f

# Check if all dependencies are ready
docker-compose ps | grep healthy
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

## 🚀 Multiple Instances

Run separate instances for different projects:

```bash
# Project A (default port 8000)
cp build/.env build/.env.project-a
export COMPOSE_PROJECT_NAME=minime-project-a
export MCP_PORT=8000
docker-compose up -d

# Project B (port 8001)
cp build/.env build/.env.project-b
sed -i 's/MCP_PORT=8000/MCP_PORT=8001/' build/.env.project-b
export COMPOSE_PROJECT_NAME=minime-project-b
export MCP_PORT=8001
docker-compose --env-file build/.env.project-b up -d
```

## 🛠️ Troubleshooting

### Services Won't Start
```bash
# Check service dependencies
docker-compose ps
docker-compose logs postgres
docker-compose logs ollama

# Restart in dependency order
docker-compose restart postgres
docker-compose restart ollama  
docker-compose restart minime-mcp
```

### Database Connection Issues  
```bash
# Test database connectivity
docker-compose exec postgres pg_isready -U minime

# Check database logs
docker-compose logs postgres

# Connect directly
docker-compose exec postgres psql -U minime -d minime_memories
```

### Reset Everything
```bash
# WARNING: Deletes all data!
make clean
# or
docker-compose down -v --remove-orphans
```

## 🌐 API Access

Once all services are healthy, access these endpoints:

- **Health Check**: `http://localhost:8000/health`
- **MCP Status**: `http://localhost:8000/mcp/status`
- **Project Management**: `http://localhost:8000/api/projects`
- **Memory Search**: `http://localhost:8000/api/projects/{name}/memories`
- **Thinking Sequences**: `http://localhost:8000/api/projects/{name}/thinking`
- **Analytics**: `http://localhost:8000/api/analytics`
- **Web UI**: `http://localhost:8000/ui`

**Service Endpoints:**
- **PostgreSQL**: `localhost:5432` (if exposed)
- **Ollama API**: `http://localhost:11434/api/version`

## 🔌 MCP Client Connection

### For MCP clients (like Claude Desktop):

```json
{
  "mcpServers": {
    "minime": {
      "command": "docker",
      "args": ["exec", "-i", "minime-mcp", "node", "/app/src/mcp-stdio.js"],
      "env": {
        "DATABASE_URL": "postgresql://minime:password@postgres:5432/minime_memories",
        "OLLAMA_HOST": "http://ollama:11434"
      }
    }
  }
}
```

### Important Notes:
- **Database must be running** before MCP client connects
- Use `docker-compose ps` to verify all services are healthy
- MCP server will wait for dependencies automatically

## 📋 Quick Reference

```bash
# Start everything
cd build && make up

# Check status
make status

# View logs
make logs-mcp

# Stop everything  
make down

# Emergency reset
make clean
```