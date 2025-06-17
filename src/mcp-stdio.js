#!/usr/bin/env node

/**
 * MCP Server - STDIO Only Mode
 * For use with MCP clients like Cursor IDE
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import { DatabaseService } from './services/database-service.js';
import { EmbeddingService } from './services/embedding-service.js';
import { LearningPipeline } from './services/learning-pipeline.js';
import { SequentialThinkingService } from './services/sequential-thinking-service.js';
import { MCPToolsService } from './services/mcp-tools.js';

// Configure logger for stderr (won't interfere with MCP stdio)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'error', // Keep quiet for MCP
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ stream: process.stderr })
  ]
});

// Initialize services
const databaseService = new DatabaseService(logger, {
  user: process.env.POSTGRES_USER || 'minime',
  password: process.env.POSTGRES_PASSWORD || 'minime_password',
  database: process.env.POSTGRES_DB || 'minime_memories'
});

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
    tools: {}
  }
});

// Set up MCP tool discovery
mcpServer.setRequestHandler(ListToolsRequestSchema, () => {
  const tools = mcpToolsService.getPublicTools();
  logger.debug(`MCP client requested tools list: ${tools.length} tools available`);
  return { tools };
});

// Set up MCP tool execution
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.debug(`MCP tool called: ${name}`, { args });
  
  try {
    // Check if services are available before tool execution
    if (!databaseService || !databaseService.pool) {
      throw new Error('DATABASE_UNAVAILABLE: Core services are not available. Please check database connection.');
    }
    
    return await mcpToolsService.executeTool(name, args);
  } catch (error) {
    logger.error(`MCP tool execution failed: ${name}`, error);
    
    // Determine error type and provide appropriate guidance
    let errorCode = 'UNKNOWN_ERROR';
    let retryable = false;
    let message = error.message;
    
    if (error.message.includes('DATABASE_UNAVAILABLE') || error.message.includes('ECONNREFUSED')) {
      errorCode = 'SERVICE_UNAVAILABLE';
      retryable = true;
      message = 'Database service is unavailable. Please try again later or contact administrator.';
    } else if (error.message.includes('Unknown tool')) {
      errorCode = 'TOOL_NOT_FOUND';
      retryable = false;
      message = `Tool '${name}' is not available. Use tools/list to see available tools.`;
    } else if (error.message.includes('required') || error.message.includes('validation')) {
      errorCode = 'INVALID_PARAMETERS';
      retryable = false;
      message = `Invalid parameters for tool '${name}': ${error.message}`;
    }
    
    return {
      content: [{ 
        type: "text", 
        text: `[${errorCode}] ${message}${retryable ? ' (Retryable)' : ' (Do not retry)'}` 
      }],
      isError: true,
      errorCode,
      retryable
    };
  }
});

// Initialize services
async function initializeServices() {
  const serviceStatus = {
    database: false,
    embedding: false,
    learning: false,
    mcpReady: false
  };
  
  try {
    // Try to initialize database (critical for MCP tools)
    try {
      await databaseService.initialize();
      serviceStatus.database = true;
      logger.debug('Database service initialized');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      logger.warn('MCP server will start but tools will be limited');
      serviceStatus.database = false;
    }

    // Test embedding service (non-critical)
    try {
      const models = await embeddingService.getAvailableModels();
      serviceStatus.embedding = true;
      logger.debug(`Embedding service ready (${models.length} models available)`);
    } catch (error) {
      logger.warn('Embedding service degraded:', error.message);
      serviceStatus.embedding = false;
    }

    // Initialize learning pipeline (non-critical)
    try {
      await learningPipeline.initialize();
      serviceStatus.learning = true;
      logger.debug('Learning pipeline initialized');
    } catch (error) {
      logger.warn('Learning pipeline failed to initialize:', error.message);
      serviceStatus.learning = false;
    }
    
    // MCP is ready even with degraded services
    serviceStatus.mcpReady = true;
    return serviceStatus;
    
  } catch (error) {
    logger.error('Critical service initialization failed:', error);
    // Still allow MCP to start for troubleshooting
    serviceStatus.mcpReady = true;
    return serviceStatus;
  }
}

// Main function
async function main() {
  try {
    // Initialize services (non-blocking)
    const serviceStatus = await initializeServices();
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    logger.debug('MCP server connected to stdio transport');
    logger.debug(`Available MCP tools: ${mcpToolsService.getPublicTools().length}`);
    logger.debug('Service status:', serviceStatus);
    
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    // For stdio mode, we should still try to provide basic functionality
    logger.warn('Starting MCP server in degraded mode...');
    try {
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
      logger.warn('MCP server started in degraded mode - some tools may not work');
    } catch (fallbackError) {
      logger.error('Failed to start even in degraded mode:', fallbackError);
      process.exit(1);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.debug('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.debug('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Startup error:', error);
  process.exit(1);
});