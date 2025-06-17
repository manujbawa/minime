#!/usr/bin/env node

/**
 * MCP stdio wrapper for MiniMe-MCP
 * This allows Cursor to launch the MCP server as a child process
 */

import { spawn } from 'child_process';

// Launch the main server with stdio flag
const child = spawn('node', ['src/server.js', '--stdio'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MCP_STDIO: 'true',
    // Use host networking to connect to Docker services
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://minime:minime_password@localhost:5432/minime_memories',
    OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434'
  },
  cwd: process.cwd()
});

child.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});