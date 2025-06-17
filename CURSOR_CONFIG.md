# Cursor Configuration for MiniMe-MCP

## SSE Transport (Recommended)

Create or update your `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "minime-mcp": {
      "url": "http://localhost:8000/sse"
    }
  }
}
```

## Alternative: stdio Transport

If you prefer to run the server directly without Docker:

```json
{
  "mcpServers": {
    "minime-mcp": {
      "command": "node",
      "args": ["src/mcp-stdio.js"],
      "cwd": "/path/to/MiniMe-MCP"
    }
  }
}
```

## Verification

1. **Start your MiniMe-MCP server** (Docker container on port 8000)
2. **Restart Cursor completely** after adding the configuration
3. **Check MCP status**: Go to Cursor Settings → MCP Servers
4. **Look for green dot** next to "minime-mcp" indicating successful connection
5. **Test tools**: Ask the AI assistant: "What MCP tools do you have?"

## Available Tools

Your MiniMe-MCP server provides 17 tools:

### Memory Management
- `store_memory` - Store code snippets, decisions, and insights
- `search_memories` - Semantic search across your project memories

### Sequential Thinking
- `start_thinking_sequence` - Begin complex reasoning processes
- `add_thought` - Add thoughts to reasoning sequences
- `get_thinking_sequence` - Retrieve thinking progress
- `list_thinking_sequences` - List all reasoning sessions
- `complete_thinking_sequence` - Finalize reasoning

### Learning & Insights
- `get_insights` - AI-discovered patterns from your code
- `get_coding_patterns` - Specific architectural patterns you use
- `get_learning_insights` - Cross-project development insights
- `get_pattern_analysis` - Deep pattern analysis with examples
- `trigger_learning_analysis` - Force immediate pattern detection
- `get_learning_status` - Check learning system health

### Task Management
- `create_tasks` - Generate actionable project tasks
- `get_next_task` - Get prioritized next steps
- `update_task` - Update task status and details
- `suggest_tasks` - AI-suggested improvements and tasks

## Troubleshooting

### Tools not appearing in Cursor
1. Verify server is running: `curl http://localhost:8000/health`
2. Test SSE endpoint: `curl -H "Accept: text/event-stream" http://localhost:8000/sse`
3. Check Cursor logs: View → Output → select "MCP"
4. Restart Cursor completely

### Connection failures
1. Ensure Docker container is running: `docker ps | grep minime`
2. Check port 8000 is accessible: `curl http://localhost:8000/sse`
3. Verify no firewall blocking localhost:8000
4. Try alternative stdio transport if HTTP fails

### Performance issues
- The first tool call may be slower (embedding model initialization)
- Subsequent calls should be fast (<100ms)
- Use `get_learning_status` to check system health