# MiniMe-MCP User Guide

**Create Your Digital Developer Twin with AI-Powered Memory and Learning**

---

## 🎯 What is MiniMe-MCP?

MiniMe-MCP is a Model Context Protocol (MCP) server that creates a persistent, intelligent memory system for developers and AI assistants. Think of it as your **digital twin** that learns your coding patterns, remembers project decisions, and helps you think through complex problems systematically.

### The Problem It Solves

- **Lost Context**: Conversations with AI assistants start fresh every time
- **Forgotten Decisions**: Why did we choose this architecture 6 months ago?
- **Repeated Mistakes**: Making the same errors across different projects
- **Fragmented Learning**: Insights scattered across projects and time
- **Complex Reasoning**: Need to work through multi-step problems systematically

### The Solution

MiniMe-MCP creates a **persistent knowledge base** that:
- 📚 **Remembers everything**: Code decisions, bugs, insights, patterns
- 🧠 **Learns across projects**: Patterns and insights transfer between work
- 🔍 **Enables smart search**: Vector-based semantic search through your history
- 💭 **Structures thinking**: Step-by-step reasoning with branching and revisions
- 🤖 **Integrates with AI**: Works seamlessly with Claude, GPT, and other assistants

---

## 🚀 Key Features

### 1. **Multi-Project Memory System**
- **Project Isolation**: Each project has its own secure workspace
- **Contextual Storage**: Store memories with full context and metadata
- **Vector Search**: Semantic search across all your memories using embeddings
- **Memory Types**: Code, decisions, insights, bugs, general notes, and more

### 2. **Sequential Thinking Framework**
- **Structured Reasoning**: Break complex problems into numbered thoughts
- **Branching Logic**: Explore alternative approaches
- **Confidence Tracking**: Rate your certainty on each thought
- **Thought Types**: Analysis, hypothesis, decision, action, reflection
- **Revision System**: Update thoughts as understanding evolves

### 3. **Meta-Learning & Pattern Detection**
- **Pattern Recognition**: Automatically detect coding patterns across projects
- **Insight Generation**: Learn from past decisions and their outcomes
- **Cross-Project Learning**: Apply learnings from one project to another
- **Evolution Tracking**: See how your patterns and preferences change over time

### 4. **AI Assistant Integration**
- **MCP Protocol**: Native integration with Claude Desktop and other MCP clients
- **Tool Discovery**: AI assistants can explore your memory and thinking tools
- **Context Persistence**: Conversations build on previous knowledge
- **Smart Suggestions**: AI can reference your past decisions and patterns

### 5. **Web UI Dashboard** 🆕
- **Visual Exploration**: Browse projects, memories, and thinking sequences in a web interface
- **Interactive Search**: Semantic search with filtering and similarity exploration
- **Thinking Visualizer**: Flow diagrams showing thought progression and branches
- **Analytics Dashboard**: Charts and metrics showing usage patterns and growth
- **No IDE Required**: Access your knowledge base from any browser

---

## 🛠 Available MCP Tools

When connected to an MCP client (like Claude Desktop), you get access to these tools:

### Memory Management
- **`store_memory`**: Save important information with context and metadata
- **`search_memories`**: Find relevant memories using semantic search

### Project Management  
- **`get_projects`**: List all your projects and their statistics
- **`get_project_sessions`**: View work sessions within a project

### Sequential Thinking
- **`start_thinking_sequence`**: Begin a structured reasoning session
- **`add_thought`**: Add numbered thoughts with confidence and type
- **`get_thinking_sequence`**: Retrieve a complete thought sequence
- **`list_thinking_sequences`**: Browse all thinking sessions
- **`complete_thinking_sequence`**: Mark reasoning as complete

### Learning & Insights
- **`get_insights`**: Retrieve cross-project learnings and patterns
- **`get_coding_patterns`**: Explore detected coding patterns and practices

---

## 📋 Use Case Examples

### 1. **Code Review Documentation**
```
You: "I just completed a code review for our new API endpoint. Let me store the key insights."

Claude: I'll help you store that code review. Let me use the store_memory tool.

[Stores memory with details about API design decisions, security considerations, and performance optimizations]
```

### 2. **Bug Investigation with Structured Thinking**
```
You: "I need to investigate this complex database performance issue. Can you help me think through it systematically?"

Claude: I'll start a thinking sequence to help you work through this methodically.

[Claude uses MCP tools to create:]
- Thought 1 (Analysis): "Looking at ProfileService.js:45, the query lacks proper indexing"
- Thought 2 (Hypothesis): "ILIKE operator prevents index usage on email_idx"  
- Thought 3 (Action): "Test with exact match query and check execution plan"
- Thought 4 (Decision): "Implement GIN index for case-insensitive searches"

[Each thought is stored with code context and can be referenced later]
```

