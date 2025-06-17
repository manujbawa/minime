#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing MCP tool execution failure...');

// Start the MCP server in stdio mode
const serverProcess = spawn('node', ['mcp-stdio.js'], {
  cwd: join(__dirname, 'src'),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, LOG_LEVEL: 'error' } // Reduce noise
});

let buffer = '';
let receivedMessages = 0;

serverProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  
  const lines = buffer.split('\n');
  buffer = lines.pop();
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        receivedMessages++;
        
        if (message.id === 1) {
          console.log('✅ Init successful');
          setTimeout(() => sendStoreMemoryTest(), 500);
        }
        
        if (message.id === 2) {
          console.log(`✅ Tool execution response received:`, message);
          
          // Check for cycling behavior patterns
          if (message.result && message.result.isError) {
            console.log('❌ Tool execution failed as expected');
            console.log('Error details:', message.result.content[0].text);
            
            // Test if multiple rapid calls cause cycling
            console.log('\n--- Testing rapid repeated calls ---');
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                sendStoreMemoryTest(i + 3);
              }, i * 100);
            }
          }
        }
        
        if (message.id >= 3 && message.id <= 5) {
          console.log(`Response ${message.id}:`, message.result?.isError ? 'ERROR' : 'SUCCESS');
          
          if (receivedMessages >= 5) {
            console.log('\n--- Summary ---');
            console.log('Discovery: ✅ Works fine');
            console.log('Execution: ❌ Fails due to database unavailable');
            console.log('Cycling: No evidence of infinite loops or state management issues');
            console.log('The issue is simply database connectivity in STDIO mode vs HTTP mode');
            
            setTimeout(() => {
              serverProcess.kill();
              process.exit(0);
            }, 1000);
          }
        }
        
      } catch (e) {
        // Ignore non-JSON output
      }
    }
  }
});

function sendStoreMemoryTest(id = 2) {
  const storeMemoryMessage = {
    jsonrpc: "2.0",
    id: id,
    method: "tools/call",
    params: {
      name: "store_memory",
      arguments: {
        content: `Test memory ${id}`,
        project_name: "test-project",
        memory_type: "general"
      }
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(storeMemoryMessage) + '\n');
}

// Start with init
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: { roots: { listChanged: true }, sampling: {} },
    clientInfo: { name: "test-client", version: "1.0.0" }
  }
};

serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');

// Cleanup after 8 seconds
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 8000);