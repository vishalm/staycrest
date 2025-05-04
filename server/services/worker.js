/**
 * Worker Thread Implementation
 * 
 * This file contains the worker implementation that runs in separate threads.
 * Workers receive tasks from the main thread and process them CPU-intensively.
 */

const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

// Worker id from workerData
const workerId = workerData.workerId;

// Task processors
const taskProcessors = {
  // Image processing (simulated)
  processImage: async (data) => {
    const { width, height, filters } = data;
    
    // Simulate CPU-intensive work
    const result = simulateCpuWork(width * height * (filters?.length || 1));
    
    return {
      processed: true,
      dimensions: { width, height },
      filters: filters || [],
      hash: result
    };
  },
  
  // Text embedding (simulated)
  generateEmbedding: async (data) => {
    const { text, dimensions } = data;
    
    // Simulate CPU-intensive work
    simulateCpuWork(text.length * (dimensions || 384) / 100);
    
    // Generate embedding vector (simulated)
    const embedding = new Array(dimensions || 384).fill(0).map(() => Math.random() * 2 - 1);
    
    return {
      embedding,
      dimensions: dimensions || 384,
      textLength: text.length
    };
  },
  
  // Search relevance scoring (simulated)
  scoreSearchResults: async (data) => {
    const { query, documents, options } = data;
    
    // Simulate CPU-intensive work
    simulateCpuWork(query.length * documents.length * 5);
    
    // Score each document (simulated)
    const scoredResults = documents.map(doc => {
      // Calculate simulated relevance score
      let score = Math.random();
      
      // Boost score if document title contains query terms
      if (doc.title && query.split(' ').some(term => doc.title.includes(term))) {
        score += 0.3;
      }
      
      return {
        id: doc.id,
        score: Math.min(score, 1.0),
        title: doc.title,
        metadata: doc.metadata
      };
    });
    
    // Sort by score
    const sortedResults = scoredResults.sort((a, b) => b.score - a.score);
    
    // Return top N results if specified
    const limit = options?.limit || sortedResults.length;
    const topResults = sortedResults.slice(0, limit);
    
    return {
      results: topResults,
      total: scoredResults.length,
      query
    };
  },
  
  // Data processing (simulated)
  processData: async (data) => {
    const { items, transformations } = data;
    
    // Simulate CPU-intensive work
    simulateCpuWork(items.length * (transformations?.length || 1) * 10);
    
    // Process each item (simulated)
    const processedItems = items.map(item => {
      let result = { ...item };
      
      // Apply each transformation
      if (transformations && transformations.length > 0) {
        transformations.forEach(transform => {
          if (transform === 'normalize') {
            // Simulate normalization
            Object.keys(result).forEach(key => {
              if (typeof result[key] === 'number') {
                result[key] = result[key] / 100;
              }
            });
          } else if (transform === 'categorize') {
            // Simulate categorization
            result.category = result.value > 50 ? 'high' : result.value > 25 ? 'medium' : 'low';
          }
        });
      }
      
      return result;
    });
    
    return {
      processed: processedItems,
      transformations: transformations || [],
      count: processedItems.length
    };
  },
  
  // Encryption/decryption (actual CPU-intensive work)
  encrypt: async (data) => {
    const { text, algorithm, key } = data;
    
    // Create initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(algorithm || 'aes-256-cbc', Buffer.from(key), iv);
    
    // Encrypt text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      algorithm: algorithm || 'aes-256-cbc',
      iv: iv.toString('hex')
    };
  },
  
  decrypt: async (data) => {
    const { encrypted, algorithm, key, iv } = data;
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      algorithm || 'aes-256-cbc', 
      Buffer.from(key), 
      Buffer.from(iv, 'hex')
    );
    
    // Decrypt text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return {
      decrypted,
      algorithm: algorithm || 'aes-256-cbc'
    };
  },
  
  // Hash generation (actual CPU-intensive work)
  generateHash: async (data) => {
    const { text, algorithm, iterations } = data;
    
    // Generate salt
    const salt = crypto.randomBytes(16);
    
    // Hash the text with PBKDF2
    const hash = crypto.pbkdf2Sync(
      text,
      salt,
      iterations || 10000,
      64,
      algorithm || 'sha512'
    );
    
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex'),
      algorithm: algorithm || 'sha512',
      iterations: iterations || 10000
    };
  },
  
  // Default handler for unknown task types
  default: async (data) => {
    return {
      error: 'Unknown task type',
      data
    };
  }
};

// Simulate CPU-intensive work
function simulateCpuWork(complexity) {
  const iterations = Math.max(1000, Math.min(100000000, complexity * 10000));
  let result = '';
  
  for (let i = 0; i < iterations; i++) {
    result = crypto.createHash('sha256').update(i.toString()).digest('hex');
  }
  
  return result;
}

// Listen for messages from the main thread
parentPort.on('message', async (task) => {
  try {
    const startTime = Date.now();
    
    // Log task received
    parentPort.postMessage({
      type: 'status',
      data: {
        status: 'processing',
        taskId: task.id,
        taskType: task.type
      }
    });
    
    // Process the task
    const processor = taskProcessors[task.type] || taskProcessors.default;
    const result = await processor(task.data);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Send result back to main thread
    parentPort.postMessage({
      type: 'taskComplete',
      taskId: task.id,
      data: result,
      processingTime
    });
  } catch (error) {
    // Send error back to main thread
    parentPort.postMessage({
      type: 'taskComplete',
      taskId: task.id,
      error: error.message
    });
  }
});

// Send ready message to main thread
parentPort.postMessage({
  type: 'status',
  data: {
    status: 'ready',
    workerId
  }
}); 