### 3. **Team Onboarding**
```
You: "Search for all our architectural decisions about microservices from the last 6 months."

Claude: [Searches memories and returns relevant decisions, patterns, and lessons learned about microservice architecture]
```

### 4. **Cross-Project Learning**
```
You: "What patterns have I used for error handling across different projects?"

Claude: [Analyzes coding patterns and shows evolution of error handling approaches, successful patterns, and recommendations]
```

---

## 💬 Example Questions to Ask

### Memory & Context
- "Store this code review decision about using Redis for caching"
- "What were our concerns about the previous authentication system?"
- "Search for any memories about React performance optimization"
- "Find discussions about database indexing strategies"

### Sequential Thinking
- "Help me think through this system architecture decision step by step"
- "I need to debug this complex race condition - let's work through it systematically"
- "Walk me through the pros and cons of different deployment strategies"
- "Help me analyze the root cause of this production incident"

### Pattern Recognition
- "What coding patterns do I use most frequently?"
- "How has my approach to API design evolved over time?"
- "What are the common mistakes I make in React components?"
- "Show me successful patterns for handling async operations"

### Project Insights
- "What did we learn from the last migration project?"
- "Compare the tech stack decisions across my recent projects"
- "What are the recurring themes in my bug reports?"
- "How do our current practices compare to 6 months ago?"

---

## 🔌 IDE Integration

### Cursor IDE Integration

1. **Configure MCP Connection (HTTP - Recommended)**
   ```json
   // In Cursor settings (claude_desktop_config.json)
   {
     "mcpServers": {
       "minime": {
         "transport": {
           "type": "sse",
           "url": "http://localhost:8000/mcp/sse"
         }
       }
     }
   }
   ```

   **Alternative: stdio (Legacy)**
   ```json
   {
     "mcpServers": {
       "minime": {
         "command": "docker",
         "args": ["exec", "-i", "minime-mcp", "node", "/app/src/server.js", "--stdio"]
       }
     }
   }
   ```

2. **How It Works in Cursor**
   - You chat with Claude while working on code
   - Claude has access to your current file context AND MCP tools
   - When you ask for structured thinking, Claude uses MCP tools to create/store thoughts
   - Each thought can reference specific code lines, files, or selections
   - The thinking process is preserved for future sessions

3. **Benefits in Cursor**
   - 📝 **Persistent Context**: Claude remembers previous conversations and decisions
   - 🔍 **Smart Code Review**: Reference past architectural decisions
   - 💡 **Pattern Suggestions**: Get recommendations based on your coding history
   - 🧠 **Structured Problem-Solving**: Work through complex issues step-by-step

### VS Code Integration

1. **Install MCP Extension** (when available)
2. **Configure Connection (HTTP - Recommended)**
   ```json
   // In VS Code settings  
   {
     "mcp.servers": {
       "minime": {
         "transport": {
           "type": "sse",
           "url": "http://localhost:8000/mcp/sse"
         }
       }
     }
   }
   ```

   **Alternative: stdio (Legacy)**
   ```json
   {
     "mcp.servers": {
       "minime": {
         "command": "docker exec -i minime-mcp node /app/src/server.js --stdio"
       }
     }
   }
   ```

3. **Benefits in VS Code**
   - 🔗 **Contextual AI**: AI assistants with access to project memory
   - 📊 **Pattern Insights**: View coding patterns directly in the editor
   - 🎯 **Focused Suggestions**: Recommendations based on your specific context

### **Practical Example: How Sequential Thinking Works**

```
1. You're in Cursor editing UserService.js
2. You select a problematic function and ask:
   "This function is causing performance issues. Help me debug it systematically."

3. Claude responds:
   "I'll create a thinking sequence to debug this systematically."
   
   [Uses start_thinking_sequence MCP tool]
   
4. Claude adds thoughts referencing your code:
   Thought 1 (Analysis): "Looking at UserService.js:67-89, the getUserProfile 
   function makes 3 separate database calls instead of using a JOIN."
   
   Thought 2 (Hypothesis): "The N+1 query problem is causing the performance issue.
   Each user lookup triggers additional queries for roles and preferences."
   
   Thought 3 (Action): "I should rewrite this to use a single query with JOINs."
   
   [Each thought stored via add_thought MCP tool]

5. Later sessions can reference this thinking:
   "What was my analysis of the UserService performance issue?"
   
   Claude: [Retrieves the thinking sequence and shows the systematic analysis]
```

