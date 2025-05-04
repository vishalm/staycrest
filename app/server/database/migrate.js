const path = require('path');
const fs = require('fs');
const { pool } = require('./connection');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/migrations.log' })
  ],
});

/**
 * Create migrations table if it doesn't exist
 */
async function ensureMigrationsTable() {
  const client = await pool.connect();
  try {
    // Check if migrations table exists
    const tableExists = await client.query(`
      SELECT to_regclass('public.migrations');
    `);
    
    if (!tableExists.rows[0].to_regclass) {
      logger.info('Creating migrations table');
      
      await client.query(`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
    }
  } catch (error) {
    logger.error(`Error creating migrations table: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  try {
    const { rows } = await pool.query(`
      SELECT name FROM migrations ORDER BY id
    `);
    
    return rows.map(row => row.name);
  } catch (error) {
    logger.error(`Error getting applied migrations: ${error.message}`);
    throw error;
  }
}

/**
 * Get list of migration files
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort();
}

/**
 * Run migrations up to latest
 */
async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    
    // Get all migration files
    const migrationFiles = getMigrationFiles();
    
    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(
      file => !appliedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to apply');
      await client.query('COMMIT');
      return;
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);
    
    // Apply each pending migration
    for (const migrationFile of pendingMigrations) {
      logger.info(`Applying migration: ${migrationFile}`);
      
      const migration = require(path.join(__dirname, 'migrations', migrationFile));
      
      await migration.up();
      
      // Record migration
      await client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [migrationFile]
      );
      
      logger.info(`Migration applied: ${migrationFile}`);
    }
    
    await client.query('COMMIT');
    logger.info('All migrations applied successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Migration failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Roll back the latest migration
 */
async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get the latest applied migration
    const { rows } = await client.query(`
      SELECT id, name FROM migrations 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (rows.length === 0) {
      logger.info('No migrations to roll back');
      await client.query('COMMIT');
      return;
    }
    
    const latestMigration = rows[0];
    logger.info(`Rolling back migration: ${latestMigration.name}`);
    
    // Run the down function
    const migration = require(path.join(__dirname, 'migrations', latestMigration.name));
    
    await migration.down();
    
    // Remove the migration record
    await client.query(
      'DELETE FROM migrations WHERE id = $1',
      [latestMigration.id]
    );
    
    await client.query('COMMIT');
    logger.info(`Migration rolled back: ${latestMigration.name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Rollback failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Command-line interface
async function main() {
  try {
    const command = process.argv[2];
    
    switch (command) {
      case 'up':
        await runMigrations();
        break;
      case 'down':
        await rollbackMigration();
        break;
      default:
        console.log('Usage: node migrate.js [up|down]');
        process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error(`Migration command failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  rollbackMigration
}; 