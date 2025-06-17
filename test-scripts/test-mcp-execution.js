#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing MCP tool execution...');

// Start the MCP server in stdio mode
const serverProcess = spawn('node', ['mcp-stdio.js'], {
  cwd: join(__dirname, 'src'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let messageId = 1;

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
        
        // If we get the init response, send tools list
        if (message.id === 1 && message.result) {
          console.log('\n--- Tool discovery successful, now testing tool execution ---\n');
          setTimeout(() => testToolExecution(), 1000);
        }
        
        // If we get tools list, test tool execution
        if (message.id === 2 && message.result && message.result.tools) {
          console.log(`\n--- Got ${message.result.tools.length} tools, testing store_memory ---\n`);
          setTimeout(() => testStoreMemory(), 500);
        }
        
      } catch (e) {
        console.log('Non-JSON output:', line);
      }
    }
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

function testToolExecution() {
  const toolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  };
  
  console.log('Sending tools/list request...');
  serverProcess.stdin.write(JSON.stringify(toolsMessage) + '\n');
}

function testStoreMemory() {
  const storeMemoryMessage = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "store_memory",
      arguments: {
        content: "Test memory from MCP execution test",
        project_name: "test-project",
        memory_type: "general"
      }
    }
  };
  
  console.log('Testing store_memory tool execution...');
  serverProcess.stdin.write(JSON.stringify(storeMemoryMessage) + '\n');
}

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

console.log('Sending init message...');
serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');

// Clean up after 10 seconds
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 10000);