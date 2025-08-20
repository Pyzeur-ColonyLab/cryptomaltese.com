#!/bin/bash

# CryptoMaltese Application Server Setup
# For Node.js API + Nginx + Static Files

set -e

echo "🚀 Setting up CryptoMaltese Application Server..."

# Get database server IP
read -p "Enter Database Server IP address: " DB_SERVER_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "📦 Installing dependencies..."
sudo apt install -y nodejs npm nginx git curl

# Install PM2 for process management
sudo npm install -g pm2

# Clone and setup application
echo "📥 Cloning application..."
cd /opt
sudo git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
sudo chown -R $USER:$USER /opt/cryptomaltese.com
cd /opt/cryptomaltese.com

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install --production

# Create environment file
echo "⚙️ Creating environment configuration..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://cryptodemo:DemoSecure2024!@#@$DB_SERVER_IP:5432/cryptomaltese_demo
ETHERSCAN_API_KEY=your_etherscan_api_key_here
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
EOF

# Test database connection
echo "🔍 Testing database connection..."
node -e "
const { Client } = require('pg');
const client = new Client('postgresql://cryptodemo:DemoSecure2024!@#@$DB_SERVER_IP:5432/cryptomaltese_demo');
client.connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    client.end();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
" || echo "⚠️ Database connection test failed. Please check DB server setup."

# Run database migrations
echo "🔄 Running database migrations..."
npm run migrate

# Setup Nginx as reverse proxy
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/cryptomaltese << EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Serve static files
    location / {
        root /opt/cryptomaltese.com/client;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

# Enable site and remove default
sudo ln -sf /etc/nginx/sites-available/cryptomaltese /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'cryptomaltese-api',
    script: 'server/app.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting application..."
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Setup firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Display server info
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "✅ Application server setup completed!"
echo ""
echo "📋 Access Information:"
echo "Frontend: http://$SERVER_IP"
echo "API Health: http://$SERVER_IP/health"
echo "Server IP: $SERVER_IP"
echo ""
echo "📝 Next Steps:"
echo "1. Get Etherscan API key: https://etherscan.io/apis"
echo "2. Update API key in .env file:"
echo "   nano /opt/cryptomaltese.com/.env"
echo "   pm2 restart cryptomaltese-api"
echo ""
echo "3. Setup domain (optional):"
echo "   - Point domain to: $SERVER_IP"
echo "   - Update nginx config with your domain"
echo "   - Setup SSL: sudo certbot --nginx"
echo ""
echo "🔧 Management commands:"
echo "- Check status: pm2 status"
echo "- View logs: pm2 logs cryptomaltese-api"
echo "- Restart: pm2 restart cryptomaltese-api"
echo "- Update app: cd /opt/cryptomaltese.com && git pull && npm install --production && pm2 restart cryptomaltese-api"
