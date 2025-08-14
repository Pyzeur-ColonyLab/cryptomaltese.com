#!/bin/bash

# Database setup script for Crypto-Sentinel
# This script sets up the database with all required tables and functions

echo "Setting up Crypto-Sentinel database..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "Error: PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Database configuration
DB_NAME="crypto_sentinel"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Create database if it doesn't exist
echo "Creating database $DB_NAME if it doesn't exist..."
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || echo "Database $DB_NAME already exists"

# Run schema creation
echo "Creating database schema..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql

# Run migrations
echo "Running migrations..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrate_analysis_table.sql
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrate_enhanced_fund_flow.sql

# Create indexes for performance
echo "Creating performance indexes..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
-- Additional indexes for block-aware analysis
CREATE INDEX IF NOT EXISTS idx_promise_paths_block_progression ON promise_paths USING GIN(block_progression);
CREATE INDEX IF NOT EXISTS idx_promise_paths_promise_score ON promise_paths(promise_score);
CREATE INDEX IF NOT EXISTS idx_promise_paths_temporal_validity ON promise_paths(is_temporally_valid);
CREATE INDEX IF NOT EXISTS idx_path_block_tracking_minimum_block ON path_block_tracking(minimum_block_threshold);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_block_numbers ON detected_patterns USING GIN(block_numbers);
CREATE INDEX IF NOT EXISTS idx_block_filter_metrics_filter_efficiency ON block_filter_metrics(filter_efficiency);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_promise_paths_analysis_depth ON promise_paths(analysis_id, depth_level);
CREATE INDEX IF NOT EXISTS idx_path_block_tracking_analysis_depth ON path_block_tracking(analysis_id, depth_level);
CREATE INDEX IF NOT EXISTS idx_block_filter_metrics_analysis_depth ON block_filter_metrics(analysis_id, depth_level);
EOF

# Verify setup
echo "Verifying database setup..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

echo "Database setup complete!"
echo ""
echo "Tables created:"
echo "- incidents (with hack_block_number)"
echo "- fund_flow_analysis (microservice-ready)"
echo "- transaction_paths (for microservice results)"
echo "- address_analysis (for microservice results)"
echo "- detected_patterns (for microservice results)"
echo "- analysis_progress (microservice progress tracking)"
echo "- microservice_log (communication logging)"
echo ""
echo "Next steps:"
echo "1. Update your .env file with microservice configuration"
echo "2. Start the Python microservice: cd python-service && python main.py"
echo "3. Start the Next.js app: cd user-interface && npm run dev"
echo "4. Or use Docker Compose: docker-compose up" 