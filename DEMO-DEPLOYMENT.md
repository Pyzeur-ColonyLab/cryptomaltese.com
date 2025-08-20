# CryptoMaltese Demo Deployment Guide

## Quick Setup (5-10 minutes)

### 1. Create Infomaniak VPS Instance
- **Recommended**: Public Cloud VPS Small (1 vCPU, 2 GB RAM, 40 GB SSD) - ~14 CHF/month
- **Budget Option**: Public Cloud VPS Micro (1 vCPU, 1 GB RAM, 20 GB SSD) - ~7 CHF/month
- **OS**: Ubuntu 22.04 LTS

### 2. Initial Server Setup
```bash
# Connect to your server
ssh root@your-server-ip

# Download and run deployment script
wget https://raw.githubusercontent.com/Pyzeur-ColonyLab/cryptomaltese.com/master/deploy-demo.sh
chmod +x deploy-demo.sh
./deploy-demo.sh
```

### 3. Post-Deployment Configuration

#### A. Get Etherscan API Key (Free)
1. Visit: https://etherscan.io/apis
2. Create free account
3. Generate API key
4. Update on server:
```bash
cd /opt/cryptomaltese.com
nano .env
# Replace 'your_etherscan_api_key_here' with your actual key
pm2 restart cryptomaltese-api
```

#### B. Setup Domain (Optional)
1. Point your domain to server IP
2. Update nginx config:
```bash
sudo nano /etc/nginx/sites-available/cryptomaltese
# Replace 'your-domain.com' with your actual domain
sudo systemctl restart nginx
```

#### C. Enable HTTPS (Recommended)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

## Demo Access

- **Frontend**: http://your-server-ip or http://your-domain.com
- **API Health**: http://your-server-ip:3000/health
- **API Docs**: Available in `/docs` folder

## Demo Features

✅ **Working Features**:
- Incident reporting form
- Etherscan transaction lookup
- PostgreSQL data storage
- RESTful API endpoints
- Responsive web interface

## Management Commands

```bash
# Check application status
pm2 status

# View real-time logs
pm2 logs cryptomaltese-api

# Restart application
pm2 restart cryptomaltese-api

# Update application
cd /opt/cryptomaltese.com
git pull origin master
npm install --production
pm2 restart cryptomaltese-api

# Check database
sudo -u postgres psql cryptomaltese_demo
```

## Monitoring & Troubleshooting

### Check Services
```bash
# Check if services are running
sudo systemctl status nginx
sudo systemctl status postgresql
pm2 status

# Check ports
sudo netstat -tlnp | grep -E ':(80|3000|5432)'
```

### View Logs
```bash
# Application logs
pm2 logs cryptomaltese-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

## Resource Usage (Expected)

### VPS Small (Recommended)
- **CPU**: ~10-20% under normal demo load
- **RAM**: ~1.2-1.5 GB used
- **Storage**: ~5-10 GB used
- **Can handle**: 50-100 concurrent demo users

### VPS Micro (Budget)
- **CPU**: ~20-40% under normal demo load  
- **RAM**: ~800MB-1GB used (tight but workable)
- **Storage**: ~5-10 GB used
- **Can handle**: 10-30 concurrent demo users

## Cost Breakdown

### Monthly Costs:
- **VPS Small**: ~14 CHF/month
- **VPS Micro**: ~7 CHF/month
- **Domain** (optional): ~10-15 CHF/year
- **SSL Certificate**: Free (Let's Encrypt)

**Total Demo Cost**: 7-14 CHF/month (~$8-15 USD)

## Demo Limitations

⚠️ **Note**: This is optimized for demonstration purposes:
- Single server (no redundancy)
- Basic security setup
- Limited scalability
- Suitable for proof-of-concept and demos

For production use, consider the full architecture we discussed earlier with separate database servers and load balancing.
