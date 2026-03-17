# Task Manager MCP Server

A basic, locally running Model Context Protocol (MCP) server that demonstrates key MCP concepts for task management.

## What This Demonstrates

### 1. **Resources** (Read-only data)
- `task://all` - View all tasks as JSON
- `task://summary` - Get task statistics summary

### 2. **Tools** (Interactive functions)
- `create_task` - Add new tasks
- `update_task_status` - Change task status
- `get_task` - Retrieve task details
- `delete_task` - Remove tasks

### 3. **Key MCP Patterns**
- Proper TypeScript typing
- STDIO transport for local servers
- Error handling
- State management
- JSON schema definitions for tools

## Setup

```bash
# Install dependencies
npm install

# Build the TypeScript
npm run build

# Test locally
npm start
```

## Configure with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "task-manager": {
      "command": "node",
      "args": ["/absolute/path/to/task-mcp-server/build/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with your actual path.

## Usage Examples

Once configured in Claude Desktop:

- "Show me all tasks" → Uses the `task://all` resource
- "Create a task to review code" → Calls `create_task` tool
- "Update task 1 to in-progress" → Calls `update_task_status` tool
- "What's my task summary?" → Uses `task://summary` resource

## Architecture

- **In-memory storage**: Simple Map for state (real servers would use DB)
- **Type safety**: Full TypeScript interfaces
- **STDIO transport**: Standard for local MCP servers
- **Proper logging**: Uses stderr to avoid corrupting JSON-RPC
- **Schema validation**: Tools have JSON schemas for inputs

## Key Learnings from undertaking this project 

1. **MCP separates concerns**: Resources for data, Tools for actions
2. **Transport agnostic**: STDIO for local, HTTP for remote
3. **Schema-driven**: Tools define their inputs via JSON Schema
4. **Client-agnostic**: Works with any MCP host (Claude Desktop, VS Code, etc.)
5. **Simple protocol**: JSON-RPC over transport layer