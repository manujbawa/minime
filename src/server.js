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
import { LLMService } from './services/llm-service.js';
import { LearningPipeline } from './services/learning-pipeline.js';
import { SequentialThinkingService } from './services/sequential-thinking-service.js';
import { MCPToolsService } from './services/mcp-tools.js';
import { MCPResourcesService } from './services/mcp-resources.js';
import { MCPPromptsService } from './services/mcp-prompts.js';
import { MCPRootsService } from './services/mcp-roots.js';
import { MCPSamplingService } from './services/mcp-sampling.js';
import { MCPErrors, handleMCPError, withMCPErrorHandling } from './services/mcp-errors.js';
import ConfigService from './services/config-service.js';
import AnalyticsCollector from './services/analytics-collector.js';

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
const llmService = new LLMService(logger, databaseService);
const configService = new ConfigService(databaseService, logger);
const analyticsCollector = new AnalyticsCollector(databaseService, configService, logger);
const learningPipeline = new LearningPipeline(logger, databaseService, embeddingService, llmService);
const sequentialThinkingService = new SequentialThinkingService(logger, databaseService, embeddingService);
const mcpToolsService = new MCPToolsService(logger, databaseService, embeddingService, learningPipeline, sequentialThinkingService);
const mcpResourcesService = new MCPResourcesService(logger, databaseService);
const mcpPromptsService = new MCPPromptsService(logger, databaseService);
const mcpRootsService = new MCPRootsService(logger);
const mcpSamplingService = new MCPSamplingService(logger, databaseService);

// Event-driven learning state
const eventTriggers = {
  lastProjectCompletion: new Map(),
  lastMajorInsight: new Map(),
  criticalPatternThreshold: 3,
  criticalPatternCounter: new Map()
};

// Set up event-driven learning for major milestones
function setupEventDrivenLearning(learningPipeline, logger) {
  logger.info('Event-driven learning triggers configured');
  
  // Store references for use in other functions
  global.learningPipelineRef = learningPipeline;
  global.loggerRef = logger;
  global.checkCriticalPatterns = checkCriticalPatterns;
  global.triggerMilestoneLearning = triggerMilestoneLearning;
}

// Trigger event-based learning for milestones
async function triggerMilestoneLearning(projectId, milestoneType, context = {}) {
  try {
    const learningPipeline = global.learningPipelineRef;
    const logger = global.loggerRef;
    
    if (!learningPipeline) return;

    const priority = milestoneType === 'critical_error' ? 1 : 
                    milestoneType === 'project_completion' ? 2 : 
                    milestoneType === 'major_breakthrough' ? 2 : 3;

    await learningPipeline.queueLearningTask('milestone_analysis', {
      trigger: 'event_driven',
      milestone_type: milestoneType,
      project_id: projectId,
      context: context,
      triggered_at: new Date().toISOString()
    }, priority);

    logger.info(`Triggered milestone learning for ${milestoneType} in project ${projectId}`);
  } catch (error) {
    if (global.loggerRef) {
      global.loggerRef.error('Failed to trigger milestone learning:', error);
    }
  }
}

