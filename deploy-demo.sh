#!/bin/bash

# CryptoMaltese Demo Deployment Script
# For single server setup on Infomaniak VPS

set -e

echo "🚀 Setting up CryptoMaltese Demo Environment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "📦 Installing dependencies..."
sudo apt install -y nodejs npm postgresql postgresql-contrib nginx git curl

# Install PM2 for process management
sudo npm install -g pm2

# Setup PostgreSQL
echo "🗄️ Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE cryptomaltese_demo;"
sudo -u postgres psql -c "CREATE USER cryptodemo WITH PASSWORD 'demo123!@#';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cryptomaltese_demo TO cryptodemo;"

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
DATABASE_URL=postgresql://cryptodemo:demo123!@#@localhost:5432/cryptomaltese_demo
ETHERSCAN_API_KEY=your_etherscan_api_key_here
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
EOF

# Run database migrations
echo "🔄 Running database migrations..."
npm run migrate

# Setup Nginx as reverse proxy
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/cryptomaltese << EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Serve static files
    location / {
        root /opt/cryptomaltese.com/client;
        try_files \$uri \$uri/ /index.html;
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
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cryptomaltese /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Start application with PM2
echo "🚀 Starting application..."
pm2 start server/app.js --name cryptomaltese-api
pm2 startup
pm2 save

# Setup firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ Demo deployment completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Update your domain DNS to point to this server"
echo "2. Get Etherscan API key and update .env file"
echo "3. Setup SSL certificate with: sudo certbot --nginx"
echo "4. Your demo will be available at: http://your-domain.com"
echo ""
echo "🔧 Management commands:"
echo "- Check API status: pm2 status"
echo "- View logs: pm2 logs cryptomaltese-api"
echo "- Restart API: pm2 restart cryptomaltese-api"
