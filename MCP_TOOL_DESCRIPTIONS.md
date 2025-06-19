# MiniMe-MCP Tool Descriptions for IDE Agents

## 🎯 IDE Agent Decision Guide

This document provides comprehensive guidance for IDE agents on when and how to use each MCP tool effectively. Each tool includes clear trigger patterns, use cases, and practical examples.

## 🧠 Core Memory & Knowledge Tools

### 1. `store_memory`
**Purpose**: Store development information, code insights, decisions, and project context with AI-powered understanding.

**When to Use**:
- User mentions starting/working on something: 'building', 'implementing', 'working on'
- User describes a solution/fix: 'fixed bug', 'solved issue', 'found solution'
- User learns something: 'learned that', 'discovered', 'figured out'
- User makes decisions: 'decided to use', 'chose', 'going with'
- User documents progress: 'completed', 'deployed', 'finished'
- User shares insights: 'tip:', 'note:', 'important:'

**Critical**: Use `memory_type='task'` for actionable items that need completion tracking

**Examples**:
```
User: "Fixed the JWT refresh token issue by adding expiry validation"
→ store_memory(content="Fixed JWT refresh token bug...", memory_type="bug", project_name="auth-service")

User: "Need to implement rate limiting for the API endpoints"
→ store_memory(content="Implement rate limiting...", memory_type="task", project_name="api")
```

### 2. `search_memories`
**Purpose**: Find solutions, patterns, and past decisions using AI-powered semantic search.

**When to Use**:
- User asks about past solutions: 'how did I', 'what did I use before', 'similar to'
- User needs examples: 'show me how I', 'find examples of', 'past implementations'
- User troubleshooting: 'have I seen this error', 'similar bug', 'how to fix'
- User wants patterns: 'best practices I used', 'approaches I tried', 'patterns for'
- User references history: 'remember when', 'previous project', 'last time'

**Examples**:
```
User: "How did I handle rate limiting in my previous APIs?"
→ search_memories(query="rate limiting API implementation", memory_type="code")

User: "I've seen this CORS error before, how did I fix it?"
→ search_memories(query="CORS error fix solution", memory_type="bug")
```

## 📋 Project Planning & Management Tools

### 3. `create_project_brief`
**Purpose**: Generate comprehensive project documentation with technical architecture and implementation strategy.

**When to Use**:
- User starts planning: 'plan this project', 'project brief', 'document project'
- User begins new work: 'new project', 'start project', 'planning phase'
- User needs structure: 'help me plan', 'organize this project', 'create outline'
- User wants documentation: 'project overview', 'technical spec', 'project requirements'
- User mentions 'planning mode': 'let's plan', 'planning session', 'strategy'

**Examples**:
```
User: "I want to build a React dashboard for analytics"
→ create_project_brief(project_name="analytics-dashboard", project_description="React-based analytics dashboard with real-time data visualization")

User: "Planning a Python FastAPI for user management"
→ create_project_brief(project_name="user-api", project_description="FastAPI backend for user authentication and management")
```

### 4. `create_tasks`
**Purpose**: Convert project requirements into structured, actionable tasks with automatic prioritization.

**When to Use**:
- User describes work to do: 'I need to', 'we should', 'let's implement', 'build'
- User wants task breakdown: 'break this down', 'what are the steps', 'create tasks'
- User mentions features: 'feature', 'functionality', 'capability', 'requirement'
- User planning work: 'planning mode', 'plan this out', 'organize work'
- User has requirements: 'requirements', 'specs', 'needs', 'must have'

**Examples**:
```
User: "I need to build a React dashboard with user authentication and data visualization"
→ create_tasks(project_name="dashboard", tasks=[
  {title: "Set up React project structure", category: "feature"},
  {title: "Implement user authentication", category: "feature"},
  {title: "Create data visualization components", category: "feature"}
])
```

### 4b. `update_task`
**Purpose**: Update task status and capture valuable learning data including time estimates, patterns used, and lessons learned.

**When to Use**:
- User completes/updates tasks: 'finished task', 'completed', 'working on', 'blocked'
- User reports task status: 'task is done', 'made progress on', 'stuck on'
- User mentions specific tasks: 'the authentication task', 'login feature task'
- User provides task updates: 'update:', 'status:', 'progress on'

