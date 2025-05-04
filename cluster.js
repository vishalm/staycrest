/**
 * Cluster Manager for StayCrest
 * 
 * This file implements clustering support for the application, allowing it to
 * utilize multiple CPU cores and improve performance and reliability.
 */

const cluster = require('cluster');
const os = require('os');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'cluster-manager' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      )
    }),
    new winston.transports.File({ filename: 'logs/cluster.log' })
  ],
});

// Determine the number of worker processes to start
// By default, use the number of CPU cores
const numWorkers = process.env.WORKER_PROCESSES || os.cpus().length;

// Track worker state
const workers = {};
let restartingWorker = false;

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

/**
 * Setup master process and fork workers
 */
function setupMaster() {
  logger.info(`Master process ${process.pid} is running`);
  logger.info(`Starting ${numWorkers} worker processes...`);

  // Create workers
  for (let i = 0; i < numWorkers; i++) {
    createWorker();
  }

  // Listen for worker events
  cluster.on('exit', (worker, code, signal) => {
    const pid = worker.process.pid;
    
    if (code === 0) {
      logger.info(`Worker ${pid} exited cleanly`);
    } else {
      logger.warn(`Worker ${pid} exited with code ${code} and signal ${signal}`);
      
      // Track worker deaths in status file
      appendWorkerStatus({
        worker: pid,
        exit: {
          code,
          signal,
          time: new Date().toISOString()
        }
      });
      
      // Restart the worker
      if (!worker.exitedAfterDisconnect) {
        logger.info(`Worker ${pid} died unexpectedly, starting a new worker...`);
        createWorker();
      }
    }
  });

  // Graceful shutdown on termination signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Report status periodically
  setInterval(reportClusterStatus, 60000);
  
  // Allow zero-downtime restart of workers
  setupZeroDowntimeRestart();
}

/**
 * Create a new worker process
 */
function createWorker() {
  const worker = cluster.fork();
  const pid = worker.process.pid;
  
  workers[worker.id] = {
    id: worker.id,
    pid,
    startTime: new Date(),
    status: 'starting'
  };
  
  logger.info(`Started worker ${pid}`);
  
  worker.on('message', (message) => {
    if (message.type === 'status') {
      workers[worker.id].status = message.status;
      
      if (message.status === 'ready') {
        logger.info(`Worker ${pid} is ready to accept connections`);
      }
    }
  });
  
  // Send the worker its ID and configuration
  worker.send({ 
    type: 'config',
    workerId: worker.id,
    totalWorkers: numWorkers
  });
  
  return worker;
}

/**
 * Report the status of the cluster
 */
