#!/bin/bash

# CryptoMaltese Database Server Setup
# For dedicated PostgreSQL instance

set -e

echo "🗄️ Setting up CryptoMaltese Database Server..."

# Get app server IP (you'll need to update this)
read -p "Enter App Server IP address: " APP_SERVER_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Setup attached volume for data
echo "💾 Setting up data volume..."
# Check if volume is attached
if [ -b /dev/sdb ]; then
    echo "Volume detected at /dev/sdb"
    
    # Format volume if not already formatted
    if ! sudo blkid /dev/sdb; then
        sudo mkfs.ext4 /dev/sdb
    fi
    
    # Stop PostgreSQL
    sudo systemctl stop postgresql
    
    # Create mount point and backup existing data
    sudo mkdir -p /mnt/pgdata
    sudo mount /dev/sdb /mnt/pgdata
    
    # Move PostgreSQL data to volume
    sudo rsync -av /var/lib/postgresql/ /mnt/pgdata/
    
    # Update fstab for permanent mount
    echo "/dev/sdb /var/lib/postgresql ext4 defaults 0 2" | sudo tee -a /etc/fstab
    
    # Remount to new location
    sudo umount /mnt/pgdata
    sudo mount /dev/sdb /var/lib/postgresql
    
    # Fix permissions
    sudo chown -R postgres:postgres /var/lib/postgresql
    sudo chmod 750 /var/lib/postgresql
else
    echo "⚠️ No volume detected. Using system disk for data."
fi

# Configure PostgreSQL for remote connections
echo "⚙️ Configuring PostgreSQL..."

# Update postgresql.conf
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf

# Update pg_hba.conf for app server access
echo "host    cryptomaltese_demo    cryptodemo    $APP_SERVER_IP/32    md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "👤 Creating database and user..."
sudo -u postgres psql -c "CREATE DATABASE cryptomaltese_demo;"
sudo -u postgres psql -c "CREATE USER cryptodemo WITH PASSWORD 'DemoSecure2024!@#';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cryptomaltese_demo TO cryptodemo;"
sudo -u postgres psql -c "ALTER USER cryptodemo CREATEDB;"

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow from $APP_SERVER_IP to any port 5432
sudo ufw --force enable

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

# Show connection info
echo "✅ Database server setup completed!"
echo ""
echo "📋 Connection Details:"
echo "Host: $(curl -s ifconfig.me)"
echo "Port: 5432"
echo "Database: cryptomaltese_demo"
echo "Username: cryptodemo"
echo "Password: DemoSecure2024!@#"
echo ""
echo "🔗 Connection String:"
echo "postgresql://cryptodemo:DemoSecure2024!@#@$(curl -s ifconfig.me):5432/cryptomaltese_demo"
echo ""
echo "🔧 Management commands:"
echo "- Connect to DB: sudo -u postgres psql cryptomaltese_demo"
echo "- Check status: sudo systemctl status postgresql"
echo "- View logs: sudo tail -f /var/log/postgresql/postgresql-*-main.log"
