import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListRootsRequestSchema,
  CreateMessageRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import pg from 'pg';
import { DatabaseService } from './services/database-service.js';
import { EmbeddingService } from './services/embedding-service.js';
import { LearningPipeline } from './services/learning-pipeline.js';
import { SequentialThinkingService } from './services/sequential-thinking-service.js';
import { MCPToolsService } from './services/mcp-tools.js';
import { MCPResourcesService } from './services/mcp-resources.js';
import { MCPPromptsService } from './services/mcp-prompts.js';
import { MCPRootsService } from './services/mcp-roots.js';
import { MCPSamplingService } from './services/mcp-sampling.js';
import { MCPErrors, handleMCPError, withMCPErrorHandling } from './services/mcp-errors.js';

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
const databaseService = new DatabaseService(logger, {
  user: process.env.POSTGRES_USER || 'minime',
  password: process.env.POSTGRES_PASSWORD || 'minime_password',
  database: process.env.POSTGRES_DB || 'minime_memories'
});
const embeddingService = new EmbeddingService(logger, databaseService);
const learningPipeline = new LearningPipeline(logger, databaseService, embeddingService);
const sequentialThinkingService = new SequentialThinkingService(logger, databaseService, embeddingService);
const mcpToolsService = new MCPToolsService(logger, databaseService, embeddingService, learningPipeline, sequentialThinkingService);
const mcpResourcesService = new MCPResourcesService(logger, databaseService);
const mcpPromptsService = new MCPPromptsService(logger, databaseService);
const mcpRootsService = new MCPRootsService(logger);
const mcpSamplingService = new MCPSamplingService(logger, databaseService);

// MCP Server factory - create new instance per connection
function createMCPServer() {
  const server = new Server({
    name: "MiniMe-MCP",
    version: "0.1.0"
  }, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      sampling: {},
      roots: {
        listChanged: true
      }
    }
  });

  // Set up tool discovery for this instance
  server.setRequestHandler(ListToolsRequestSchema, withMCPErrorHandling(async () => {
    const tools = mcpToolsService.getPublicTools();
    logger.info(`MCP client requested tools list: ${tools.length} tools available`);
    return { tools };
  }, logger));

  // Set up tool execution for this instance
  server.setRequestHandler(CallToolRequestSchema, withMCPErrorHandling(async (request) => {
    const { name, arguments: args } = request.params;
    const toolStart = Date.now();
    const toolId = randomUUID().substring(0, 8);
    
    // Validate tool name
    if (!name) {
      throw MCPErrors.invalidParams('Tool name is required');
    }
    
    logger.info(`[TOOL-${toolId}] MCP tool called: ${name}`, { 
      argumentsKeys: args ? Object.keys(args) : [],
      hasArgs: !!args
    });
    
    try {
      const result = await mcpToolsService.executeTool(name, args);
      const duration = Date.now() - toolStart;
      logger.info(`[TOOL-${toolId}] Tool execution completed in ${duration}ms`, {
        resultType: typeof result,
        hasContent: result && result.content ? result.content.length : 0
      });
      return result;
    } catch (error) {
      const duration = Date.now() - toolStart;
      logger.error(`[TOOL-${toolId}] Tool execution failed after ${duration}ms: ${name}`, {
        error: error.message
      });
      
      // Check if tool exists
      const tools = mcpToolsService.getPublicTools();
      const toolExists = tools.some(tool => tool.name === name);
      
      if (!toolExists) {
        throw MCPErrors.toolNotFound(name);
      }
      
      throw MCPErrors.toolExecutionError(name, error);
    }
  }, logger));

  // Set up Resources API
  server.setRequestHandler(ListResourcesRequestSchema, withMCPErrorHandling(async () => {
    logger.info('MCP client requested resources list');
    const resources = await mcpResourcesService.listResources();
    return { resources };
  }, logger));

  server.setRequestHandler(ReadResourceRequestSchema, withMCPErrorHandling(async (request) => {
    const { uri } = request.params;
    
    if (!uri) {
      throw MCPErrors.invalidParams('Resource URI is required');
    }
    
    logger.info(`MCP client reading resource: ${uri}`);
    
    try {
      const contents = await mcpResourcesService.readResource(uri);
      return { contents };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw MCPErrors.resourceNotFound(uri);
      }
      if (error.code === 'EACCES') {
        throw MCPErrors.resourceAccessDenied(uri, 'Permission denied');
      }
      throw error;
    }
  }, logger));

  // Set up Prompts API
  server.setRequestHandler(ListPromptsRequestSchema, withMCPErrorHandling(async () => {
    logger.info('MCP client requested prompts list');
    const prompts = await mcpPromptsService.listPrompts();
    return { prompts };
  }, logger));

  server.setRequestHandler(GetPromptRequestSchema, withMCPErrorHandling(async (request) => {
    const { name, arguments: args } = request.params;
    
    if (!name) {
      throw MCPErrors.invalidParams('Prompt name is required');
    }
    
    logger.info(`MCP client getting prompt: ${name}`);
    
    try {
      const prompt = await mcpPromptsService.getPrompt(name, args || {});
      return prompt;
    } catch (error) {
      if (error.message.includes('not found')) {
        throw MCPErrors.promptNotFound(name);
      }
      throw MCPErrors.promptGenerationError(name, error);
    }
  }, logger));

  // Set up Sampling API
  server.setRequestHandler(CreateMessageRequestSchema, withMCPErrorHandling(async (request) => {
    const { messages, modelPreferences, systemPrompt, includeContext, temperature, maxTokens } = request.params;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw MCPErrors.invalidParams('Messages array is required and must not be empty');
    }
    
    logger.info('MCP client requesting completion via sampling', {
      messageCount: messages.length,
      hasModelPrefs: !!modelPreferences,
      hasSystemPrompt: !!systemPrompt
    });
    
    const samplingOptions = {
      modelPreferences,
      systemPrompt,
      includeContext,
      temperature,
      maxTokens
    };
    
    const completion = await mcpSamplingService.createMessage(messages, samplingOptions);
    return completion;
  }, logger));

  // Set up Roots API
  server.setRequestHandler(ListRootsRequestSchema, withMCPErrorHandling(async () => {
    logger.info('MCP client requested roots list');
    const roots = await mcpRootsService.listRoots();
    return { roots };
  }, logger));

  // Connect roots service to resources service for path updates
  mcpRootsService.notifyRootChange((fileRoots) => {
    mcpResourcesService.updateRoots(fileRoots);
  });

  return server;
}

