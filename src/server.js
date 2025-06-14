import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import pg from 'pg';
import { DatabaseService } from './services/database-service.js';
import { EmbeddingService } from './services/embedding-service.js';
import { LearningPipeline } from './services/learning-pipeline.js';
import { SequentialThinkingService } from './services/sequential-thinking-service.js';
import { MCPToolsService } from './services/mcp-tools.js';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Database connection configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Legacy pool for backward compatibility  
const { Pool } = pg;
const dbPool = new Pool(dbConfig);

// Initialize services (all services now use DatabaseService for consistency)
const databaseService = new DatabaseService(logger);
const embeddingService = new EmbeddingService(logger, databaseService);
const learningPipeline = new LearningPipeline(logger, databaseService, embeddingService);
const sequentialThinkingService = new SequentialThinkingService(logger, databaseService, embeddingService);
const mcpToolsService = new MCPToolsService(logger, databaseService, embeddingService, learningPipeline, sequentialThinkingService);

// Initialize MCP Server
const mcpServer = new Server({
  name: "MiniMe-MCP",
  version: "0.1.0"
}, {
  capabilities: {
    tools: {}  // Enable tool discovery
  }
});

// Initialize services on server startup
async function initializeServices() {
  const serviceStatus = {
    database: false,
    embedding: false,
    learning: false,
    critical_failure: false
  };

  try {
    // Initialize database service first (critical)
    try {
      await databaseService.initialize();
      serviceStatus.database = true;
      logger.info('Database service initialized');
    } catch (error) {
      logger.error('Critical: Database service failed to initialize:', error);
      serviceStatus.critical_failure = true;
      throw new Error(`Database initialization failed: ${error.message}`);
    }

    // Test embedding service (non-critical)
    try {
      // Test basic embedding functionality
      const models = await embeddingService.getAvailableModels();
      serviceStatus.embedding = models.length > 0;
      logger.info(`Embedding service ready (${models.length} models available)`);
    } catch (error) {
      logger.warn('Embedding service degraded:', error.message);
      serviceStatus.embedding = false;
    }

    // Initialize learning pipeline (depends on database, non-critical)
    try {
      await learningPipeline.initialize();
      serviceStatus.learning = true;
      logger.info('Learning pipeline initialized');
    } catch (error) {
      logger.warn('Learning pipeline failed to initialize:', error.message);
      logger.info('System will continue without learning capabilities');
      serviceStatus.learning = false;
    }

    // Log final status
    const successCount = Object.values(serviceStatus).filter(Boolean).length - 1; // exclude critical_failure
    logger.info(`Service initialization complete: ${successCount}/3 services operational`);
    
    // Log service status
    try {
      const dbStats = await databaseService.getStats();
      logger.info('Database statistics:', dbStats);
    } catch (error) {
      logger.warn('Could not retrieve database statistics:', error.message);
    }

    return serviceStatus;
    
  } catch (error) {
    logger.error('Service initialization failed:', error);
    serviceStatus.critical_failure = true;
    throw error;
  }
}

// Set up MCP tool discovery
mcpServer.setRequestHandler(ListToolsRequestSchema, () => {
  const tools = mcpToolsService.getPublicTools();
  logger.info(`MCP client requested tools list: ${tools.length} tools available`);
  return { tools };
});

// Set up MCP tool execution
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`MCP tool called: ${name}`, { args });
  
  try {
    return await mcpToolsService.executeTool(name, args);
  } catch (error) {
    logger.error(`MCP tool execution failed: ${name}`, error);
    return {
      content: [{ 
        type: "text", 
        text: `Error: ${error.message}` 
      }],
      isError: true
    };
  }
});