// Check for critical patterns and trigger real-time learning
async function checkCriticalPatterns(memory) {
  try {
    const learningPipeline = global.learningPipelineRef;
    const logger = global.loggerRef;
    
    if (!learningPipeline || !memory) return;

    const projectId = memory.project_id || 'global';
    
    // Count critical memories
    if (!eventTriggers.criticalPatternCounter.has(projectId)) {
      eventTriggers.criticalPatternCounter.set(projectId, 0);
    }
    
    const isCritical = memory.memory_type === 'bug' || 
                      memory.tags?.includes('error') ||
                      memory.tags?.includes('security') ||
                      memory.importance_score > 0.8;

    if (isCritical) {
      const count = eventTriggers.criticalPatternCounter.get(projectId) + 1;
      eventTriggers.criticalPatternCounter.set(projectId, count);

      // Trigger immediate learning for critical patterns
      if (memory.memory_type === 'bug' || memory.tags?.includes('error')) {
        await learningPipeline.queueLearningTask('critical_pattern_analysis', {
          trigger: 'real_time_critical',
          memory_id: memory.id,
          pattern_type: 'error_handling',
          project_id: projectId
        }, 1); // Highest priority

        logger.info(`Triggered real-time critical pattern analysis for memory ${memory.id}`);
      }

      // Trigger milestone learning after threshold
      if (count >= eventTriggers.criticalPatternThreshold) {
        await triggerMilestoneLearning(projectId, 'critical_pattern_cluster', {
          pattern_count: count,
          latest_memory: memory.id
        });
        eventTriggers.criticalPatternCounter.set(projectId, 0); // Reset counter
      }
    }
  } catch (error) {
    if (global.loggerRef) {
      global.loggerRef.error('Failed to check critical patterns:', error);
    }
  }
}

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

    // Initialize configuration service (critical for feature toggles)
    try {
      await configService.initialize();
      serviceStatus.config = true;
      logger.info('Configuration service initialized');
    } catch (error) {
      logger.error('Configuration service failed to initialize:', error.message);
      logger.info('System will continue with default configurations');
      serviceStatus.config = false;
    }

    // Initialize analytics collection (non-critical)
    try {
      await analyticsCollector.start();
      serviceStatus.analytics = true;
      logger.info('Analytics collection started');
    } catch (error) {
      logger.warn('Analytics collection failed to start:', error.message);
      logger.info('System will continue without analytics collection');
      serviceStatus.analytics = false;
    }

    // Log final status
    const successCount = Object.values(serviceStatus).filter(Boolean).length - 1; // exclude critical_failure
    const totalServices = Object.keys(serviceStatus).length - 1; // exclude critical_failure
    logger.info(`Service initialization complete: ${successCount}/${totalServices} services operational`);
    
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
      order_direction = 'DESC',
      q: search_query
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

    // If there's a search query, use database query with search filtering
    if (search_query) {
      let query = `
        SELECT m.*, p.name as project_name
        FROM memories m
        LEFT JOIN projects p ON m.project_id = p.id
        WHERE m.project_id = $1
      `;
      const params = [project.id];
      let paramIndex = 2;

      if (sessionId) {
        query += ` AND m.session_id = $${paramIndex}`;
        params.push(sessionId);
        paramIndex++;
      }

      if (memory_type) {
        query += ` AND m.memory_type = $${paramIndex}`;
        params.push(memory_type);
        paramIndex++;
      }

      // Add search filtering
      query += ` AND (m.content ILIKE $${paramIndex} OR m.tags::text ILIKE $${paramIndex})`;
      params.push(`%${search_query}%`);
      paramIndex++;

      query += ` ORDER BY m.${order_by} ${order_direction}`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await databaseService.query(query, params);
      res.json({ memories: result.rows, count: result.rows.length });
    } else {
      // No search query, use existing listMemories method
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
    }
  } catch (error) {
    logger.error('Failed to list memories:', error);
    res.status(500).json({ error: error.message });
  }
});