// Keep one global server for backward compatibility
const mcpServer = createMCPServer();

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

// Tool handlers are now in the createMCPServer() factory function

// Create Express app for HTTP endpoint
const app = express();
const port = process.env.MCP_PORT || 8000;
const uiPort = process.env.UI_PORT || 8080;

// Import path for static file serving
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure CORS for all origins (single container doesn't need CORS)
app.use(cors());

// Don't use global JSON parsing - it conflicts with MCP's express.raw()
// Parse JSON bodies only for specific routes that need it

// Request logging middleware with more detailed logs
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    res.send = originalSend;
    const duration = Date.now() - start;
    logger.info(`[HTTP] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      query: req.query,
      userAgent: req.headers['user-agent']
    });
    return res.send(data);
  };
  
  logger.debug(`[HTTP] Incoming: ${req.method} ${req.path}`);
  next();
});

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

// Learning API endpoints
app.get('/api/learning/insights', async (req, res) => {
  try {
    const { category, actionable_only, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        mi.id,
        mi.insight_type as type,
        mi.category,
        mi.title,
        mi.description,
        mi.confidence,
        mi.actionable,
        mi.created_at,
        mi.metadata
      FROM meta_insights mi
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND mi.category = $${paramCount}`;
      params.push(category);
    }
    
    if (actionable_only === 'true') {
      query += ` AND mi.actionable = true`;
    }
    
    query += ` ORDER BY mi.created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));
    
    const result = await databaseService.query(query, params);
    
    res.json({
      insights: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Failed to get learning insights:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/learning/patterns', async (req, res) => {
  try {
    const { category, min_confidence, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        cp.id,
        cp.pattern_category,
        cp.pattern_type,
        cp.pattern_name,
        cp.pattern_signature,
        cp.pattern_description as description,
        cp.frequency_count,
        cp.confidence_score,
        cp.success_rate,
        cp.created_at,
        cp.examples
      FROM coding_patterns cp
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND cp.pattern_category = $${paramCount}`;
      params.push(category);
    }
    
    if (min_confidence) {
      paramCount++;
      query += ` AND cp.confidence_score >= $${paramCount}`;
      params.push(parseFloat(min_confidence));
    }
    
    query += ` ORDER BY cp.frequency_count DESC, cp.confidence_score DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));
    
    const result = await databaseService.query(query, params);
    
    res.json({
      patterns: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Failed to get coding patterns:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/learning/status', async (req, res) => {
  try {
    // Get queue size
    const queueResult = await databaseService.query(`
      SELECT COUNT(*) as queue_size FROM learning_processing_queue WHERE status = 'pending'
    `);
    
    // Get total patterns
    const patternsResult = await databaseService.query(`
      SELECT COUNT(*) as total_patterns FROM coding_patterns
    `);
    
    // Get total insights
    const insightsResult = await databaseService.query(`
      SELECT COUNT(*) as total_insights FROM meta_insights
    `);
    
    // Get last processing time
    const lastProcessingResult = await databaseService.query(`
      SELECT MAX(created_at) as last_processing FROM learning_processing_queue WHERE status = 'completed'
    `);
    
    // Calculate processing rate (simple metric)
    const processingRateResult = await databaseService.query(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(*) as total
      FROM learning_processing_queue 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);
    
    const processingRate = processingRateResult.rows[0].total > 0 
      ? processingRateResult.rows[0].completed / processingRateResult.rows[0].total 
      : 1.0;
    
    res.json({
      queue_size: parseInt(queueResult.rows[0].queue_size),
      total_patterns: parseInt(patternsResult.rows[0].total_patterns),
      total_insights: parseInt(insightsResult.rows[0].total_insights),
      last_processing: lastProcessingResult.rows[0].last_processing,
      processing_rate: processingRate,
      system_health: processingRate > 0.8 ? 'healthy' : processingRate > 0.5 ? 'degraded' : 'unhealthy'
    });
  } catch (error) {
    logger.error('Failed to get learning status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/learning/analyze', express.json(), async (req, res) => {
  try {
    if (learningPipeline) {
      await learningPipeline.queueLearningTask('manual_analysis', {
        trigger: 'user_request',
        timestamp: new Date().toISOString()
      }, 1); // High priority
      
      res.json({
        message: 'Learning analysis queued successfully',
        status: 'queued'
      });
    } else {
      res.status(503).json({ error: 'Learning pipeline not available' });
    }
  } catch (error) {
    logger.error('Failed to trigger learning analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Data Administration endpoints
app.delete('/api/projects/:projectName/memories', async (req, res) => {
  try {
    const { projectName } = req.params;
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Delete all memories for the project
    const deletedCount = await databaseService.deleteProjectMemories(project.id);
    
    logger.info(`Deleted ${deletedCount} memories from project: ${projectName}`);
    
    res.json({
      message: `Deleted all memories from project "${projectName}"`,
      stats: {
        memories: deletedCount
      }
    });
  } catch (error) {
    logger.error('Failed to delete project memories:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:projectName', async (req, res) => {
  try {
    const { projectName } = req.params;
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Delete entire project and all associated data
    const stats = await databaseService.deleteProject(project.id);
    
    logger.info(`Deleted project and all data: ${projectName}`, stats);
    
    res.json({
      message: `Deleted project "${projectName}" and all associated data`,
      stats
    });
  } catch (error) {
    logger.error('Failed to delete project:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/learnings', async (req, res) => {
  try {
    // Delete all coding patterns and meta insights
    const stats = await databaseService.deleteAllLearnings();
    
    logger.info('Deleted all learnings:', stats);
    
    res.json({
      message: 'Deleted all meta-learning data',
      stats
    });
  } catch (error) {
    logger.error('Failed to delete learnings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/data', async (req, res) => {
  try {
    // Delete ALL user data
    const stats = await databaseService.deleteAllData();
    
    logger.warn('DELETED ALL USER DATA:', stats);
    
    res.json({
      message: 'Deleted all user data from the system',
      stats
    });
  } catch (error) {
    logger.error('Failed to delete all data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test JSON parsing
app.post('/mcp/debug', express.json(), (req, res) => {
  res.json({
    success: true,
    body: req.body,
    headers: req.headers,
    method: req.method
  });
});

// MCP status endpoint - Streamable HTTP transport info
app.get('/mcp/status', (req, res) => {
  const tools = mcpToolsService.getPublicTools();
  const showFullSchema = req.query.full === 'true';
  
  res.json({
    message: 'MCP server ready with Streamable HTTP transport',
    version: '0.1.0',
    transport: {
      type: 'Streamable HTTP MCP',
      protocol: 'Model Context Protocol',
      endpoint: '/mcp',
      features: ['session_management', 'resumability', 'unified_get_post'],
      note: 'This is MCP protocol, not SSE. For SSE transport see /sse/status'
    },
    capabilities: {
      tools: {
        count: tools.length,
        available: showFullSchema ? tools : tools.map(t => ({ name: t.name, description: t.description }))
      },
      resources: {
        supported_schemes: ['file', 'project', 'memory', 'session'],
        total_available: 'dynamic',
        description: 'File system, project data, memories, and session resources'
      },
      prompts: {
        count: 10,
        categories: ['code-review', 'debugging', 'architecture', 'documentation', 'testing', 'optimization'],
        description: 'Reusable prompt templates for common development workflows'
      },
      roots: {
        default_roots: ['/app', '/workspace'],
        supports_updates: true,
        description: 'Workspace boundary management and resource discovery hints'
      },
      sampling: {
        supported_features: ['text_completion', 'code_analysis', 'debug_assistance', 'architecture_planning'],
        simulated: true,
        description: 'Server-requested LLM completions for advanced workflows'
      }
    },
    services: {
      embeddings: 'available',
      learning: 'active',
      sequentialThinking: 'active',
      projectManagement: 'active'
    },
    alternativeTransports: {
      sse: {
        endpoint: '/sse',
        status: '/sse/status',
        note: 'Server-Sent Events transport (separate from MCP)'
      }
    }
  });
});

// Create proper StreamableHTTPServerTransport - one server, persistent sessions
const streamableTransport = new StreamableHTTPServerTransport({});

// Connect the existing MCP server instance to the transport
mcpServer.connect(streamableTransport);

logger.info('MCP StreamableHTTPServerTransport initialized with persistent server instance');

// Simple test endpoint to verify connectivity
app.post('/mcp/test', express.json(), (req, res) => {
  logger.info('[MCP-TEST] Test endpoint hit:', {
    body: req.body,
    headers: req.headers
  });
  res.json({
    success: true,
    message: 'MCP test endpoint working',
    received: req.body
  });
});

// Debug: Log ALL requests to /mcp path
app.use('/mcp*', (req, res, next) => {
  const requestId = randomUUID().substring(0, 8);
  logger.info(`[DEBUG-${requestId}] ${req.method} ${req.path} ${req.url}`, {
    headers: req.headers,
    query: req.query,
    body: req.body
  });
  next();
});

// Handle CORS preflight for MCP
app.options('/mcp', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.sendStatus(200);
});

// Simple HTTP-based MCP endpoint - direct JSON-RPC handling
app.post('/mcp', express.json(), async (req, res) => {
  // Ensure CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  const requestId = randomUUID().substring(0, 8);
  
  logger.info(`[MCP-${requestId}] Direct JSON-RPC request`, {
    method: req.body?.method,
    id: req.body?.id,
    hasParams: !!req.body?.params
  });

  try {
    const { method, params, id } = req.body;

    let result;
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
            sampling: {},
            roots: {
              listChanged: true
            }
          },
          serverInfo: {
            name: "MiniMe-MCP",
            version: "0.1.0"
          }
        };
        break;
        
      case 'tools/list':
        const tools = mcpToolsService.getPublicTools();
        result = { tools };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        logger.info(`[MCP-${requestId}] Tool call request`, { 
          toolName: name, 
          hasArgs: !!args 
        });
        const toolResult = await mcpToolsService.executeTool(name, args);
        result = toolResult;
        break;
        
      case 'resources/list':
        const resources = await mcpResourcesService.listResources();
        result = { resources };
        break;
        
      case 'prompts/list':
        const prompts = await mcpPromptsService.listPrompts();
        result = prompts;
        break;
        
      case 'notifications/initialized':
        // Client finished initialization - this is a notification, no response needed
        logger.info(`[MCP-${requestId}] Client initialized successfully`);
        return res.status(204).send(); // No content response for notifications
        
      default:
        throw new Error(`Method not found: ${method}`);
    }

    res.json({
      jsonrpc: "2.0",
      result,
      id
    });

    logger.info(`[MCP-${requestId}] Response sent successfully`);

  } catch (error) {
    logger.error(`[MCP-${requestId}] Request failed:`, error.message);
    
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error.message
      },
      id: req.body?.id || null
    });
  }
});

// Legacy SSE Transport - Server-Sent Events for real-time tool updates
app.get('/sse', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || randomUUID();
    logger.info(`[SSE] Client connected for real-time updates`, { sessionId });
    
    // Set proper SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    });

    // Send initial connection confirmation
    res.write(`event: connected\n`);
    res.write(`data: {"type":"connection","status":"connected","sessionId":"${sessionId}"}\n\n`);
    
    // Send available tools as SSE event
    const tools = mcpToolsService.getPublicTools();
    res.write(`event: tools\n`);
    res.write(`data: {"type":"tools","tools":${JSON.stringify(tools)}}\n\n`);
    
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (!res.headersSent) {
        res.write(`event: heartbeat\n`);
        res.write(`data: {"type":"heartbeat","timestamp":"${new Date().toISOString()}"}\n\n`);
      }
    }, 30000);
    
    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      logger.info(`[SSE] Client disconnected`, { sessionId });
    });
    
    logger.info(`[SSE] Connection established`, { sessionId });
    
  } catch (error) {
    logger.error('[SSE] Connection failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'SSE connection failed' });
    }
  }
});

// SSE Tool Execution - Non-standard extension for SSE transport
app.post('/sse/execute', express.json(), async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || randomUUID();
    const { toolName, arguments: args } = req.body;
    
    logger.info(`[SSE] Tool execution request`, { sessionId, toolName });
    
    if (!toolName) {
      return res.status(400).json({
        error: 'Tool name is required',
        code: 'MISSING_TOOL_NAME'
      });
    }
    
    const result = await mcpToolsService.executeTool(toolName, args || {});
    
    res.json({
      success: true,
      toolName,
      result,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`[SSE] Tool executed successfully`, { sessionId, toolName });
    
  } catch (error) {
    logger.error('[SSE] Tool execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'EXECUTION_FAILED'
    });
  }
});

// SSE Status endpoint
app.get('/sse/status', (req, res) => {
  const tools = mcpToolsService.getPublicTools();
  
  res.json({
    transport: 'Server-Sent Events (SSE)',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      connect: '/sse',
      execute: '/sse/execute',
      status: '/sse/status'
    },
    capabilities: {
      realtime: true,
      heartbeat: true,
      toolExecution: true
    },
    tools: {
      count: tools.length,
      available: tools.map(t => ({ name: t.name, description: t.description }))
    },
    timestamp: new Date().toISOString()
  });
});

// Remove the incorrect redirect - SSE and MCP are separate transports

// Root endpoint - MCP server info (UI served separately)
app.get('/', (req, res) => {
  logger.info('[MCP-SERVER] Root endpoint accessed - returning server info');
  const serverInfo = {
    service: 'MiniMe MCP Server',
    version: '0.1.0',
    port: port,
    ui_port: uiPort,
    endpoints: {
      health: '/health',
      mcp_status: '/mcp/status',
      api: '/api/*',
      mcp: '/mcp',
      sse: '/sse'
    },
    ui_url: `http://localhost:${uiPort}`,
    note: 'UI is served separately on port ' + uiPort,
    transports: {
      mcp: {
        endpoint: '/mcp',
        status: '/mcp/status',
        type: 'Streamable HTTP MCP'
      },
      sse: {
        endpoint: '/sse',
        status: '/sse/status', 
        type: 'Server-Sent Events'
      }
    },
    timestamp: new Date().toISOString()
  };
  logger.debug('[MCP-SERVER] Serving server info:', serverInfo);
  res.json(serverInfo);
});

