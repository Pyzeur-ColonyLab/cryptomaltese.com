#!/bin/bash
# Production deployment script for Python Graph Service

set -e

echo "🚀 CryptoMaltese Graph Service Deployment"
echo "=========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Do not run this script as root"
    exit 1
fi

# Check for required commands
for cmd in python3 pip3 systemctl; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ $cmd is required but not installed"
        exit 1
    fi
done

# Configuration
SERVICE_NAME="cryptomaltese-graph"
APP_DIR="/opt/cryptomaltese/graph_service"
USER="cryptomaltese"
VENV_DIR="$APP_DIR/venv"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

echo "📁 Setting up directories..."

# Create application directory
sudo mkdir -p $APP_DIR
sudo mkdir -p /var/log/cryptomaltese

# Create service user if doesn't exist
if ! id "$USER" &>/dev/null; then
    sudo useradd --system --home $APP_DIR --shell /bin/bash $USER
    echo "✅ Created service user: $USER"
fi

echo "📦 Installing application..."

# Copy application files
sudo cp -r . $APP_DIR/
sudo chown -R $USER:$USER $APP_DIR

# Setup Python virtual environment
sudo -u $USER python3 -m venv $VENV_DIR
sudo -u $USER $VENV_DIR/bin/pip install --upgrade pip
sudo -u $USER $VENV_DIR/bin/pip install -r $APP_DIR/requirements.txt

echo "⚙️  Creating systemd service..."

# Create systemd service file
sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=CryptoMaltese Graph Mapping Service
After=network.target postgresql.service

[Service]
Type=exec
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR
Environment=PATH=$VENV_DIR/bin
ExecStart=$VENV_DIR/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

# Environment file (create this manually)
EnvironmentFile=/opt/cryptomaltese/.env

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/cryptomaltese

[Install]
WantedBy=multi-user.target
EOF

echo "🔧 Configuring service..."

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

echo "📝 Setup complete! Next steps:"
echo ""
echo "1. Create environment file:"
echo "   sudo nano /opt/cryptomaltese/.env"
echo ""
echo "   Add these required variables:"
echo "   DATABASE_URL=postgresql://user:password@host:port/database"
echo "   ETHERSCAN_API_KEY=your_etherscan_api_key"
echo "   LOG_LEVEL=INFO"
echo ""
echo "2. Start the service:"
echo "   sudo systemctl start $SERVICE_NAME"
echo ""
echo "3. Check service status:"
echo "   sudo systemctl status $SERVICE_NAME"
echo ""
echo "4. View logs:"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "5. Test health endpoint:"
echo "   curl http://localhost:8000/health"
echo ""
echo "🎉 Deployment script completed successfully!"
