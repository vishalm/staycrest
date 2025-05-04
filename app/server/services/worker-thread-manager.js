/**
 * Worker Thread Manager Service
 * 
 * Manages worker threads for CPU-intensive tasks to improve application performance.
 * This service allows offloading heavy computation from the main event loop.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'worker-thread-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/worker-threads.log' })
  ],
});

class WorkerThreadManager {
  constructor() {
    // Number of worker threads to create - defaults to number of CPUs or environment variable
    this.numThreads = parseInt(process.env.WORKER_THREADS) || Math.max(1, os.cpus().length - 1);
    this.workers = [];
    this.taskQueue = [];
    this.isInitialized = false;
    this.busyWorkers = 0;
    
    // Stats for monitoring
    this.stats = {
      tasksQueued: 0,
      tasksCompleted: 0,
      tasksRejected: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      maxQueueLength: 0
    };
  }

  /**
   * Initialize the worker thread pool
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Worker thread manager already initialized');
      return;
    }

    try {
      logger.info(`Initializing worker thread pool with ${this.numThreads} threads`);
      
      for (let i = 0; i < this.numThreads; i++) {
        const worker = new Worker(path.join(__dirname, 'worker.js'), {
          workerData: { workerId: i }
        });
        
        // Set up message handling
        worker.on('message', (result) => {
          this.handleWorkerMessage(worker, result);
        });
        
        // Handle worker errors
        worker.on('error', (error) => {
          logger.error(`Worker ${i} error: ${error.message}`, { error, workerId: i });
          // Recreate the worker
          this.replaceWorker(worker);
        });
        
        // Handle worker exit
        worker.on('exit', (code) => {
          if (code !== 0) {
            logger.warn(`Worker ${i} exited with code ${code}`, { workerId: i, exitCode: code });
            // Recreate the worker if it didn't exit cleanly
            this.replaceWorker(worker);
          }
        });
        
        // Store worker metadata
        worker.metadata = {
          id: i,
          busy: false,
          taskId: null,
          startTime: null
        };
        
        this.workers.push(worker);
      }
      
      this.isInitialized = true;
      logger.info('Worker thread pool initialized successfully');
      
      // Start processing the task queue
      this.processQueue();
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize worker thread pool: ${error.message}`, { error });
      return false;
    }
  }

  /**
   * Replace a crashed worker with a new one
   * @param {Worker} oldWorker - The worker to replace
   */
  replaceWorker(oldWorker) {
    try {
      const index = this.workers.findIndex(w => w === oldWorker);
      if (index === -1) return;
      
      const metadata = oldWorker.metadata;
      logger.info(`Replacing worker ${metadata.id}`);
      
      // Create a new worker
      const newWorker = new Worker(path.join(__dirname, 'worker.js'), {
        workerData: { workerId: metadata.id }
      });
      
      // Set up event handlers
      newWorker.on('message', (result) => {
        this.handleWorkerMessage(newWorker, result);
      });
      
      newWorker.on('error', (error) => {
        logger.error(`Worker ${metadata.id} error: ${error.message}`, { error, workerId: metadata.id });
        this.replaceWorker(newWorker);
      });
      
      newWorker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn(`Worker ${metadata.id} exited with code ${code}`, { workerId: metadata.id, exitCode: code });
          this.replaceWorker(newWorker);
        }
      });
      
      // Copy metadata
      newWorker.metadata = {
        id: metadata.id,
        busy: false,
        taskId: null,
        startTime: null
      };
      
      // Replace in workers array
      this.workers[index] = newWorker;
      
      // If the old worker was processing a task, requeue it
      if (metadata.busy && metadata.taskId !== null) {
        const task = this.taskQueue.find(t => t.id === metadata.taskId);
        if (task) {
          logger.info(`Requeuing task ${metadata.taskId} after worker failure`);
          this.processQueue();
        }
      }
    } catch (error) {
      logger.error(`Failed to replace worker: ${error.message}`, { error });
    }
  }

  /**
   * Handle messages from workers
   * @param {Worker} worker - The worker that sent the message
   * @param {Object} result - Result message from the worker
   */
  handleWorkerMessage(worker, result) {
    try {
      const { taskId, error, data, type } = result;
      
      // Handle task completion
      if (type === 'taskComplete') {
        const task = this.taskQueue.find(t => t.id === taskId);
        
        if (task) {
          // Calculate processing time
          const processingTime = Date.now() - worker.metadata.startTime;
          this.stats.totalProcessingTime += processingTime;
          this.stats.tasksCompleted++;
          this.stats.avgProcessingTime = this.stats.totalProcessingTime / this.stats.tasksCompleted;
          
          logger.debug(`Task ${taskId} completed in ${processingTime}ms`, { 
            taskId, 
            processingTime,
            workerId: worker.metadata.id
          });
          
          // Mark worker as free
          worker.metadata.busy = false;
          worker.metadata.taskId = null;
          worker.metadata.startTime = null;
          this.busyWorkers--;
          
          // Remove task from queue
          this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
          
          // Call task callback with result
          if (error) {
            task.reject(new Error(error));
          } else {
            task.resolve(data);
          }
          
          // Process next task
          this.processQueue();
        }
      }
      // Handle worker status messages
      else if (type === 'status') {
        logger.debug(`Worker ${worker.metadata.id} status: ${data.status}`, { 
          workerId: worker.metadata.id, 
          status: data.status 
        });
      }
    } catch (error) {
      logger.error(`Error handling worker message: ${error.message}`, { error });
    }
  }

  /**
   * Process tasks in the queue
   */
  processQueue() {
    // Find available workers
    const availableWorkers = this.workers.filter(worker => !worker.metadata.busy);
    
    // Process tasks if we have available workers and tasks in queue
    while (availableWorkers.length > 0 && this.taskQueue.length > 0) {
      // Find tasks that aren't being processed yet
      const pendingTasks = this.taskQueue.filter(task => !task.processing);
      if (pendingTasks.length === 0) break;
      
      // Get next task and worker
      const task = pendingTasks[0];
      const worker = availableWorkers.shift();
      
      // Mark task as processing
      task.processing = true;
      
      // Mark worker as busy
      worker.metadata.busy = true;
      worker.metadata.taskId = task.id;
      worker.metadata.startTime = Date.now();
      this.busyWorkers++;
      
      // Send task to worker
      worker.postMessage({
        id: task.id,
        type: task.type,
        data: task.data
      });
      
      logger.debug(`Assigned task ${task.id} to worker ${worker.metadata.id}`, { 
        taskId: task.id, 
        workerId: worker.metadata.id,
        taskType: task.type
      });
    }
  }

  /**
   * Add a task to the queue for processing
   * @param {string} taskType - Type of task to perform
   * @param {Object} taskData - Data needed for the task
   * @param {Object} options - Task options
   * @returns {Promise} Promise that resolves with the task result
   */
  async addTask(taskType, taskData, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Generate a unique ID for the task
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Check if we're at max queue capacity
        const maxQueueSize = options.maxQueueSize || 1000;
        if (this.taskQueue.length >= maxQueueSize) {
          this.stats.tasksRejected++;
          return reject(new Error('Task queue is full'));
        }
        
        // Create task object
        const task = {
          id: taskId,
          type: taskType,
          data: taskData,
          options,
          resolve,
          reject,
          processing: false,
          addedAt: Date.now()
        };
        
        // Add to queue
        this.taskQueue.push(task);
        this.stats.tasksQueued++;
        
        // Update max queue length stat
        if (this.taskQueue.length > this.stats.maxQueueLength) {
          this.stats.maxQueueLength = this.taskQueue.length;
        }
        
        logger.debug(`Added task ${taskId} to queue`, { taskId, taskType, queueLength: this.taskQueue.length });
        
        // Try to process tasks
        this.processQueue();
      } catch (error) {
        logger.error(`Error adding task: ${error.message}`, { error, taskType });
        reject(error);
      }
    });
  }

  /**
   * Get statistics and status information about the worker pool
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      workers: {
        total: this.workers.length,
        busy: this.busyWorkers,
        available: this.workers.length - this.busyWorkers
      },
      queue: {
        current: this.taskQueue.length,
        max: this.stats.maxQueueLength
      },
      tasks: {
        queued: this.stats.tasksQueued,
        completed: this.stats.tasksCompleted,
        rejected: this.stats.tasksRejected,
        avgProcessingTime: `${Math.round(this.stats.avgProcessingTime)}ms`
      }
    };
  }

  /**
   * Shut down the worker thread pool
   */
  async shutdown() {
    logger.info('Shutting down worker thread pool');
    
    // Create promises for each worker termination
    const terminationPromises = this.workers.map(worker => {
      return new Promise((resolve) => {
        worker.on('exit', () => {
          resolve();
        });
        
        worker.terminate();
      });
    });
    
    // Wait for all workers to terminate
    await Promise.all(terminationPromises);
    
    this.workers = [];
    this.isInitialized = false;
    this.busyWorkers = 0;
    
    logger.info('Worker thread pool shut down successfully');
  }
}

// Export singleton instance
module.exports = new WorkerThreadManager(); 