function reportClusterStatus() {
  const activeWorkers = Object.values(workers).filter(w => w.status === 'ready').length;
  const totalWorkers = Object.keys(workers).length;
  
  logger.info(`Cluster status: ${activeWorkers}/${totalWorkers} workers active`);
  
  // Output memory usage
  const memoryUsage = process.memoryUsage();
  logger.info(`Master memory usage: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
}

/**
 * Append worker status to status file
 */
function appendWorkerStatus(status) {
  try {
    const statusFile = path.join('logs', 'worker-status.log');
    const statusJson = JSON.stringify(status) + '\n';
    fs.appendFileSync(statusFile, statusJson);
  } catch (error) {
    logger.error(`Failed to write worker status: ${error.message}`);
  }
}

/**
 * Handle graceful shutdown
 */
function gracefulShutdown() {
  logger.info('Received shutdown signal, closing workers...');
  
  // Set a timeout to forcefully exit if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);
  
  // Disconnect all workers gracefully
  Object.values(cluster.workers).forEach(worker => {
    const pid = worker.process.pid;
    logger.info(`Sending shutdown signal to worker ${pid}`);
    worker.send({ type: 'shutdown' });
    
    // Set a timeout for individual worker to disconnect
    setTimeout(() => {
      if (worker.isConnected()) {
        logger.warn(`Worker ${pid} did not exit gracefully, killing it`);
        worker.kill('SIGTERM');
      }
    }, 10000);
  });
  
  // Check every second if all workers have disconnected
  const shutdownInterval = setInterval(() => {
    const workerCount = Object.keys(cluster.workers).length;
    logger.info(`Waiting for ${workerCount} workers to disconnect...`);
    
    if (workerCount === 0) {
      clearInterval(shutdownInterval);
      clearTimeout(forceExitTimeout);
      logger.info('All workers have disconnected, shutting down master process');
      process.exit(0);
    }
  }, 1000);
}

/**
 * Set up zero-downtime restart of workers
 */
function setupZeroDowntimeRestart() {
  process.on('SIGUSR2', () => {
    logger.info('Received SIGUSR2, performing zero-downtime restart of workers');
    restartWorkers();
  });
}

/**
 * Restart workers one at a time to avoid downtime
 */
function restartWorkers(workerIds = Object.keys(cluster.workers)) {
  if (restartingWorker || workerIds.length === 0) {
    if (workerIds.length === 0) {
      logger.info('All workers have been restarted');
      restartingWorker = false;
    }
    return;
  }
  
  restartingWorker = true;
  const workerId = workerIds.pop();
  const worker = cluster.workers[workerId];
  
  if (!worker) {
    restartingWorker = false;
    restartWorkers(workerIds);
    return;
  }
  
  const pid = worker.process.pid;
  logger.info(`Restarting worker ${pid}`);
  
  // Listen for the exit event of the worker
  worker.on('exit', () => {
    if (worker.exitedAfterDisconnect) {
      // Create a new worker
      const newWorker = createWorker();
      
      // Wait for the new worker to become ready before restarting the next one
      newWorker.on('message', (message) => {
        if (message.type === 'status' && message.status === 'ready') {
          restartingWorker = false;
          restartWorkers(workerIds);
        }
      });
    }
  });
  
  // Disconnect the worker
  worker.disconnect();
  
  // Kill the worker after 15 seconds if it hasn't exited
  setTimeout(() => {
    if (worker.process) {
      logger.warn(`Worker ${pid} did not exit after 15s, killing it`);
      worker.kill('SIGTERM');
    }
  }, 15000);
}

// Handle worker process
function setupWorker() {
  const server = require('./server');
  const pid = process.pid;
  
  logger.info(`Worker ${pid} started`);
  
  // Listen for messages from the master
  process.on('message', (message) => {
    if (message.type === 'config') {
      process.env.WORKER_ID = message.workerId;
      process.env.TOTAL_WORKERS = message.totalWorkers;
      
      // Let master know we're ready
      process.send({ type: 'status', status: 'ready' });
    }
    
    if (message.type === 'shutdown') {
      logger.info(`Worker ${pid} received shutdown signal`);
      
      // Close the server gracefully
      server.server.close(() => {
        logger.info(`Worker ${pid} closed all connections, exiting...`);
        process.exit(0);
      });
      
      // Force exit after 10 seconds if the server hasn't closed
      setTimeout(() => {
        logger.warn(`Worker ${pid} server close timed out, forcing exit`);
        process.exit(1);
      }, 10000);
    }
  });
  
  // Handle uncaught exceptions in worker
  process.on('uncaughtException', (err) => {
    logger.error(`Worker ${pid} uncaught exception: ${err.message}`, { error: err });
    logger.error(err.stack);
    
    // Notify master before exiting
    process.send({ 
      type: 'status', 
      status: 'error', 
      error: { 
        message: err.message,
        stack: err.stack 
      } 
    });
    
    // Exit the process with error code 1
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  // Handle unhandled promise rejections in worker
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Worker ${pid} unhandled rejection: ${reason}`, { reason });
    
    // Notify master
    process.send({ 
      type: 'status', 
      status: 'warning', 
      warning: { 
        type: 'unhandledRejection',
        reason: String(reason)
      } 
    });
  });
}

// Run as master or worker
if (cluster.isMaster) {
  setupMaster();
} else {
  setupWorker();
} 