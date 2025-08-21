#!/usr/bin/env bash

# Local startup script for Graph Mapping Service
# This script should be run in a separate terminal

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GRAPH_SERVICE_DIR="$PROJECT_ROOT/graph_service"

echo "🚀 Starting Graph Mapping Service locally..."
echo "Project root: $PROJECT_ROOT"
echo "Graph service dir: $GRAPH_SERVICE_DIR"

# Check if .env.local exists
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
    echo "📁 Loading environment variables from .env.local"
    export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs -d '\n' 2>/dev/null || true)
else
    echo "⚠️  Warning: .env.local not found. Using default environment variables."
    echo "   Please copy .env.template to .env.local and configure your settings."
fi

# Change to graph service directory
cd "$GRAPH_SERVICE_DIR"

# Check if virtual environment exists
if [[ ! -d "venv" ]]; then
    echo "❌ Virtual environment not found at $GRAPH_SERVICE_DIR/venv"
    echo "   Please create it with: python -m venv venv"
    echo "   Then install dependencies: pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment
echo "🐍 Activating virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
if ! python -c "import uvicorn" 2>/dev/null; then
    echo "❌ uvicorn not found. Installing dependencies..."
    pip install -r requirements.txt
fi

# Start the service
echo "🌟 Starting uvicorn server at http://localhost:8000"
echo "📖 API documentation available at: http://localhost:8000/docs"
echo "🔍 Health check at: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run uvicorn with reload for development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