// Create Express app for HTTP endpoint
const app = express();
const port = process.env.MCP_PORT || 8000;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database service
    const dbHealth = await databaseService.healthCheck();
    
    // Check embedding service
    const embeddingHealth = await embeddingService.healthCheck();
    
    // Get database statistics
    const dbStats = await databaseService.getStats();
    
    // Get thinking analytics
    const thinkingAnalytics = await sequentialThinkingService.getThinkingAnalytics();
    
    const allServicesHealthy = dbHealth.status === 'healthy' && embeddingHealth.status === 'healthy';
    
    res.json({
      status: allServicesHealthy ? 'healthy' : 'degraded',
      version: '0.1.0',
      phase: 'Complete System - Memory + Sequential Thinking + Meta-Learning',
      services: {
        database: dbHealth.status,
        embeddings: embeddingHealth.status,
        sequentialThinking: 'active',
        metaLearning: 'active',
        defaultEmbeddingModel: embeddingHealth.defaultModel || 'none',
        availableEmbeddingModels: embeddingHealth.availableModels || 0
      },
      statistics: {
        database: dbStats,
        thinking: thinkingAnalytics
      },
      capabilities: {
        memoryManagement: true,
        sequentialThinking: true,
        metaLearning: true,
        patternDetection: true,
        crossProjectInsights: true,
        vectorSimilarity: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Embedding API endpoints
app.get('/api/embeddings/models', async (req, res) => {
  try {
    const models = await embeddingService.getAvailableModels();
    res.json({
      models,
      count: models.length
    });
  } catch (error) {
    logger.error('Failed to get embedding models:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/embeddings/generate', express.json(), async (req, res) => {
  try {
    const { text, model } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }
    
    const embedding = await embeddingService.generateEmbedding(text, model);
    const modelConfig = await embeddingService.getModelConfig(model || await embeddingService.getDefaultModel());
    
    res.json({
      embedding,
      dimensions: embedding.length,
      model: modelConfig.model_name,
      provider: modelConfig.provider
    });
  } catch (error) {
    logger.error('Failed to generate embedding:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/embeddings/similarity', express.json(), async (req, res) => {
  try {
    const { textA, textB, model } = req.body;
    
    if (!textA || !textB) {
      return res.status(400).json({ error: 'Both textA and textB are required' });
    }
    
    const [embeddingA, embeddingB] = await Promise.all([
      embeddingService.generateEmbedding(textA, model),
      embeddingService.generateEmbedding(textB, model)
    ]);
    
    const similarity = embeddingService.cosineSimilarity(embeddingA, embeddingB);
    
    res.json({
      similarity,
      textA,
      textB,
      model: model || await embeddingService.getDefaultModel()
    });
  } catch (error) {
    logger.error('Failed to calculate similarity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Project Management API endpoints
app.get('/api/projects', async (req, res) => {
  try {
    const includeStats = req.query.stats !== 'false';
    const projects = await databaseService.listProjects(includeStats);
    res.json({ projects, count: projects.length });
  } catch (error) {
    logger.error('Failed to list projects:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', express.json(), async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name is required and must be a string' });
    }
    
    const project = await databaseService.createProject(name, description, settings || {});
    res.status(201).json({ project });
  } catch (error) {
    logger.error('Failed to create project:', error);
    
    if (error.constraint === 'projects_name_unique') {
      res.status(409).json({ error: 'Project name already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/projects/:projectName', async (req, res) => {
  try {
    const { projectName } = req.params;
    const project = await databaseService.getProjectByName(projectName);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ project });
  } catch (error) {
    logger.error('Failed to get project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Session Management API endpoints
app.get('/api/projects/:projectName/sessions', async (req, res) => {
  try {
    const { projectName } = req.params;
    const activeOnly = req.query.active === 'true';
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const sessions = await databaseService.listSessionsForProject(project.id, activeOnly);
    res.json({ sessions, count: sessions.length });
  } catch (error) {
    logger.error('Failed to list sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectName/sessions', express.json(), async (req, res) => {
  try {
    const { projectName } = req.params;
    const { session_name, session_type = 'mixed', description, metadata } = req.body;
    
    if (!session_name || typeof session_name !== 'string') {
      return res.status(400).json({ error: 'Session name is required and must be a string' });
    }
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const session = await databaseService.createSession(
      project.id, 
      session_name, 
      session_type, 
      description, 
      metadata || {}
    );
    
    res.status(201).json({ session });
  } catch (error) {
    logger.error('Failed to create session:', error);
    
    if (error.constraint === 'sessions_project_name_unique') {
      res.status(409).json({ error: 'Session name already exists in this project' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Memory Management API endpoints
app.get('/api/projects/:projectName/memories', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { 
      session_name, 
      memory_type, 
      limit = 50, 
      offset = 0,
      order_by = 'created_at',
      order_direction = 'DESC'
    } = req.query;
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    let sessionId = null;
    if (session_name) {
      const session = await databaseService.getSessionByName(project.id, session_name);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      sessionId = session.id;
    }
    
    const memories = await databaseService.listMemories({
      projectId: project.id,
      sessionId: sessionId,
      memoryType: memory_type,
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: order_by,
      orderDirection: order_direction
    });
    
    res.json({ memories, count: memories.length });
  } catch (error) {
    logger.error('Failed to list memories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sequential Thinking API endpoints
app.get('/api/projects/:projectName/thinking', async (req, res) => {
  try {
    const { projectName } = req.params;
    const includeCompleted = req.query.completed !== 'false';
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const sequences = await databaseService.listThinkingSequences(project.id, includeCompleted);
    res.json({ sequences, count: sequences.length });
  } catch (error) {
    logger.error('Failed to list thinking sequences:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/thinking/:sequenceId', async (req, res) => {
  try {
    const { sequenceId } = req.params;
    const format = req.query.format || 'detailed';
    const includeBranches = req.query.branches !== 'false';
    
    const sequence = await sequentialThinkingService.getThinkingSequence(
      parseInt(sequenceId),
      { 
        format: format,
        includeBranches: includeBranches,
        includeRevisions: true
      }
    );
    
    if (!sequence) {
      return res.status(404).json({ error: 'Thinking sequence not found' });
    }
    
    res.json({ sequence });
  } catch (error) {
    logger.error('Failed to get thinking sequence:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const { project_name, timeframe = '30 days' } = req.query;
    
    let projectId = null;
    if (project_name) {
      const project = await databaseService.getProjectByName(project_name);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      projectId = project.id;
    }
    
    const [dbStats, thinkingAnalytics] = await Promise.all([
      databaseService.getStats(),
      sequentialThinkingService.getThinkingAnalytics(projectId, timeframe)
    ]);
    
    res.json({
      database: dbStats,
      thinking: thinkingAnalytics,
      timeframe: timeframe,
      project: project_name || 'all'
    });
  } catch (error) {
    logger.error('Failed to get analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// MCP status endpoint
app.get('/mcp/status', (req, res) => {
  const tools = mcpToolsService.getPublicTools();
  res.json({
    message: 'MCP server ready with Streamable HTTP transport',
    version: '0.1.0',
    transport: {
      type: 'Streamable HTTP',
      endpoint: '/mcp',
      features: ['session_management', 'resumability', 'unified_get_post']
    },
    capabilities: {
      tools: {
        count: tools.length,
        available: tools.map(t => ({ name: t.name, description: t.description }))
      }
    },
    services: {
      embeddings: 'available',
      learning: 'active',
      sequentialThinking: 'active',
      projectManagement: 'active'
    }
  });
});

// Create Streamable HTTP transport
const streamableTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (sessionId) => {
    logger.info(`New MCP session initialized: ${sessionId}`);
  }
});

// Connect MCP server to Streamable HTTP transport
mcpServer.connect(streamableTransport);

// MCP over Streamable HTTP - unified endpoint for both GET and POST
app.all('/mcp', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    logger.debug(`MCP ${req.method} request received`);
    
    // Parse JSON body for POST requests
    let parsedBody;
    if (req.method === 'POST' && req.body) {
      try {
        parsedBody = JSON.parse(req.body.toString());
      } catch (error) {
        logger.error('Failed to parse MCP request body:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }
    
    await streamableTransport.handleRequest(req, res, parsedBody);
  } catch (error) {
    logger.error('MCP request handling failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Legacy SSE endpoint for backward compatibility (deprecated)
app.get('/mcp/sse', (req, res) => {
  logger.warn('Legacy SSE endpoint accessed - please migrate to /mcp endpoint');
  res.status(410).json({ 
    error: 'SSE transport deprecated',
    message: 'Please use the new Streamable HTTP transport at /mcp endpoint',
    migration: 'https://docs.anthropic.com/en/docs/build-with-claude/mcp'
  });
});

// Start HTTP server and initialize services
app.listen(port, '0.0.0.0', async () => {
  logger.info(`MiniMe-MCP HTTP server listening on port ${port}`);
  logger.info('Database URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');
  logger.info('Ollama host:', process.env.OLLAMA_HOST || 'not configured');
  
  // Initialize services with error handling
  let serviceStatus;
  try {
    serviceStatus = await initializeServices();
  } catch (error) {
    logger.error('Critical service initialization failure. Server will exit.');
    process.exit(1);
  }
  
  // MCP Server is now available over Streamable HTTP
  logger.info('MCP server initialized with Streamable HTTP transport');
  logger.info(`MCP Streamable HTTP endpoint: /mcp (supports both GET and POST)`);
  logger.info(`Available MCP tools: ${mcpToolsService.getPublicTools().length}`);
  logger.info(`Web UI available at: http://localhost:${port}`);
  
  // Still support stdio for backward compatibility
  if (process.env.MCP_STDIO === 'true' || process.argv.includes('--stdio')) {
    logger.info('Also starting MCP server on stdio transport for backward compatibility...');
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    logger.info('MCP server also connected to stdio transport');
  }
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} signal received: initiating graceful shutdown`);
  
  try {
    // Close database connections
    if (databaseService && databaseService.pool) {
      await databaseService.pool.end();
      logger.info('Database connections closed');
    }
    
    // Stop learning pipeline if running
    if (learningPipeline && learningPipeline.stopProcessing) {
      learningPipeline.stopProcessing();
      logger.info('Learning pipeline stopped');
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});