#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing MCP tool discovery...');

// Start the MCP server in stdio mode
const serverProcess = spawn('node', ['mcp-stdio.js'], {
  cwd: join(__dirname, 'src'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

serverProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Look for complete JSON messages
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Received:', JSON.stringify(message, null, 2));
      } catch (e) {
        console.log('Non-JSON output:', line);
      }
    }
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Send initialization message
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      roots: {
        listChanged: true
      },
      sampling: {}
    },
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

console.log('Sending init message:', JSON.stringify(initMessage));
serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');

// Send tools list request after a delay
setTimeout(() => {
  const toolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  };
  
  console.log('Sending tools/list request:', JSON.stringify(toolsMessage));
  serverProcess.stdin.write(JSON.stringify(toolsMessage) + '\n');
}, 1000);

// Clean up after 5 seconds
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 5000);