const { pool } = require('../connection');
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

const up = async () => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');

    logger.info('Starting database migration: initial schema');

    // Create extension for UUID generation
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create enum types
    await client.query(`
      CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');
      CREATE TYPE loyalty_tier AS ENUM ('basic', 'silver', 'gold', 'platinum');
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'user',
        is_verified BOOLEAN NOT NULL DEFAULT false,
        google_id VARCHAR(255) UNIQUE,
        facebook_id VARCHAR(255) UNIQUE,
        apple_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
      CREATE INDEX idx_users_facebook_id ON users(facebook_id) WHERE facebook_id IS NOT NULL;
      CREATE INDEX idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL;
      CREATE INDEX idx_users_first_last_name ON users(first_name, last_name);
    `);

    // If there's a user_roles enum, update it:
    await client.query(`
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin' AFTER 'admin'
    `);

    // Create loyalty_accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        program_id VARCHAR(100) NOT NULL,
        program_name VARCHAR(255) NOT NULL,
        membership_id VARCHAR(100) NOT NULL,
        tier loyalty_tier NOT NULL DEFAULT 'basic',
        points INTEGER,
        last_updated TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, program_id)
      );

      CREATE INDEX idx_loyalty_accounts_user_id ON loyalty_accounts(user_id);
    `);

    // Create conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX idx_conversations_session_id ON conversations(session_id);
      CREATE INDEX idx_conversations_is_active ON conversations(is_active);
      CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
    `);

    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX idx_messages_timestamp ON messages(timestamp);
    `);

    // Create search_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        parameters JSONB NOT NULL,
        loyalty_programs TEXT[] NOT NULL DEFAULT '{}',
        is_saved BOOLEAN NOT NULL DEFAULT false,
        saved_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_search_history_user_id ON search_history(user_id);
      CREATE INDEX idx_search_history_created_at ON search_history(created_at DESC);
      CREATE INDEX idx_search_history_is_saved ON search_history(is_saved);
    `);

    // Create configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS configurations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        preferred_loyalty_programs TEXT[] NOT NULL DEFAULT '{}',
        default_search_parameters JSONB NOT NULL DEFAULT '{}',
        ui_preferences JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_configurations_user_id ON configurations(user_id);
    `);

    // Create vector extension for RAG
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);

    // Create embeddings table for RAG
    await client.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX idx_embeddings_metadata ON embeddings USING GIN (metadata);
    `);

    // Commit transaction
    await client.query('COMMIT');
    logger.info('Database migration completed successfully: initial schema');
    
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Migration failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

const down = async () => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    logger.info('Rolling back database migration: initial schema');

    // Drop tables in correct order to respect foreign key constraints
    await client.query(`
      DROP TABLE IF EXISTS embeddings;
      DROP TABLE IF EXISTS configurations;
      DROP TABLE IF EXISTS search_history;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS conversations;
      DROP TABLE IF EXISTS loyalty_accounts;
      DROP TABLE IF EXISTS users;
      
      DROP TYPE IF EXISTS loyalty_tier;
      DROP TYPE IF EXISTS user_role;
      
      DROP EXTENSION IF EXISTS vector;
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    logger.info('Database rollback completed successfully: initial schema');
    
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Rollback failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { up, down }; 