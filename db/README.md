# Database Setup Guide

This guide will help you set up the PostgreSQL database for the Crypto-Sentinel application.

## 🗄️ Database Requirements

- **Database**: PostgreSQL 12 or higher
- **Extensions**: `uuid-ossp` (for UUID generation)
- **Connection**: Via connection string or individual parameters

## 🚀 Quick Setup

### Option 1: Using Docker (Recommended)

1. **Install Docker** if you haven't already
2. **Run PostgreSQL container**:
   ```bash
   docker run --name crypto-sentinel-db \
     -e POSTGRES_DB=crypto_sentinel \
     -e POSTGRES_USER=crypto_user \
     -e POSTGRES_PASSWORD=your_secure_password \
     -p 5432:5432 \
     -d postgres:15
   ```

3. **Create database schema**:
   ```bash
   # Connect to the database
   docker exec -it crypto-sentinel-db psql -U crypto_user -d crypto_sentinel
   
   # Or run the schema file directly
   docker exec -i crypto-sentinel-db psql -U crypto_user -d crypto_sentinel < schema.sql
   docker exec -i crypto-sentinel-db psql -U crypto_user -d crypto_sentinel < migrate_analysis_table.sql
   ```

### Option 2: Local PostgreSQL Installation

1. **Install PostgreSQL**:
   ```bash
   # macOS (using Homebrew)
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   
   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create database and user**:
   ```bash
   # Connect as postgres user
   sudo -u postgres psql
   
   # Create database and user
   CREATE DATABASE crypto_sentinel;
   CREATE USER crypto_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE crypto_sentinel TO crypto_user;
   \q
   ```

3. **Run schema scripts**:
   ```bash
   psql -U crypto_user -d crypto_sentinel -f schema.sql
   psql -U crypto_user -d crypto_sentinel -f migrate_analysis_table.sql
   ```

### Option 3: Cloud Database (Production)

For production deployment, consider using:
- **Supabase** (PostgreSQL with additional features)
- **AWS RDS** (Managed PostgreSQL)
- **Google Cloud SQL** (Managed PostgreSQL)
- **DigitalOcean Managed Databases**

## 🔧 Environment Configuration

Create a `.env.local` file in the `user-interface` directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://crypto_user:your_secure_password@localhost:5432/crypto_sentinel

# Alternative: Individual parameters
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=crypto_sentinel
# DB_USER=crypto_user
# DB_PASSWORD=your_secure_password

# External APIs
ETHERSCAN_API_KEY=your_etherscan_api_key
CLAUDE_API_KEY=your_claude_api_key

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📊 Database Schema

The application uses the following tables:

### 1. `incidents` - Incident Reports
```sql
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    description TEXT NOT NULL,
    discovered_at TIMESTAMP NOT NULL,
    tx_hash VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    report_status VARCHAR NOT NULL CHECK (report_status IN ('pending', 'complete', 'error'))
);
```

### 2. `api_cache` - API Response Caching
```sql
CREATE TABLE api_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);
```

### 3. `reports` - Generated Reports
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    pdf_url VARCHAR NOT NULL,
    summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4. `incident_data` - Incident Analysis Data
```sql
CREATE TABLE incident_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 5. `analysis` - Fund Flow Analysis Results
```sql
CREATE TABLE analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 🔍 Verification

After setup, verify the database is working:

```bash
# Connect to database
psql -U crypto_user -d crypto_sentinel

# List tables
\dt

# Check table structure
\d incidents
\d analysis

# Test connection from application
cd user-interface
npm run dev
```

## 🛠️ Troubleshooting

### Common Issues

1. **Connection refused**:
   - Check if PostgreSQL is running
   - Verify port 5432 is not blocked
   - Check firewall settings

2. **Authentication failed**:
   - Verify username/password in DATABASE_URL
   - Check pg_hba.conf configuration
   - Ensure user has proper permissions

3. **UUID extension missing**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

4. **Permission denied**:
   ```sql
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crypto_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crypto_user;
   ```

### Reset Database

To completely reset the database:

```bash
# Drop and recreate
psql -U crypto_user -d postgres -c "DROP DATABASE IF EXISTS crypto_sentinel;"
psql -U crypto_user -d postgres -c "CREATE DATABASE crypto_sentinel;"

# Re-run schema
psql -U crypto_user -d crypto_sentinel -f schema.sql
psql -U crypto_user -d crypto_sentinel -f migrate_analysis_table.sql
```

## 📈 Performance Optimization

For production environments:

1. **Add indexes**:
   ```sql
   CREATE INDEX idx_incidents_wallet_address ON incidents(wallet_address);
   CREATE INDEX idx_incidents_created_at ON incidents(created_at);
   CREATE INDEX idx_api_cache_expires_at ON api_cache(expires_at);
   ```

2. **Configure connection pooling**:
   ```typescript
   // In db/client.ts
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20, // Maximum number of clients
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

3. **Enable query logging** (development only):
   ```sql
   ALTER SYSTEM SET log_statement = 'all';
   SELECT pg_reload_conf();
   ```

## 🔒 Security Considerations

1. **Use strong passwords**
2. **Limit database access** to application servers only
3. **Enable SSL connections** in production
4. **Regular backups** of your database
5. **Monitor database logs** for suspicious activity

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your PostgreSQL installation
3. Check application logs for detailed error messages
4. Ensure all environment variables are properly set 