**Critical**: Use the **memory ID** returned from `store_memory` or `create_tasks`, not the task title!

**Examples**:
```
User: "Completed the user authentication task"
→ update_task(task_id="123", status="completed", outcome={summary: "OAuth2 implementation finished"})

User: "I'm blocked on the database migration task"
→ update_task(task_id="456", status="blocked")
```

## 📊 Progress & Milestone Tracking

### 5. `store_progress`
**Purpose**: Record project milestones, version updates, and completion status with automatic versioning.

**When to Use**:
- User reports completion: 'completed', 'finished', 'done', 'shipped', 'delivered'
- User mentions deployment: 'deployed', 'released', 'launched', 'went live'
- User describes milestones: 'milestone', 'version', 'release', 'iteration'
- User updates status: 'progress update', 'status', 'where we are'
- User mentions percentage: '50% done', '75% complete', 'almost finished'

**Examples**:
```
User: "Completed the user authentication system with OAuth2 integration"
→ store_progress(project_name="app", progress_description="Completed OAuth2 authentication", milestone_type="feature", completion_percentage=60)

User: "Deployed v2.1.0 to production with the new dashboard features"
→ store_progress(project_name="dashboard", progress_description="Production deployment", version="2.1.0", milestone_type="deployment")
```

## 🧩 Thinking & Analysis Tools

### 6. `start_thinking_sequence`
**Purpose**: Break down complex technical problems into sequential, logical thought processes.

**When to Use**:
- User needs to think through complexity: 'think through', 'analyze', 'reason about'
- User faces difficult decisions: 'complex decision', 'not sure', 'need to decide'
- User wants structured approach: 'step by step', 'break down', 'systematic'
- User doing architecture work: 'design', 'architect', 'structure'
- User planning strategy: 'strategy', 'approach', 'methodology'

**Examples**:
```
User: "I need to think through the microservices architecture for our e-commerce platform"
→ start_thinking_sequence(project_name="ecommerce", sequence_name="microservices-architecture", goal="Design scalable microservices architecture")

User: "I need to decide between GraphQL and REST for our new API"
→ start_thinking_sequence(project_name="api-design", sequence_name="graphql-vs-rest", goal="Choose API technology")
```

## 🔧 Key Decision Patterns for IDE Agents

### Automatic Tool Selection Logic

1. **Task Detection**: If user mentions actionable work → `store_memory` with `memory_type='task'` OR `create_tasks`
2. **Task Updates**: If user reports task status/completion → `update_task` (use memory ID, not task title!)
3. **Knowledge Search**: If user asks questions about past work → `search_memories`
4. **Planning Intent**: If user wants to plan or organize → `create_project_brief` OR `create_tasks`
5. **Progress Updates**: If user reports completion/status → `store_progress`
6. **Complex Analysis**: If user needs to think through problems → `start_thinking_sequence`
7. **General Documentation**: For insights, decisions, learnings → `store_memory`

### Context Clues for Tool Selection

**Planning Phase Indicators**:
- "planning mode", "let's plan", "help me organize"
- → Use `create_project_brief` or `create_tasks`

**Knowledge Retrieval Indicators**:
- "how did I", "what did I use", "similar to before"
- → Use `search_memories`

**Work Documentation Indicators**:
- "implemented", "fixed", "learned", "decided"
- → Use `store_memory`

**Progress Reporting Indicators**:
- "completed", "deployed", "milestone", percentages
- → Use `store_progress`

**Complex Problem Indicators**:
- "think through", "analyze", "complex decision"
- → Use `start_thinking_sequence`

## 🎯 Best Practices for IDE Agents

1. **Multiple Tool Usage**: Often use combinations (e.g., `create_project_brief` followed by `create_tasks`)
2. **Context Preservation**: Always include relevant project names and session information
3. **Memory Type Selection**: Choose appropriate `memory_type` for better organization
4. **Task vs Memory**: Use `memory_type='task'` for actionable items, regular memory types for documentation
5. **Follow-up Actions**: Chain tools logically (brief → tasks → progress tracking)

---

*This guide enables IDE agents to make intelligent decisions about MCP tool usage based on user intent and context.*