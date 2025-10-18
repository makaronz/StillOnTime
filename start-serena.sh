#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(pwd)"
INSTALL_DIR="${PROJECT_ROOT}/dokumentacja/serena-installation"
CONFIG_FILE="${PROJECT_ROOT}/config/serena_config.yml"
LOG_FILE="logs/serena.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "🚀 Starting Serena MCP Server for StillOnTime..." | tee -a "$LOG_FILE"
echo "📁 Project directory: ${PROJECT_ROOT}" | tee -a "$LOG_FILE"
echo "🔧 Serena installation: ${INSTALL_DIR}" | tee -a "$LOG_FILE"

test -d "$INSTALL_DIR" || { echo "❌ Error: ${INSTALL_DIR} not found" | tee -a "$LOG_FILE"; exit 1; }

test -f "$CONFIG_FILE" || { echo "❌ Error: ${CONFIG_FILE} not found" | tee -a "$LOG_FILE"; exit 1; }

echo "🌐 Starting MCP server..." | tee -a "$LOG_FILE"
echo "📊 Web dashboard: http://localhost:24282/dashboard/" | tee -a "$LOG_FILE"

echo "TODO(decision): zweryfikuj ścieżkę projektu Serena" | tee -a "$LOG_FILE"

cd "$INSTALL_DIR"
uv run serena start-mcp-server --project ../.serena/project.yml
