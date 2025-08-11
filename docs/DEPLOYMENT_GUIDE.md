# Crypto-Sentinel Deployment Guide

## Overview

This guide covers deploying Crypto-Sentinel to production environments, including server setup, database configuration, and monitoring.

## Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ recommended
- **Storage**: 50GB+ SSD
- **Network**: Stable internet connection for API calls

### Software Requirements
- **Node.js**: 18.x or higher
- **PostgreSQL**: 12.x or higher
- **Nginx**: For reverse proxy and SSL termination
- **PM2**: For process management
- **Certbot**: For SSL certificates

## Installation Steps

### 1. Server Setup

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Node.js
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### Install PM2
```bash
sudo npm install -g pm2
```

### 2. Application Setup

#### Clone Repository
```bash
cd /opt
sudo git clone <repository-url> crypto-sentinel
sudo chown -R $USER:$USER crypto-sentinel
cd crypto-sentinel
```

#### Install Dependencies
```bash
cd user-interface
npm install --production
```

#### Set Up Environment Variables
```bash
cp .env.example .env.production
nano .env.production
```

Configure the following variables:
```env
# Database
DATABASE_URL=postgresql://crypto_user:secure_password@localhost:5432/crypto_sentinel

# External APIs
ETHERSCAN_API_KEY=your_production_etherscan_key
CLAUDE_API_KEY=your_production_claude_key

# Application
NODE_ENV=production
PORT=3000
HOSTNAME=your-domain.com

# Security
SESSION_SECRET=your_secure_session_secret
COOKIE_SECRET=your_secure_cookie_secret

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/crypto-sentinel/app.log
```

### 3. Database Setup

#### Create Database User
```bash
sudo -u postgres psql
```

```sql
CREATE USER crypto_user WITH PASSWORD 'secure_password';
CREATE DATABASE crypto_sentinel OWNER crypto_user;
GRANT ALL PRIVILEGES ON DATABASE crypto_sentinel TO crypto_user;
\q
```

#### Run Database Migrations
```bash
cd /opt/crypto-sentinel/db
psql -U crypto_user -d crypto_sentinel -f schema.sql
psql -U crypto_user -d crypto_sentinel -f migrate_analysis_table.sql
```

#### Configure PostgreSQL
```bash
sudo nano /etc/postgresql/12/main/postgresql.conf
```

Add/modify these settings:
```conf
# Performance
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Logging
log_statement = 'all'
log_duration = on
log_connections = on
log_disconnections = on

# Security
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'
```

```bash
sudo nano /etc/postgresql/12/main/pg_hba.conf
```

Add this line for local connections:
```conf
local   crypto_sentinel    crypto_user                     md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 4. Application Configuration

#### Build Application
```bash
cd /opt/crypto-sentinel/user-interface
npm run build
```

#### Create PM2 Configuration
```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'crypto-sentinel',
    script: 'npm',
    args: 'start',
    cwd: '/opt/crypto-sentinel/user-interface',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    log_file: '/var/log/crypto-sentinel/combined.log',
    out_file: '/var/log/crypto-sentinel/out.log',
    error_file: '/var/log/crypto-sentinel/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### Create Log Directory
```bash
sudo mkdir -p /var/log/crypto-sentinel
sudo chown -R $USER:$USER /var/log/crypto-sentinel
```

#### Start Application
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Nginx Configuration

#### Create Nginx Site Configuration
```bash
sudo nano /etc/nginx/sites-available/crypto-sentinel
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
    
    # Client Max Body Size
    client_max_body_size 10M;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Static Files
    location /_next/static/ {
        alias /opt/crypto-sentinel/user-interface/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location /static/ {
        alias /opt/crypto-sentinel/user-interface/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API Rate Limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # General Rate Limiting
    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health Check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

#### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/crypto-sentinel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Certificate

#### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

#### Obtain SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

#### Set Up Auto-Renewal
```bash
sudo crontab -e
```

Add this line:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

### 7. Monitoring Setup

#### Install Monitoring Tools
```bash
# Install htop for system monitoring
sudo apt install htop -y

# Install logrotate for log management
sudo apt install logrotate -y
```

#### Configure Log Rotation
```bash
sudo nano /etc/logrotate.d/crypto-sentinel
```

```
/var/log/crypto-sentinel/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### Set Up PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
```

### 8. Backup Strategy

#### Database Backup Script
```bash
nano /opt/crypto-sentinel/scripts/backup.sh
```

```bash
#!/bin/bash

# Configuration
DB_NAME="crypto_sentinel"
DB_USER="crypto_user"
BACKUP_DIR="/opt/backups/crypto-sentinel"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

#### Make Script Executable
```bash
chmod +x /opt/crypto-sentinel/scripts/backup.sh
```

#### Set Up Daily Backups
```bash
crontab -e
```

Add this line:
```
0 2 * * * /opt/crypto-sentinel/scripts/backup.sh
```

## Security Considerations

### Firewall Configuration
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Database Security
- Use strong passwords
- Limit database access to localhost
- Regular security updates
- Monitor for suspicious activity

### Application Security
- Keep Node.js and dependencies updated
- Use environment variables for sensitive data
- Implement rate limiting
- Regular security audits

## Performance Optimization

### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_analysis_incident_id ON analysis(incident_id);
CREATE INDEX idx_analysis_created_at ON analysis(created_at);

-- Analyze tables for query optimization
ANALYZE incidents;
ANALYZE analysis;
```

### Application Optimization
- Use PM2 cluster mode for load balancing
- Implement caching strategies
- Monitor memory usage
- Optimize API calls

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs crypto-sentinel

# Check environment variables
pm2 env crypto-sentinel

# Restart application
pm2 restart crypto-sentinel
```

#### Database Connection Issues
```bash
# Test database connection
psql -U crypto_user -d crypto_sentinel -c "SELECT 1;"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-12-main.log
```

#### Nginx Issues
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### Monitoring Commands
```bash
# Check application status
pm2 status

# Monitor system resources
htop

# Check disk space
df -h

# Check memory usage
free -h

# Monitor logs
tail -f /var/log/crypto-sentinel/combined.log
```

## Maintenance

### Regular Tasks
- **Daily**: Check application logs for errors
- **Weekly**: Review performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Full system audit and optimization

### Update Process
```bash
# Pull latest changes
cd /opt/crypto-sentinel
git pull origin main

# Install dependencies
cd user-interface
npm install

# Build application
npm run build

# Restart application
pm2 restart crypto-sentinel
```

## Support

For deployment support:
- Check the troubleshooting section
- Review logs for specific error messages
- Contact the development team with detailed error information
- Provide system specifications and configuration details 