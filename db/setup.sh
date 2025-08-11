#!/bin/bash

# Crypto-Sentinel Database Setup Script
# This script helps you set up the PostgreSQL database for the application

set -e  # Exit on any error

echo "🚀 Crypto-Sentinel Database Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if PostgreSQL is installed
check_postgres() {
    if command -v psql &> /dev/null; then
        print_status "PostgreSQL is installed"
        return 0
    else
        print_error "PostgreSQL is not installed"
        echo "Please install PostgreSQL first:"
        echo "  macOS: brew install postgresql"
        echo "  Ubuntu: sudo apt install postgresql postgresql-contrib"
        echo "  Windows: Download from https://www.postgresql.org/download/windows/"
        return 1
    fi
}

# Check if Docker is available
check_docker() {
    if command -v docker &> /dev/null; then
        print_status "Docker is available"
        return 0
    else
        print_warning "Docker is not available"
        return 1
    fi
}

# Setup database using Docker
setup_docker() {
    echo ""
    echo "🐳 Setting up database with Docker..."
    
    # Check if container already exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "crypto-sentinel-db"; then
        print_warning "Database container already exists"
        read -p "Do you want to remove the existing container and create a new one? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker stop crypto-sentinel-db 2>/dev/null || true
            docker rm crypto-sentinel-db 2>/dev/null || true
        else
            print_status "Using existing container"
            return 0
        fi
    fi
    
    # Get database credentials
    read -p "Enter database password (default: crypto123): " DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-crypto123}
    
    # Run PostgreSQL container
    docker run --name crypto-sentinel-db \
        -e POSTGRES_DB=crypto_sentinel \
        -e POSTGRES_USER=crypto_user \
        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
        -p 5432:5432 \
        -d postgres:15
    
    print_status "PostgreSQL container started"
    
    # Wait for database to be ready
    echo "⏳ Waiting for database to be ready..."
    sleep 5
    
    # Run schema scripts
    echo "📊 Creating database schema..."
    docker exec -i crypto-sentinel-db psql -U crypto_user -d crypto_sentinel < schema.sql
    docker exec -i crypto-sentinel-db psql -U crypto_user -d crypto_sentinel < migrate_analysis_table.sql
    
    print_status "Database schema created successfully"
    
    # Create .env.local file
    create_env_file "postgresql://crypto_user:$DB_PASSWORD@localhost:5432/crypto_sentinel"
}

# Setup database using local PostgreSQL
setup_local() {
    echo ""
    echo "💻 Setting up database with local PostgreSQL..."
    
    # Get database credentials
    read -p "Enter database user (default: crypto_user): " DB_USER
    DB_USER=${DB_USER:-crypto_user}
    
    read -p "Enter database password: " DB_PASSWORD
    if [ -z "$DB_PASSWORD" ]; then
        print_error "Database password is required"
        exit 1
    fi
    
    # Create database and user
    echo "🔧 Creating database and user..."
    sudo -u postgres psql -c "CREATE DATABASE crypto_sentinel;" 2>/dev/null || print_warning "Database already exists"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || print_warning "User already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crypto_sentinel TO $DB_USER;"
    
    # Run schema scripts
    echo "📊 Creating database schema..."
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d crypto_sentinel -f schema.sql
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d crypto_sentinel -f migrate_analysis_table.sql
    
    print_status "Database schema created successfully"
    
    # Create .env.local file
    create_env_file "postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/crypto_sentinel"
}

# Create .env.local file
create_env_file() {
    local DATABASE_URL="$1"
    local ENV_FILE="../user-interface/.env.local"
    
    echo "🔧 Creating environment file..."
    
    cat > "$ENV_FILE" << EOF
# Database Configuration
DATABASE_URL=$DATABASE_URL

# External APIs (Add your API keys)
ETHERSCAN_API_KEY=your_etherscan_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    
    print_status "Environment file created: $ENV_FILE"
    print_warning "Please update the API keys in $ENV_FILE"
}

# Verify database setup
verify_setup() {
    echo ""
    echo "🔍 Verifying database setup..."
    
    # Try to connect to database
    if PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d crypto_sentinel -c "\dt" > /dev/null 2>&1; then
        print_status "Database connection successful"
        
        # Check if tables exist
        TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d crypto_sentinel -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
        
        if [ "$TABLE_COUNT" -ge 5 ]; then
            print_status "All tables created successfully ($TABLE_COUNT tables found)"
        else
            print_warning "Some tables may be missing ($TABLE_COUNT tables found)"
        fi
    else
        print_error "Database connection failed"
        return 1
    fi
}

# Main setup function
main() {
    echo "Choose your setup method:"
    echo "1. Docker (Recommended - easiest)"
    echo "2. Local PostgreSQL installation"
    echo "3. Exit"
    
    read -p "Enter your choice (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            if check_docker; then
                setup_docker
                verify_setup
            else
                print_error "Docker is required for this option"
                exit 1
            fi
            ;;
        2)
            if check_postgres; then
                setup_local
                verify_setup
            else
                exit 1
            fi
            ;;
        3)
            echo "Setup cancelled"
            exit 0
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    echo ""
    print_status "Database setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update API keys in user-interface/.env.local"
    echo "2. Install dependencies: cd user-interface && npm install"
    echo "3. Start the application: npm run dev"
    echo ""
    echo "For more information, see db/README.md"
}

# Run main function
main "$@" 