**Key Point**: The IDE provides context, you initiate the structured thinking through conversation, and MCP stores the process for future reference.

### **HTTP vs stdio MCP Benefits**

#### **HTTP-based MCP (Recommended)**
- ✅ **Multiple Clients**: Several team members can connect simultaneously  
- ✅ **Network Access**: Access from different machines on the network
- ✅ **Easier Debugging**: Standard HTTP tools for monitoring and debugging
- ✅ **No Docker Dependency**: IDEs don't need Docker exec access
- ✅ **Load Balancing**: Can run multiple instances behind a load balancer
- ✅ **Web Integration**: Same server handles both MCP and web UI

#### **stdio-based MCP (Legacy)**
- ⚠️ **Single Client**: Only one IDE can connect at a time
- ⚠️ **Local Only**: Requires Docker exec access
- ⚠️ **Complex Setup**: IDEs need Docker integration
- ⚠️ **Debugging Difficult**: Less visibility into communication

---

## 🌐 Web UI Dashboard

In addition to IDE integration, MiniMe-MCP includes a **comprehensive web interface** hosted on the same container for visual exploration of your data.

### **Access the Web UI**
```bash
# After starting the container
./docker-run.sh run

# Open in browser
http://localhost:8000
```

### **Web UI Features**

#### **📊 Main Dashboard**
- **Project Overview**: Visual cards showing memory counts, recent activity, health status
- **Quick Actions**: Create projects, start thinking sequences, search memories
- **System Health**: Real-time status of all services and embedding models
- **Recent Activity**: Timeline of latest memories and thinking sequences

#### **🔍 Memory Explorer**
- **Semantic Search**: Find memories using natural language queries
- **Advanced Filters**: Filter by project, type, date, importance, confidence
- **Similarity Browser**: Discover related memories using vector embeddings
- **Timeline View**: Chronological exploration of your knowledge evolution

#### **💭 Thinking Sequence Visualizer**
- **Interactive Flow Diagrams**: Visual representation of thought progression
- **Branch Explorer**: See alternative reasoning paths and confidence levels
- **Thought Details**: Expand any thought to see full context and reasoning
- **Export Options**: Save thinking sequences as Markdown, JSON, or visual diagrams

#### **📈 Analytics Dashboard**
- **Usage Metrics**: Memory creation, thinking sessions, search patterns
- **Growth Charts**: Knowledge accumulation over time
- **Pattern Analysis**: Most common memory types, thinking patterns
- **Cross-Project Insights**: Connections and learnings between projects

#### **⚙️ Project Management**
- **Project Details**: Deep dive into individual projects with statistics
- **Session Browser**: Explore work sessions and their associated memories
- **Bulk Operations**: Export, backup, or reorganize project data
- **Settings**: Configure embedding models, search preferences

### **Benefits of Web UI**

#### **Visual Exploration**
- 👁️ **See patterns** in your thinking and coding over time
- 🕸️ **Visualize connections** between related concepts and memories
- 📊 **Track progress** on complex reasoning tasks with charts
- 🎯 **Discover insights** through interactive data exploration

#### **Better Understanding**
- 📅 **Timeline views** show how ideas and patterns evolved
- 🔗 **Similarity maps** reveal unexpected connections between memories
- 📈 **Analytics charts** highlight usage patterns and growth trends
- 📤 **Export capabilities** for sharing and documentation

#### **Improved Workflow**
- 🌐 **Browser access** from any device, no IDE required
- 📱 **Mobile friendly** for reviewing memories and thinking on-the-go
- 🔗 **Sharable links** for team collaboration and knowledge sharing
- 🎨 **Rich visualizations** for presentations and documentation

### **Example Web UI Workflows**

#### **1. Exploring Memory Connections**
```
1. Open Memory Explorer → Search "authentication"
2. Browse results → Click on "JWT implementation decision"
3. View Similar Memories → Discover related security patterns
4. Explore Timeline → See how authentication approach evolved
5. Export Insights → Create documentation for team
```

#### **2. Analyzing Thinking Patterns**
```
1. Open Analytics Dashboard → View thinking sequence metrics
2. Click on "API Design" thinking sequence
3. Visualize Flow → See decision points and alternatives
4. Compare Confidence → Identify areas of uncertainty
5. Export Diagram → Share reasoning with stakeholders
```