// MCP SSE fallback endpoint for Cursor compatibility
app.get('/mcp/sse', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || randomUUID();
  logger.info(`[MCP-SSE] Client connected`, { sessionId });
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initialization confirmation
  res.write(`data: ${JSON.stringify({
    jsonrpc: "2.0",
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, prompts: {} },
      serverInfo: { name: "MiniMe-MCP", version: "0.1.0" }
    },
    id: 0
  })}\n\n`);

  // Send tool list
  const tools = mcpToolsService.getPublicTools();
  res.write(`data: ${JSON.stringify({
    jsonrpc: "2.0",
    result: { tools },
    id: 1
  })}\n\n`);

  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    logger.info(`[MCP-SSE] Client disconnected`, { sessionId });
  });
});

// Redirect /ui requests to the UI server
app.get('/ui*', (req, res) => {
  logger.info(`[MCP-SERVER] UI request redirected: ${req.path} -> http://localhost:${uiPort}${req.path.replace('/ui', '')}`);
  res.redirect(`http://localhost:${uiPort}${req.path.replace('/ui', '') || '/'}`);
});

// Start HTTP server and initialize services
app.listen(port, '0.0.0.0', async () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 MiniMe-MCP Server started successfully`);
  logger.info('='.repeat(60));
  logger.info(`📍 Server Port: ${port}`);
  logger.info(`💾 Database: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);
  logger.info(`🤖 Ollama: ${process.env.OLLAMA_HOST || 'not configured'}`);
  logger.info('-'.repeat(60));
  
  // Initialize services with error handling
  let serviceStatus;
  try {
    serviceStatus = await initializeServices();
  } catch (error) {
    logger.error('Critical service initialization failure. Server will exit.');
    process.exit(1);
  }
  
  // Set up learning pipeline scheduled processing
  if (serviceStatus.learning) {
    logger.info('Setting up learning pipeline scheduled processing...');
    
    // Process learning queue every 5 minutes
    setInterval(async () => {
      try {
        const processed = await learningPipeline.processLearningQueue(10);
        if (processed > 0) {
          logger.info(`Learning pipeline processed ${processed} tasks`);
        }
      } catch (error) {
        logger.error('Learning pipeline processing failed:', error);
      }
    }, 300000); // 5 minutes

    // Queue insight generation every hour
    setInterval(async () => {
      try {
        await learningPipeline.queueLearningTask('insight_generation', {
          trigger: 'scheduled_hourly'
        }, 4);
        logger.debug('Queued scheduled insight generation');
      } catch (error) {
        logger.error('Failed to queue insight generation:', error);
      }
    }, 3600000); // 1 hour

    // Queue preference analysis daily
    setInterval(async () => {
      try {
        await learningPipeline.queueLearningTask('preference_analysis', {
          trigger: 'scheduled_daily'
        }, 5);
        logger.debug('Queued scheduled preference analysis');
      } catch (error) {
        logger.error('Failed to queue preference analysis:', error);
      }
    }, 86400000); // 24 hours

    logger.info('Learning pipeline scheduled processing configured');
  }

  // MCP Server is now available over Streamable HTTP
  logger.info('🌐 Service endpoints:');
  logger.info(`  📱 Web UI: http://localhost:${port}/ui`);
  logger.info(`  🏥 Health: http://localhost:${port}/health`);
  logger.info(`  🛠️  MCP Status: http://localhost:${port}/mcp/status`);
  logger.info(`  🔧 MCP Tools: ${mcpToolsService.getPublicTools().length} tools available`);
  logger.info(`  📡 API Base: http://localhost:${port}/api`);
  logger.info('='.repeat(60));
  
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