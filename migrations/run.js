const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const config = require('../config')

async function runMigrations() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
  })

  try {
    console.log('Starting database migrations...')
    
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get list of executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT filename FROM migrations ORDER BY executed_at'
    )
    const executedFilenames = executedMigrations.map(row => row.filename)

    // Get list of migration files
    const migrationsDir = __dirname
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    console.log(`Found ${migrationFiles.length} migration files`)

    // Execute pending migrations
    let executedCount = 0
    for (const filename of migrationFiles) {
      if (executedFilenames.includes(filename)) {
        console.log(`⏭️  Skipping already executed migration: ${filename}`)
        continue
      }

      console.log(`🔄 Executing migration: ${filename}`)
      
      const filePath = path.join(migrationsDir, filename)
      const sql = fs.readFileSync(filePath, 'utf8')
      
      // Execute migration in a transaction
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        )
        await client.query('COMMIT')
        console.log(`✅ Successfully executed migration: ${filename}`)
        executedCount++
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`❌ Failed to execute migration: ${filename}`)
        throw error
      } finally {
        client.release()
      }
    }

    if (executedCount === 0) {
      console.log('✅ All migrations are up to date')
    } else {
      console.log(`✅ Successfully executed ${executedCount} migrations`)
    }

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

module.exports = { runMigrations }
