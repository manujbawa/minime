/**
 * MiniMe-MCP Entry Point
 * Main entry point for the MiniMe Model Context Protocol server
 */

import { server } from './server.js';

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Starting MiniMe-MCP server...');
}

export { server };
export * from './services/embedding-service.js';
export * from './services/learning-pipeline.js';