#### **3. Cross-Project Learning**
```
1. Dashboard → Project Overview → Compare project statistics
2. Search across all projects → "error handling patterns"
3. Analyze Results → See evolution across different codebases
4. Create New Memory → Document best practices learned
5. Apply Insights → Reference in future decision-making
```

---

## ⚙️ Configuration & Setup

### System Requirements

- **Docker**: Version 20.0+ with Docker Compose
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 2GB for system, additional space for embeddings and memories
- **CPU**: 2+ cores recommended for embedding processing
- **OS**: Linux, macOS, or Windows with WSL2

### Quick Start

1. **Clone and Build**
   ```bash
   git clone <repository>
   cd MiniMe-MCP
   ./docker-run.sh build
   ```

2. **Run with Persistent Storage**
   ```bash
   # Create volume (like n8n)
   docker volume create minime_data
   
   # Run container
   ./docker-run.sh run
   
   # Or custom volume
   ./docker-run.sh run my_project_data
   ```

3. **Verify Installation**
   ```bash
   curl http://localhost:8000/health
   
   # Or open web UI in browser
   open http://localhost:8000
   ```

### Configuration Options

#### Environment Variables
```bash
# Database
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://user:pass@host:port/db

# Embedding Models
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY=your_api_key

# Server
MCP_PORT=8000
LOG_LEVEL=info
NODE_ENV=production
```

#### Volume Structure
```
/data/
├── postgres/          # PostgreSQL database files
│   ├── memories       # Your stored memories
│   ├── thinking_sequences  # Sequential reasoning data
│   └── meta_learning  # Cross-project patterns
├── ollama/           # Downloaded embedding models
│   └── models/       # Embedding model files (274MB+)
└── logs/             # Application logs
```

### Docker Management

```bash
# Basic operations
./docker-run.sh run          # Start with default volume
./docker-run.sh stop         # Stop container
./docker-run.sh logs         # View logs
./docker-run.sh status       # Check system status

# Advanced options
./docker-run.sh run --port 8080 -d    # Background mode, custom port
./docker-run.sh run --password mypass # Custom password
./docker-run.sh shell                 # Open shell in container
./docker-run.sh clean                 # Remove everything (⚠️ deletes data)
```

---

## 🏗 Architecture Overview

### Core Components

1. **Database Layer** (PostgreSQL + pgvector)
   - Project and session management
   - Memory storage with vector embeddings
   - Sequential thinking sequences
   - Meta-learning pattern detection

2. **Embedding Service** (Ollama/OpenAI)
   - Converts text to vector embeddings
   - Semantic similarity search
   - Model management and caching

3. **Learning Pipeline**
   - Pattern detection across projects
   - Insight generation and evolution
   - Cross-project knowledge transfer

4. **MCP Tools Service**
   - Tool discovery and execution
   - Integration with AI assistants
   - Contextual memory access

### Technology Stack

- **Backend**: Node.js 20 with Express
- **Database**: PostgreSQL 15 with pgvector extension
- **Embeddings**: Ollama (local) or OpenAI (cloud)
- **Containerization**: Docker with multi-stage builds
- **Protocol**: Model Context Protocol (MCP)

### Security Features

- 🔒 **Project Isolation**: Each project has secure workspace
- 👤 **Non-root Container**: Runs as unprivileged user
- 🛡️ **Input Validation**: All inputs sanitized and validated
- 🔐 **Environment Variables**: Secrets managed via environment
- 📦 **Container Security**: Minimal attack surface with Debian slim

---

## 📊 API Endpoints

### Health & Status
- `GET /health` - System health check with service status
- `GET /mcp/status` - MCP-specific status and tool count

### MCP Protocol (HTTP)
- `GET /mcp/sse` - MCP Server-Sent Events endpoint for real-time communication
- `POST /mcp/messages` - MCP message posting endpoint

### Project Management
- `GET /api/projects` - List all projects with statistics
- `POST /api/projects` - Create new project
- `GET /api/projects/{name}` - Get specific project details
- `GET /api/projects/{name}/sessions` - List project sessions

### Memory Management
- `GET /api/projects/{name}/memories` - Search and list memories
- `POST /api/memories` - Store new memory (via MCP tools)

### Sequential Thinking
- `GET /api/projects/{name}/thinking` - List thinking sequences
- `GET /api/thinking/{id}` - Get specific thinking sequence

