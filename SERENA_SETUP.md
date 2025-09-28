# Serena AI Development Assistant - Setup Guide

## Overview

Serena has been successfully installed and configured for the StillOnTime project. Serena is a powerful coding agent toolkit that provides semantic retrieval and editing capabilities through an MCP (Model Context Protocol) server.

## Installation Status

✅ **Serena Installed**: Version 0.1.4 with all dependencies  
✅ **Configuration Created**: `serena_config.yml` with optimal settings  
✅ **Project Configured**: `.serena/project.yml` updated for TypeScript monorepo  
✅ **Start Script Created**: `start-serena.sh` for easy server startup  

## Quick Start

### 1. Start Serena MCP Server

```bash
# From the project root directory
./start-serena.sh
```

This will:
- Start the Serena MCP server
- Open web dashboard at http://localhost:24282/dashboard/
- Configure the server for the StillOnTime project

### 2. Alternative Manual Start

```bash
cd serena-installation
uv run serena start-mcp-server --config ../serena_config.yml --project ../.serena/project.yml
```

## Configuration Details

### Serena Configuration (`serena_config.yml`)
- **Web Dashboard**: Enabled (http://localhost:24282/dashboard/)
- **Log Level**: INFO (20)
- **Tool Timeout**: 240 seconds
- **Language Server Tracing**: Disabled (can be enabled for debugging)

### Project Configuration (`.serena/project.yml`)
- **Language**: TypeScript
- **Project Name**: StillOnTime
- **Read-only Mode**: Disabled (allows code editing)
- **Gitignore Integration**: Enabled
- **Initial Prompt**: Configured with project context

## Available Tools

Serena provides 25+ powerful tools for code analysis and editing:

### Core Tools
- `find_symbol` - Global symbol search with semantic understanding
- `find_referencing_symbols` - Find where symbols are used
- `get_symbols_overview` - Get file structure and symbol overview
- `replace_symbol_body` - Replace entire symbol definitions
- `insert_after_symbol` / `insert_before_symbol` - Precise code insertion

### File Operations
- `read_file` - Read files with context
- `create_text_file` - Create new files
- `search_for_pattern` - Pattern-based search
- `list_dir` - Directory listing with recursion

### Memory Management
- `write_memory` - Store project-specific knowledge
- `read_memory` - Retrieve stored knowledge
- `list_memories` - List all stored memories

### Project Management
- `onboarding` - Analyze project structure
- `activate_project` - Switch between projects
- `get_current_config` - View current configuration

## Integration with StillOnTime

### Project Context
Serena is configured with full context about the StillOnTime project:
- **Architecture**: Layered backend (Express/Prisma) + React frontend
- **Technologies**: TypeScript, Node.js, React, PostgreSQL, Redis
- **Integrations**: Google APIs, OpenWeatherMap, Twilio
- **Testing**: Playwright E2E tests

### Memory System
Serena can store and retrieve project-specific knowledge:
- Development patterns and conventions
- Architecture decisions and rationale
- Common issues and solutions
- Code organization principles

## Usage Examples

### 1. Find a Function
```bash
# Find all functions related to authentication
find_symbol --name "auth" --type "function"
```

### 2. Analyze File Structure
```bash
# Get overview of a TypeScript file
get_symbols_overview --file "src/services/authService.ts"
```

### 3. Find Symbol Usage
```bash
# Find where a specific function is used
find_referencing_symbols --file "src/services/authService.ts" --line 45
```

### 4. Store Knowledge
```bash
# Store important project information
write_memory --name "auth_patterns" --content "Authentication uses JWT tokens with Google OAuth 2.0"
```

## Web Dashboard

The Serena web dashboard provides:
- **Real-time Logs**: See all tool calls and responses
- **Session History**: Track what Serena has done
- **Tool Usage Stats**: Monitor tool usage patterns
- **Error Tracking**: Debug issues and failures

Access at: http://localhost:24282/dashboard/

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Serena will automatically use the next available port (24283, 24284, etc.)
   - Check the console output for the actual port

2. **Language Server Issues**
   - Enable `trace_lsp_communication: true` in config for debugging
   - Restart the server if language servers become unresponsive

3. **Tool Timeouts**
   - Increase `tool_timeout` in `serena_config.yml` for complex operations
   - Default is 240 seconds

### Debug Mode

To enable debug logging:
```yaml
# In serena_config.yml
log_level: 10  # DEBUG level
trace_lsp_communication: true
```

## Next Steps

1. **Start the Server**: Run `./start-serena.sh`
2. **Test Integration**: Try some basic commands through the MCP interface
3. **Store Knowledge**: Use `write_memory` to store important project information
4. **Explore Tools**: Experiment with different tools to understand capabilities

## Resources

- [Serena GitHub Repository](https://github.com/oraios/serena)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [StillOnTime Project Documentation](./README.md)

---

**Note**: Serena is now ready to use with the StillOnTime project. The MCP server provides powerful semantic code analysis and editing capabilities that integrate seamlessly with your development workflow.
