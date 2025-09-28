#!/bin/bash

# Start Serena MCP Server for StillOnTime Project
# This script starts the Serena MCP server configured for the StillOnTime project

echo "🚀 Starting Serena MCP Server for StillOnTime..."
echo "📁 Project directory: $(pwd)"
echo "🔧 Serena installation: ./serena-installation"

# Check if serena-installation directory exists
if [ ! -d "./serena-installation" ]; then
    echo "❌ Error: serena-installation directory not found!"
    echo "Please make sure Serena is properly installed."
    exit 1
fi

# Check if serena_config.yml exists
if [ ! -f "./serena_config.yml" ]; then
    echo "❌ Error: serena_config.yml not found!"
    echo "Please make sure the configuration file exists."
    exit 1
fi

# Start the MCP server
echo "🌐 Starting MCP server..."
echo "📊 Web dashboard will be available at: http://localhost:24282/dashboard/"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

cd ./serena-installation
uv run serena start-mcp-server --project ../.serena/project.yml