// General memories API endpoint (not project-specific)
app.get('/api/memories', async (req, res) => {
  try {
    const { 
      memory_type, 
      limit = 50, 
      offset = 0,
      order_by = 'created_at',
      order_direction = 'DESC',
      search_query
    } = req.query;
    
    let query = `
      SELECT m.*, p.name as project_name
      FROM memories m
      LEFT JOIN projects p ON m.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (memory_type) {
      query += ` AND m.memory_type = $${paramIndex}`;
      params.push(memory_type);
      paramIndex++;
    }
    
    if (search_query) {
      query += ` AND (m.content ILIKE $${paramIndex} OR m.tags::text ILIKE $${paramIndex})`;
      params.push(`%${search_query}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY m.${order_by} ${order_direction}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await databaseService.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM memories m
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;
    
    if (memory_type) {
      countQuery += ` AND m.memory_type = $${countParamIndex}`;
      countParams.push(memory_type);
      countParamIndex++;
    }
    
    if (search_query) {
      countQuery += ` AND (m.content ILIKE $${countParamIndex} OR m.tags::text ILIKE $${countParamIndex})`;
      countParams.push(`%${search_query}%`);
    }
    
    const countResult = await databaseService.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || 0);
    
    res.json({ 
      memories: result.rows, 
      count: result.rows.length,
      total: total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
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
    let projectFilter = '';
    if (project_name && project_name !== 'all') {
      const project = await databaseService.getProjectByName(project_name);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      projectId = project.id;
      projectFilter = `AND m.project_id = ${projectId}`;
    }
    
    // Enhanced analytics queries
    const [
      basicStats,
      memoryTypeDistribution,
      projectBreakdown,
      timeSeriesData,
      healthMetrics,
      topInsights,
      patternData
    ] = await Promise.all([
      // Basic stats
      databaseService.getStats(),
      
      // Memory type distribution for pie charts
      databaseService.query(`
        SELECT 
          m.memory_type,
          COUNT(*) as count,
          AVG(m.importance_score) as avg_importance,
          COUNT(CASE WHEN m.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_count
        FROM memories m 
        WHERE 1=1 ${projectFilter}
        GROUP BY m.memory_type
        ORDER BY count DESC
      `),
      
      // Project breakdown
      databaseService.query(`
        SELECT 
          p.name as project_name,
          COUNT(m.id) as memory_count,
          AVG(m.importance_score) as avg_importance,
          COUNT(DISTINCT m.memory_type) as unique_types,
          MAX(m.created_at) as last_activity
        FROM projects p
        LEFT JOIN memories m ON p.id = m.project_id
        GROUP BY p.id, p.name
        ORDER BY memory_count DESC
        LIMIT 10
      `),
      
      // Time series data for last 30 days
      databaseService.query(`
        SELECT 
          DATE(m.created_at) as date,
          COUNT(*) as daily_memories,
          COUNT(DISTINCT m.memory_type) as daily_types,
          AVG(m.importance_score) as avg_importance,
          COUNT(CASE WHEN m.memory_type = 'bug' THEN 1 END) as bug_count,
          COUNT(CASE WHEN m.memory_type = 'task' THEN 1 END) as task_count,
          COUNT(CASE WHEN m.memory_type = 'insight' THEN 1 END) as insight_count
        FROM memories m
        WHERE m.created_at > NOW() - INTERVAL '30 days' ${projectFilter}
        GROUP BY DATE(m.created_at)
        ORDER BY date DESC
        LIMIT 30
      `),
      
      // Health metrics
      databaseService.query(`
        SELECT 
          COUNT(CASE WHEN m.memory_type = 'bug' THEN 1 END) as total_bugs,
          COUNT(CASE WHEN m.memory_type = 'task' THEN 1 END) as total_tasks,
          COUNT(CASE WHEN m.memory_type = 'decision' THEN 1 END) as decisions_made,
          COUNT(CASE WHEN m.memory_type = 'insight' THEN 1 END) as insights_captured,
          COUNT(CASE WHEN m.importance_score > 0.8 THEN 1 END) as high_importance_items,
          COUNT(*) as total_memories,
          AVG(m.importance_score) as overall_quality
        FROM memories m 
        WHERE 1=1 ${projectFilter}
      `),
      
      // Top insights for quick view
      databaseService.query(`
        SELECT 
          mi.insight_title,
          mi.insight_type,
          mi.confidence_level,
          mi.actionable
        FROM meta_insights mi
        ORDER BY mi.confidence_level DESC, mi.updated_at DESC
        LIMIT 5
      `),
      
      // Pattern summary
      databaseService.query(`
        SELECT 
          cp.pattern_category,
          COUNT(*) as pattern_count,
          AVG(cp.confidence_score) as avg_confidence,
          MAX(cp.frequency_count) as max_frequency
        FROM coding_patterns cp
        GROUP BY cp.pattern_category
        ORDER BY pattern_count DESC
      `)
    ]);

    // Process time series data for frontend
    const processedTimeSeries = timeSeriesData.rows.map(row => ({
      date: row.date,
      memories: parseInt(row.daily_memories),
      types: parseInt(row.daily_types),
      importance: parseFloat(row.avg_importance || 0),
      bugs: parseInt(row.bug_count),
      tasks: parseInt(row.task_count),
      insights: parseInt(row.insight_count),
      productivity: Math.min(100, parseInt(row.daily_memories) * 5 + parseInt(row.insight_count) * 10)
    }));

    // Process memory distribution for pie chart
    const memoryDistribution = memoryTypeDistribution.rows.map(row => ({
      name: row.memory_type,
      value: parseInt(row.count),
      percentage: 0, // Will be calculated on frontend
      avgImportance: parseFloat(row.avg_importance || 0),
      recentActivity: parseInt(row.recent_count)
    }));

    // Process project health metrics
    const health = healthMetrics.rows[0];
    const healthScore = health ? {
      bugRate: health.total_bugs / Math.max(1, health.total_memories),
      taskCompletionIndicator: health.total_tasks / Math.max(1, health.total_memories),
      decisionMakingRate: health.decisions_made / Math.max(1, health.total_memories),
      knowledgeCaptureRate: health.insights_captured / Math.max(1, health.total_memories),
      qualityScore: parseFloat(health.overall_quality || 0),
      overallHealth: Math.min(100, Math.max(10, 100 - (health.total_bugs / Math.max(1, health.total_memories)) * 200 + parseFloat(health.overall_quality || 0) * 50))
    } : {};

    // Enhanced response structure
    res.json({
      database: basicStats,
      thinking: await sequentialThinkingService.getThinkingAnalytics(projectId, timeframe),
      timeframe: timeframe,
      project: project_name || 'all',
      
      // Enhanced analytics
      memoryDistribution,
      projectBreakdown: projectBreakdown.rows.slice(0, 8), // Top 8 projects
      timeSeries: processedTimeSeries.reverse(), // Chronological order
      healthMetrics: healthScore,
      insights: {
        total: topInsights.rows.length,
        items: topInsights.rows,
        actionableCount: topInsights.rows.filter(i => i.actionable).length
      },
      patterns: {
        categories: patternData.rows,
        totalPatterns: patternData.rows.reduce((sum, row) => sum + parseInt(row.pattern_count), 0)
      },
      
      // Summary metrics for quick overview
      summary: {
        totalMemories: parseInt(basicStats.memories.total_memories),
        totalProjects: parseInt(basicStats.projects),
        qualityScore: Math.round(healthScore.qualityScore * 100),
        healthScore: Math.round(healthScore.overallHealth),
        recentActivity: processedTimeSeries.slice(-7).reduce((sum, day) => sum + day.memories, 0) // Last 7 days
      }
    });
  } catch (error) {
    logger.error('Failed to get analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get time-series analytics data
app.get('/api/analytics/timeseries', async (req, res) => {
  try {
    const { 
      metric, 
      project_name, 
      timeRange = '24 hours', 
      granularity = 'minute' 
    } = req.query;
    
    if (!metric) {
      return res.status(400).json({ error: 'Metric parameter is required' });
    }
    
    let projectId = null;
    if (project_name) {
      const project = await databaseService.getProjectByName(project_name);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      projectId = project.id;
    }
    
    const timeSeries = await analyticsCollector.getTimeSeries(
      metric, 
      projectId, 
      timeRange, 
      granularity
    );
    
    res.json({
      success: true,
      metric,
      project: project_name || 'global',
      timeRange,
      granularity,
      data: timeSeries
    });
  } catch (error) {
    logger.error('Failed to get time-series analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get analytics dashboard data (combines multiple metrics)
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const { project_name, timeRange = '24 hours' } = req.query;
    
    let projectId = null;
    if (project_name) {
      const project = await databaseService.getProjectByName(project_name);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      projectId = project.id;
    }
    
    // Collect multiple time-series metrics for dashboard
    const [
      memoryGrowth,
      taskActivity,
      thinkingActivity,
      completionRate
    ] = await Promise.all([
      analyticsCollector.getTimeSeries('database.total_memories', projectId, timeRange, 'hour'),
      analyticsCollector.getTimeSeries('database.total_tasks', projectId, timeRange, 'hour'),
      analyticsCollector.getTimeSeries('thinking.avg_confidence', projectId, timeRange, 'hour'),
      analyticsCollector.getTimeSeries('tasks.completed.count', projectId, timeRange, 'hour')
    ]);
    
    res.json({
      success: true,
      project: project_name || 'global',
      timeRange,
      dashboard: {
        memoryGrowth,
        taskActivity,
        thinkingActivity,
        completionRate
      }
    });
  } catch (error) {
    logger.error('Failed to get dashboard analytics:', error);
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
        mi.insight_category as category,
        mi.insight_title as title,
        mi.insight_description as description,
        mi.confidence_level as confidence,
        mi.actionable,
        mi.updated_at as created_at,
        mi.metadata
      FROM meta_insights mi
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND mi.insight_category = $${paramCount}`;
      params.push(category);
    }
    
    if (actionable_only === 'true') {
      query += ` AND mi.actionable = true`;
    }
    
    query += ` ORDER BY mi.updated_at DESC LIMIT $${paramCount + 1}`;
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
        COALESCE(cp.confidence_score * 0.8, 0.5) as success_rate,
        cp.created_at,
        ARRAY[cp.example_code] as examples
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
    if (learningPipeline) {
      const detailedStatus = await learningPipeline.getStatus();
      
      // Transform for backward compatibility with existing UI
      const compatibleStatus = {
        queue_size: detailedStatus.queue.find(q => q.status === 'pending')?.count || 0,
        total_patterns: detailedStatus.patterns.total_patterns || 0,
        total_insights: detailedStatus.insights.reduce((sum, insight) => sum + parseInt(insight.count), 0),
        last_processing: detailedStatus.scheduling?.learning_queue_processing?.lastRun,
        processing_rate: detailedStatus.processingProgress?.errorRate ? 
          (100 - detailedStatus.processingProgress.errorRate) / 100 : 1.0,
        system_health: detailedStatus.processingProgress?.systemHealth || 'unknown',
        
        // Add new detailed information
        detailed: detailedStatus
      };
      
      res.json(compatibleStatus);
    } else {
      res.status(503).json({ error: 'Learning pipeline not available' });
    }
  } catch (error) {
    logger.error('Failed to get learning status:', error);
    res.status(500).json({ error: error.message });
  }
});

// New comprehensive monitoring endpoint
app.get('/api/learning/monitoring', async (req, res) => {
  try {
    if (learningPipeline) {
      const status = await learningPipeline.getStatus();
      
      // Add current time for reference
      status.currentTime = new Date().toISOString();
      
      // Calculate time until next runs
      if (status.scheduling) {
        for (const [taskType, schedule] of Object.entries(status.scheduling)) {
          if (schedule.nextScheduled) {
            schedule.timeUntilNext = Math.max(0, new Date(schedule.nextScheduled) - new Date());
            schedule.timeUntilNextHuman = formatTimeUntil(schedule.timeUntilNext);
          }
        }
      }
      
      res.json(status);
    } else {
      res.status(503).json({ error: 'Learning pipeline not available' });
    }
  } catch (error) {
    logger.error('Failed to get learning monitoring data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format time until next run
function formatTimeUntil(ms) {
  if (ms <= 0) return 'Overdue';
  
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

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

// ============================================================================
// CONFIGURATION API ENDPOINTS
// ============================================================================

// Get all system configurations
app.get('/api/config', async (req, res) => {
  try {
    const { category } = req.query;
    
    let configs;
    if (category) {
      configs = await configService.getByCategory(category);
    } else {
      configs = await configService.getWithMetadata();
    }
    
    res.json({
      success: true,
      configs
    });
  } catch (error) {
    logger.error('Failed to get configurations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific configuration
app.get('/api/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await configService.get(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Configuration key not found' });
    }
    
    res.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    logger.error(`Failed to get configuration ${req.params.key}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update specific configuration
app.put('/api/config/:key', express.json(), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    // Validate the configuration value
    if (!configService.validateConfig(key, value)) {
      return res.status(400).json({ error: `Invalid value for configuration ${key}` });
    }
    
    await configService.set(key, value, 'api');
    
    // If analytics interval changed, restart collection
    if (key === 'analytics_interval_minutes' || key === 'analytics_enabled') {
      analyticsCollector.stop();
      setTimeout(() => analyticsCollector.start(), 1000);
    }
    
    logger.info(`Configuration updated via API: ${key} = ${JSON.stringify(value)}`);
    
    res.json({
      success: true,
      message: `Configuration ${key} updated successfully`,
      key,
      value
    });
  } catch (error) {
    logger.error(`Failed to update configuration ${req.params.key}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update multiple configurations
app.put('/api/config', express.json(), async (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ error: 'Configs object is required' });
    }
    
    // Validate all configurations first
    const validationErrors = [];
    for (const [key, value] of Object.entries(configs)) {
      if (!configService.validateConfig(key, value)) {
        validationErrors.push(`Invalid value for ${key}: ${value}`);
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    await configService.setMultiple(configs, 'api');
    
    // Check if analytics settings changed
    const analyticsKeys = ['analytics_interval_minutes', 'analytics_enabled'];
    if (analyticsKeys.some(key => key in configs)) {
      analyticsCollector.stop();
      setTimeout(() => analyticsCollector.start(), 1000);
    }
    
    logger.info(`Multiple configurations updated via API:`, Object.keys(configs));
    
    res.json({
      success: true,
      message: `Updated ${Object.keys(configs).length} configurations`,
      updated: Object.keys(configs)
    });
  } catch (error) {
    logger.error('Failed to update multiple configurations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset configurations to defaults
app.post('/api/config/reset', express.json(), async (req, res) => {
  try {
    const { category } = req.body;
    
    await configService.resetToDefaults(category);
    
    // Restart analytics collection with new settings
    analyticsCollector.stop();
    setTimeout(() => analyticsCollector.start(), 1000);
    
    const message = category 
      ? `Reset configurations for category: ${category}`
      : 'Reset all configurations to defaults';
    
    logger.info(message);
    
    res.json({
      success: true,
      message
    });
  } catch (error) {
    logger.error('Failed to reset configurations:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TASKS API ENDPOINTS (NOW USING TASK-TYPE MEMORIES)
// ============================================================================

// Get task-type memories for a project
app.get('/api/projects/:projectName/tasks', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { status, type, limit, offset } = req.query;
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const taskMemories = await databaseService.getTasksForProject(
      project.id, 
      { status, type, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 }
    );
    
    // Transform task memories to task-like objects for UI compatibility
    const tasks = taskMemories.map(memory => {
      const metadata = memory.metadata || {};
      const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
      
      // Try to extract title from content
      const titleMatch = content.match(/^([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : content.substring(0, 50) + '...';
      
      return {
        id: memory.id,
        title,
        description: content,
        type: metadata.task_type || 'task',
        status: metadata.status || 'pending',
        priority: metadata.priority || 'medium',
        metadata: {
          ...metadata,
          estimated_hours: metadata.estimated_effort,
          actual_hours: metadata.actual_effort,
          tags: memory.tags || []
        },
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        completed_at: metadata.completed_at,
        project_id: memory.project_id,
        session_id: memory.session_id,
        importance_score: memory.importance_score
      };
    });
    
    res.json({
      success: true,
      tasks,
      count: tasks.length,
      project: project.name
    });
  } catch (error) {
    logger.error('Failed to get project tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a task using store_memory with task type
app.post('/api/projects/:projectName/tasks', express.json(), async (req, res) => {
  try {
    const { projectName } = req.params;
    const { title, description, type = 'task', priority = 'medium', metadata = {} } = req.body;
    
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' });
    }
    
    const project = await databaseService.getProjectByName(projectName);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Create task content
    const taskContent = `${title.trim()}\n\n${description || ''}\n\nTask Type: ${type}\nPriority: ${priority}\nStatus: pending`;
    
    // Use the MCP tools service to store as task-type memory
    const result = await mcpToolsService.executeTool('store_memory', {
      content: taskContent,
      project_name: projectName,
      memory_type: 'task',
      importance_score: priority === 'critical' ? 0.9 : priority === 'high' ? 0.8 : 0.6,
      tags: [`task-${type}`, priority, ...(metadata.tags || [])]
    });
    
    logger.info(`Created task: ${title} for project: ${projectName}`);
    
    res.status(201).json({
      success: true,
      task: {
        title,
        description,
        type,
        priority,
        status: 'pending',
        metadata,
        created_at: new Date().toISOString()
      },
      mcp_result: result
    });
  } catch (error) {
    logger.error('Failed to create task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a task
app.put('/api/tasks/:taskId', express.json(), async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const task = await databaseService.updateTask(taskId, updates);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    logger.info(`Updated task: ${taskId}`);
    
    res.json({
      success: true,
      task
    });
  } catch (error) {
    logger.error('Failed to update task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a task
app.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const deleted = await databaseService.deleteTask(taskId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    logger.info(`Deleted task: ${taskId}`);
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete task:', error);
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
    
    // Process learning queue every 15 minutes (optimal responsiveness)
    setInterval(async () => {
      try {
        const processed = await learningPipeline.processLearningQueue(20);
        if (processed > 0) {
          logger.info(`Learning pipeline processed ${processed} tasks`);
        }
      } catch (error) {
        logger.error('Learning pipeline processing failed:', error);
      }
    }, 900000); // 15 minutes

    // Enhanced scheduling with overdue detection and immediate processing
    const scheduleWithOverdueCheck = async (taskType, intervalMs, priority) => {
      const processTask = async () => {
        try {
          // Check if there are overdue tasks of this type that need immediate processing
          const overdueCheck = await databaseService.query(`
            SELECT COUNT(*) as overdue_count
            FROM learning_processing_queue
            WHERE task_type = $1 
              AND status = 'pending' 
              AND scheduled_for <= NOW()
          `, [taskType]);
          
          const overdueCount = parseInt(overdueCheck.rows[0]?.overdue_count || 0);
          
          if (overdueCount > 0) {
            logger.info(`Found ${overdueCount} overdue ${taskType} tasks - processing immediately`);
            const processed = await learningPipeline.processLearningQueue(20);
            if (processed > 0) {
              logger.info(`Processed ${processed} overdue tasks including ${taskType}`);
            }
          }
          
          // Queue next scheduled task
          await learningPipeline.queueLearningTask(taskType, {
            trigger: 'scheduled_hourly'
          }, priority);
          
          logger.debug(`Queued scheduled ${taskType}`);
        } catch (error) {
          logger.error(`Failed to queue ${taskType}:`, error);
        }
      };
      
      // Run immediately to catch any existing overdue tasks
      await processTask();
      
      // Then set up regular interval
      setInterval(processTask, intervalMs);
    };

    // Set up all scheduled tasks with overdue checking
    await scheduleWithOverdueCheck('insight_generation', 3600000, 4); // 1 hour
    await scheduleWithOverdueCheck('preference_analysis', 3600000, 5); // 1 hour  
    await scheduleWithOverdueCheck('pattern_detection', 3600000, 3); // 1 hour
    await scheduleWithOverdueCheck('evolution_tracking', 3600000, 6); // 1 hour

    // Set up event-driven learning triggers
    setupEventDrivenLearning(learningPipeline, logger);

    logger.info('Learning pipeline scheduled processing configured with overdue detection');
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