### Embedding Services
- `GET /api/embeddings/models` - List available embedding models
- `POST /api/embeddings/generate` - Generate embeddings for text
- `POST /api/embeddings/similarity` - Calculate text similarity

### Analytics
- `GET /api/analytics` - System-wide analytics and insights

---

## 🎓 Advanced Features

### Pattern Detection Categories

The system automatically detects 25+ categories of patterns:

**Architectural Patterns**
- Component structure, module organization, dependency management
- State management, data flow, communication patterns

**Code Quality Patterns**  
- Error handling, input validation, logging practices
- Testing approaches, documentation standards

**Performance Patterns**
- Optimization techniques, caching strategies, async patterns
- Memory management, resource usage

**Security Patterns**
- Authentication, authorization, input sanitization
- Secrets management, secure communication

### Embedding Models

**Local Models (Ollama)**
- `nomic-embed-text` - Fast, efficient, privacy-focused
- `all-minilm` - Lightweight alternative
- `mxbai-embed-large` - High-quality embeddings

**Cloud Models (OpenAI)**
- `text-embedding-3-small` - Cost-effective
- `text-embedding-3-large` - Highest quality

### Memory Types

- **`code`** - Code snippets, functions, algorithms
- **`decision`** - Architectural and design decisions
- **`insight`** - Learnings and revelations
- **`bug`** - Bug reports and debugging information
- **`general`** - General notes and observations
- **`meeting`** - Meeting notes and discussions
- **`documentation`** - Documentation and guides

### Thought Types

- **`analysis`** - Breaking down problems
- **`hypothesis`** - Proposed explanations or solutions
- **`decision`** - Choices made during reasoning
- **`action`** - Steps taken or planned
- **`reflection`** - Looking back on thoughts or outcomes

---

## 🔧 Troubleshooting

### Common Issues

**Container Won't Start**
```bash
# Check logs
docker logs minime-mcp

# Verify volume permissions
docker run --rm -v minime_data:/data alpine ls -la /data
```

**Database Connection Issues**
```bash
# Check PostgreSQL in container
docker exec -it minime-mcp psql -U minime minime_memories

# Verify environment variables
docker exec -it minime-mcp env | grep POSTGRES
```

**Embedding Service Degraded**
- Ensure Ollama models are downloaded
- Check model availability in database
- Verify OLLAMA_HOST configuration

**MCP Connection Problems**
- Verify Docker container is running
- Check port 8000 is accessible
- Ensure MCP client configuration is correct

### Performance Optimization

**Embedding Performance**
- Use local Ollama models for privacy and speed
- Implement embedding caching for frequently-used text
- Consider model size vs. quality trade-offs

**Database Performance**
- Regular VACUUM and ANALYZE operations
- Monitor pgvector index performance
- Optimize query patterns for large memory sets

**Memory Usage**
- Configure PostgreSQL shared_buffers appropriately
- Monitor Ollama model memory usage
- Set appropriate container memory limits

---

## 🤝 Contributing & Support

### Getting Help

- **Health Check**: `curl http://localhost:8000/health`
- **Logs**: `./docker-run.sh logs`
- **System Status**: `./docker-run.sh status`

### Backup & Recovery

**Backup Volume**
```bash
docker run --rm -v minime_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minime-backup.tar.gz -C /data .
```

**Restore Volume**
```bash
docker run --rm -v minime_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/minime-backup.tar.gz -C /data
```

### Data Export

**Export Memories**
```bash
docker exec minime-mcp psql -U minime minime_memories -c \
  "COPY memories TO STDOUT WITH CSV HEADER" > memories.csv
```

**Export Thinking Sequences**
```bash
docker exec minime-mcp psql -U minime minime_memories -c \
  "COPY thinking_sequences TO STDOUT WITH CSV HEADER" > thinking.csv
```

---

## 🌟 Get Started Today

1. **Install and Run**
   ```bash
   ./docker-run.sh run
   ```

2. **Configure Your IDE**
   - Add MCP connection to Cursor or VS Code
   - Start chatting with context-aware AI

3. **Begin Learning**
   - Store your first memory
   - Start a thinking sequence
   - Explore detected patterns

4. **Scale Your Knowledge**
   - Add multiple projects
   - Build cross-project insights
   - Develop your digital twin

**MiniMe-MCP transforms how you work with AI assistants - from forgetful conversations to persistent, intelligent collaboration.**

---

*Ready to create your digital twin? Start with `./docker-run.sh run` and begin building your persistent AI-powered memory system today!*