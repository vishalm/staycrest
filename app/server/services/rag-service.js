const { pool } = require('../database/connection');
const { OpenAI } = require('openai');
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
    new winston.transports.File({ filename: 'logs/rag.log' })
  ],
});

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
    this.initialized = false;
    this.embeddingModel = 'text-embedding-3-small';
    this.embeddingDimension = 1536; // OpenAI text-embedding-3-small dimension
  }

  /**
   * Initialize the RAG service
   */
  async initialize() {
    try {
      // Check if vector extension is available
      const client = await pool.connect();
      try {
        await client.query('SELECT * FROM pg_extension WHERE extname = \'vector\'');
        logger.info('Vector extension is installed');
        
        // Check if embeddings table exists
        await client.query('SELECT to_regclass(\'public.embeddings\')');
        logger.info('Embeddings table exists');
        
        this.initialized = true;
        logger.info('RAG service initialized successfully');
        return true;
      } catch (error) {
        logger.error(`Failed to initialize RAG service: ${error.message}`);
        return false;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Error connecting to database: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate an embedding for a text using OpenAI
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error(`Error generating embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store a document in the database with its embedding
   * @param {string} content - Document content
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Stored document
   */
  async storeDocument(content, metadata = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Insert document
      const query = `
        INSERT INTO embeddings (content, metadata, embedding)
        VALUES ($1, $2, $3)
        RETURNING id, content, metadata, created_at
      `;
      
      const { rows } = await client.query(query, [
        content,
        metadata,
        embedding
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`Document stored with ID: ${rows[0].id}`);
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error storing document: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store multiple documents in batch
   * @param {Array<{content: string, metadata: Object}>} documents - Array of documents
   * @returns {Promise<number>} Number of documents stored
   */
  async storeDocumentBatch(documents) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let storedCount = 0;
      
      // Process documents in chunks to avoid rate limits
      for (let i = 0; i < documents.length; i += 10) {
        const chunk = documents.slice(i, i + 10);
        
        // Generate embeddings for chunk
        const embeddingPromises = chunk.map(doc => this.generateEmbedding(doc.content));
        const embeddings = await Promise.all(embeddingPromises);
        
        // Insert documents
        for (let j = 0; j < chunk.length; j++) {
          const { content, metadata } = chunk[j];
          const embedding = embeddings[j];
          
          const query = `
            INSERT INTO embeddings (content, metadata, embedding)
            VALUES ($1, $2, $3)
            RETURNING id
          `;
          
          await client.query(query, [content, metadata, embedding]);
          storedCount++;
        }
        
        // Short pause to avoid rate limits
        if (i + 10 < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      await client.query('COMMIT');
      
      logger.info(`Batch storage complete: ${storedCount} documents stored`);
      return storedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error in batch storage: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search for similar documents using vector similarity
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results (default: 5)
   * @param {number} options.similarityThreshold - Minimum similarity score (default: 0.7)
   * @param {Object} options.filterMetadata - Filter by metadata fields
   * @returns {Promise<Array<Object>>} Matching documents
   */
  async semanticSearch(query, options = {}) {
    const {
      limit = 5,
      similarityThreshold = 0.7,
      filterMetadata = {}
    } = options;
    
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build the WHERE clause for metadata filtering
      let filterClause = '';
      const filterParams = [queryEmbedding, similarityThreshold, limit];
      let paramIndex = 4;
      
      if (Object.keys(filterMetadata).length > 0) {
        const filterConditions = [];
        
        for (const [key, value] of Object.entries(filterMetadata)) {
          filterConditions.push(`metadata->>'${key}' = $${paramIndex++}`);
          filterParams.push(value);
        }
        
        filterClause = `AND ${filterConditions.join(' AND ')}`;
      }
      
      // Perform vector search
      const searchQuery = `
        SELECT 
          id,
          content,
          metadata,
          created_at,
          1 - (embedding <=> $1) AS similarity
        FROM 
          embeddings
        WHERE 
          1 - (embedding <=> $1) > $2
          ${filterClause}
        ORDER BY 
          similarity DESC
        LIMIT $3
      `;
      
      const { rows } = await pool.query(searchQuery, filterParams);
      
      logger.info(`Search complete: ${rows.length} results found`);
      return rows;
    } catch (error) {
      logger.error(`Error in semantic search: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update document content and regenerate its embedding
   * @param {string} id - Document ID
   * @param {string} content - New content
   * @param {Object} metadata - Updated metadata (optional)
   * @returns {Promise<Object>} Updated document
   */
  async updateDocument(id, content, metadata = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if document exists
      const checkQuery = 'SELECT * FROM embeddings WHERE id = $1';
      const checkResult = await client.query(checkQuery, [id]);
      
      if (checkResult.rows.length === 0) {
        throw new Error(`Document with ID ${id} not found`);
      }
      
      // Generate new embedding
      const embedding = await this.generateEmbedding(content);
      
      // Update document
      let updateQuery, updateParams;
      
      if (metadata !== null) {
        updateQuery = `
          UPDATE embeddings
          SET content = $1, metadata = $2, embedding = $3
          WHERE id = $4
          RETURNING id, content, metadata, created_at
        `;
        updateParams = [content, metadata, embedding, id];
      } else {
        updateQuery = `
          UPDATE embeddings
          SET content = $1, embedding = $2
          WHERE id = $3
          RETURNING id, content, metadata, created_at
        `;
        updateParams = [content, embedding, id];
      }
      
      const { rows } = await client.query(updateQuery, updateParams);
      
      await client.query('COMMIT');
      
      logger.info(`Document updated with ID: ${rows[0].id}`);
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating document: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteDocument(id) {
    try {
      const query = 'DELETE FROM embeddings WHERE id = $1 RETURNING id';
      const { rows } = await pool.query(query, [id]);
      
      if (rows.length === 0) {
        logger.warn(`Document with ID ${id} not found for deletion`);
        return false;
      }
      
      logger.info(`Document deleted with ID: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics about the embedding database
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_documents,
          MIN(created_at) as oldest_document,
          MAX(created_at) as newest_document,
          jsonb_object_agg(key, total) as metadata_counts
        FROM 
          embeddings,
          LATERAL (
            SELECT key, COUNT(*) as total
            FROM jsonb_object_keys(metadata) as key
            GROUP BY key
          ) metadata_keys
        GROUP BY key
      `;
      
      const { rows } = await pool.query(query);
      
      // If no documents, return empty stats
      if (rows.length === 0) {
        return {
          totalDocuments: 0,
          oldestDocument: null,
          newestDocument: null,
          metadataCounts: {}
        };
      }
      
      return {
        totalDocuments: parseInt(rows[0].total_documents),
        oldestDocument: rows[0].oldest_document,
        newestDocument: rows[0].newest_document,
        metadataCounts: rows[0].metadata_counts || {}
      };
    } catch (error) {
      logger.error(`Error getting stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a response to a query using RAG
   * @param {string} query - User query
   * @param {Object} options - Options for search and generation
   * @returns {Promise<Object>} Generated response with context
   */
  async generateResponse(query, options = {}) {
    try {
      // Perform semantic search to retrieve context
      const results = await this.semanticSearch(query, options);
      
      // Extract content from results to use as context
      const contexts = results.map(r => r.content);
      
      // Generate response using retrieved contexts
      const systemPrompt = `You are a helpful assistant for the StayCrest hotel discovery platform.
Use the following retrieved information to answer the user's question.
If the information doesn't contain the answer, say "I don't have enough information about that." and suggest what they might ask instead.

Retrieved information:
${contexts.join('\n\n')}`;
      
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000
      });
      
      return {
        answer: response.choices[0].message.content,
        context: results,
        model: response.model,
        usage: response.usage
      };
    } catch (error) {
      logger.error(`Error generating RAG response: ${error.message}`);
      throw error;
    }
  }
}

// Singleton instance
const ragService = new RAGService();

module.exports = ragService; 