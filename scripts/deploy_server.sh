#!/bin/bash

# Server deployment script for CryptoMaltese Graph Service
# Run this script on your server after cloning the repository

set -e

echo "🚀 Starting CryptoMaltese Graph Service deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

print_status "Project root: $PROJECT_ROOT"

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/graph_service/requirements.txt" ]]; then
    print_error "Cannot find graph_service/requirements.txt. Are you in the right directory?"
    exit 1
fi

# Check if virtual environment exists
if [[ ! -d "$PROJECT_ROOT/graph_service/venv" ]]; then
    print_status "Creating Python virtual environment..."
    cd "$PROJECT_ROOT/graph_service"
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
print_status "Installing Python dependencies..."
cd "$PROJECT_ROOT/graph_service"
source venv/bin/activate
pip install -r requirements.txt

# Check if .env.local exists
cd "$PROJECT_ROOT"
if [[ ! -f ".env.local" ]]; then
    print_warning ".env.local not found. Creating from template..."
    cp .env.template .env.local
    print_warning "Please edit .env.local with your production settings:"
    print_warning "  - DATABASE_URL"
    print_warning "  - ETHERSCAN_API_KEY"
    read -p "Press Enter to edit .env.local now, or Ctrl+C to exit and edit manually..."
    nano .env.local
fi

# Test database connection
print_status "Testing database connection..."
if python scripts/init_db.py; then
    print_status "Database connection successful"
else
    print_error "Database connection failed. Please check your DATABASE_URL in .env.local"
    exit 1
fi

# Install systemd service
print_status "Installing systemd service..."
sudo cp scripts/cryptomaltese-graph.service /etc/systemd/system/

# Update service file with current paths
WORKING_DIR="$PROJECT_ROOT/graph_service"
VENV_PATH="$PROJECT_ROOT/graph_service/venv/bin"
ENV_FILE="$PROJECT_ROOT/.env.local"

sudo sed -i "s|WorkingDirectory=.*|WorkingDirectory=$WORKING_DIR|g" /etc/systemd/system/cryptomaltese-graph.service
sudo sed -i "s|Environment=PATH=.*|Environment=PATH=$VENV_PATH|g" /etc/systemd/system/cryptomaltese-graph.service
sudo sed -i "s|EnvironmentFile=.*|EnvironmentFile=$ENV_FILE|g" /etc/systemd/system/cryptomaltese-graph.service
sudo sed -i "s|ExecStart=.*|ExecStart=$VENV_PATH/uvicorn app.main:app --host 0.0.0.0 --port 8000|g" /etc/systemd/system/cryptomaltese-graph.service
sudo sed -i "s|ReadWritePaths=.*|ReadWritePaths=$PROJECT_ROOT|g" /etc/systemd/system/cryptomaltese-graph.service
sudo sed -i "s|User=.*|User=$(whoami)|g" /etc/systemd/system/cryptomaltese-graph.service
sudo sed -i "s|Group=.*|Group=$(whoami)|g" /etc/systemd/system/cryptomaltese-graph.service

# Reload systemd and start service
print_status "Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable cryptomaltese-graph
sudo systemctl start cryptomaltese-graph

# Wait a moment for service to start
sleep 3

# Check service status
if sudo systemctl is-active --quiet cryptomaltese-graph; then
    print_status "Service started successfully!"
    print_status "Service status:"
    sudo systemctl status cryptomaltese-graph --no-pager -l
    
    print_status "Testing health endpoint..."
    sleep 2
    if curl -s http://localhost:8000/health > /dev/null; then
        print_status "✅ Health check passed!"
        curl http://localhost:8000/health | python3 -m json.tool
    else
        print_warning "Health check failed. Check service logs:"
        print_warning "sudo journalctl -u cryptomaltese-graph -n 20"
    fi
else
    print_error "Service failed to start. Check logs:"
    sudo journalctl -u cryptomaltese-graph -n 20
    exit 1
fi

print_status "🎉 Deployment completed successfully!"
print_status ""
print_status "Useful commands:"
print_status "  View logs:     sudo journalctl -u cryptomaltese-graph -f"
print_status "  Restart:       sudo systemctl restart cryptomaltese-graph"
print_status "  Stop:          sudo systemctl stop cryptomaltese-graph"
print_status "  Status:        sudo systemctl status cryptomaltese-graph"
print_status "  Health check:  curl http://localhost:8000/health"
print_status ""
print_status "Service is running on: http://localhost:8000"
print_status "API Documentation: http://localhost:8000/docs"
