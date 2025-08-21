#!/usr/bin/env python3
"""
Database initialization script for Graph Mapping Service.

This script creates all required tables and sample data for development.
It reads the database connection string from .env.local or environment variables.
"""

import os
import sys
import asyncio
import asyncpg
from pathlib import Path


def get_database_url():
    """Get database URL from environment variables."""
    # Try to load from .env.local first
    project_root = Path(__file__).parent.parent
    env_local_path = project_root / ".env.local"
    
    database_url = None
    
    if env_local_path.exists():
        with open(env_local_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL=') and not line.startswith('#'):
                    database_url = line.split('=', 1)[1]
                    break
    
    # Fallback to environment variable
    if not database_url:
        database_url = os.getenv('DATABASE_URL')
    
    # Default fallback (update this with your remote server details)
    if not database_url:
        database_url = "postgresql://username:password@your-db-server.com:5432/cryptomaltese_incidents"
    
    return database_url


async def run_sql_file(connection, sql_file_path):
    """Execute SQL file against the database."""
    try:
        with open(sql_file_path, 'r') as f:
            sql_content = f.read()
        
        # Execute the SQL (asyncpg will handle multiple statements)
        await connection.execute(sql_content)
        print(f"✅ Successfully executed {sql_file_path}")
        
    except FileNotFoundError:
        print(f"❌ SQL file not found: {sql_file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error executing SQL: {e}")
        sys.exit(1)


async def test_connection(database_url):
    """Test database connection."""
    try:
        connection = await asyncpg.connect(database_url)
        await connection.fetchval("SELECT 1")
        await connection.close()
        print("✅ Database connection test successful")
        return True
    except asyncpg.InvalidCatalogNameError:
        print("❌ Database does not exist. Please create it first:")
        print("   CREATE DATABASE cryptomaltese_incidents;")
        return False
    except asyncpg.InvalidPasswordError:
        print("❌ Invalid database credentials")
        return False
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


async def main():
    """Main initialization function."""
    print("🚀 Initializing Graph Mapping Service Database")
    print("=" * 50)
    
    # Get database URL
    database_url = get_database_url()
    print(f"📊 Database URL: {database_url}")
    
    # Test connection
    if not await test_connection(database_url):
        sys.exit(1)
    
    # Connect to database
    try:
        connection = await asyncpg.connect(database_url)
        print("🔌 Connected to database successfully")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)
    
    try:
        # Run bootstrap SQL
        sql_file_path = Path(__file__).parent / "db_bootstrap.sql"
        await run_sql_file(connection, sql_file_path)
        
        # Verify tables were created
        tables = await connection.fetch("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('incidents', 'transaction_details', 'graph_nodes', 'graph_edges', 'incident_graphs')
            ORDER BY table_name;
        """)
        
        print("\n📋 Created tables:")
        for table in tables:
            print(f"   ✓ {table['table_name']}")
        
        # Check for sample data
        incident_count = await connection.fetchval("SELECT COUNT(*) FROM incidents")
        print(f"\n📊 Sample incidents in database: {incident_count}")
        
        print("\n🎉 Database initialization completed successfully!")
        print("\nNext steps:")
        print("1. Update .env.local with your actual Etherscan API key")
        print("2. Run the service: ./scripts/run_local.sh")
        print("3. Test the health endpoint: curl http://localhost:8000/health")
        
    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        sys.exit(1)
        
    finally:
        await connection.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Initialization cancelled by user")
        sys.exit(1)
