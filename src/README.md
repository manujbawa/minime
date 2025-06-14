# MiniMe-MCP Source Code

This directory contains the organized source code for the MiniMe Model Context Protocol server.

## Directory Structure

```
src/
├── index.js              # Main entry point and exports
├── server.js             # MCP server implementation
├── package.json          # Node.js dependencies
├── services/             # Core services
│   ├── embedding-service.js    # Vector embedding service
│   └── learning-pipeline.js   # Meta-learning and pattern detection
├── models/               # Data models (future)
├── types/                # Type definitions
│   └── index.js          # JSDoc type definitions
└── utils/                # Utility functions
    └── index.js          # Helper functions
```

## Key Components

### Services

- **EmbeddingService**: Handles vector embeddings using Ollama and OpenAI providers
- **LearningPipeline**: Continuous learning system for pattern detection and insights

### Server

- **server.js**: Main MCP server with HTTP endpoints for embeddings and health checks

### Types

- Memory, EmbeddingModel, LearningTask type definitions

### Utils

- Vector similarity calculations
- Text sanitization
- Task ID generation

## Usage

```javascript
import { EmbeddingService, LearningPipeline } from './src/index.js';
```

## Development

The source code is organized for clarity and maintainability:

1. **Services** contain business logic
2. **Types** provide documentation and type safety
3. **Utils** contain reusable helper functions
4. **Models** will contain data access layers (future)