/**
 * Worker Thread Manager Tests
 */
const { Worker } = require('worker_threads');
const workerThreadManager = require('../../server/services/worker-thread-manager');
const path = require('path');

// Mock Worker
jest.mock('worker_threads', () => {
  const events = require('events');
  const EventEmitter = events.EventEmitter;
  
  class MockWorker extends EventEmitter {
    constructor(filename, options) {
      super();
      this.filename = filename;
      this.options = options;
      this.on = jest.fn((event, callback) => {
        return super.on(event, callback);
      });
      this.postMessage = jest.fn((message) => {
        // Simulate worker processing a task
        if (message && message.id) {
          const taskId = message.id;
          const taskType = message.type;
          
          // Emit processing status
          setTimeout(() => {
            this.emit('message', {
              type: 'status',
              data: {
                status: 'processing',
                taskId,
                taskType
              }
            });
            
            // Emit completion after a short delay
            setTimeout(() => {
              this.emit('message', {
                type: 'taskComplete',
                taskId,
                data: { processed: true, taskType },
                processingTime: 50
              });
            }, 50);
          }, 10);
        }
      });
      this.terminate = jest.fn().mockImplementation(() => {
        this.emit('exit', 0);
        return Promise.resolve();
      });
      
      // Store metadata as it's done in the real implementation
      this.metadata = {
        id: options.workerData.workerId,
        busy: false,
        taskId: null,
        startTime: null
      };
      
      // Emit ready event after small delay to simulate initialization
      setTimeout(() => {
        this.emit('message', {
          type: 'status',
          data: { status: 'ready', workerId: options.workerData.workerId }
        });
      }, 10);
    }
  }
  
  const Worker = jest.fn((filename, options) => {
    return new MockWorker(filename, options);
  });
  
  return {
    Worker,
    isMainThread: true,
    parentPort: new EventEmitter(),
    workerData: {}
  };
});

// Mock OS
jest.mock('os', () => ({
  cpus: jest.fn(() => Array(4).fill({}))
}));

// Mock Winston
jest.mock('winston', () => {
  return {
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

describe('Worker Thread Manager', () => {
  beforeEach(() => {
    // Reset the manager state before each test
    workerThreadManager.isInitialized = false;
    workerThreadManager.workers = [];
    workerThreadManager.taskQueue = [];
    workerThreadManager.busyWorkers = 0;
    workerThreadManager.stats = {
      tasksQueued: 0,
      tasksCompleted: 0,
      tasksRejected: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      maxQueueLength: 0
    };
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (workerThreadManager.isInitialized) {
      await workerThreadManager.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize worker thread pool successfully', async () => {
      const result = await workerThreadManager.initialize();
      
      expect(result).toBe(true);
      expect(workerThreadManager.isInitialized).toBe(true);
      expect(workerThreadManager.workers.length).toBeGreaterThan(0);
      expect(Worker).toHaveBeenCalled();
      
      // Verify worker was initialized with correct path and data
      expect(Worker).toHaveBeenCalledWith(
        expect.stringContaining('worker.js'),
        expect.objectContaining({
          workerData: expect.objectContaining({
            workerId: expect.any(Number)
          })
        })
      );
    });

    it('should not initialize if already initialized', async () => {
      // First initialization
      await workerThreadManager.initialize();
      const initialWorkerCount = workerThreadManager.workers.length;
      const initialCallCount = Worker.mock.calls.length;
      
      // Second initialization attempt
      await workerThreadManager.initialize();
      
      // Should remain the same
      expect(workerThreadManager.workers.length).toBe(initialWorkerCount);
      expect(Worker.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('task management', () => {
    beforeEach(async () => {
      await workerThreadManager.initialize();
    });

    it('should add task to queue and process it', async () => {
      // Add a task
      const taskPromise = workerThreadManager.addTask('processImage', { width: 100, height: 100 });
      
      // Expect a worker to receive the task
      expect(workerThreadManager.workers[0].postMessage).toHaveBeenCalled();
      
      // Await task completion - our mock automatically handles this
      const result = await taskPromise;
      
      // Verify result
      expect(result).toEqual(expect.objectContaining({ processed: true }));
      expect(workerThreadManager.stats.tasksCompleted).toBe(1);
    });

    it('should handle task errors correctly', async () => {
      // Create a mock worker that will process the task
      const mockWorker = workerThreadManager.workers[0];
      
      // Add a task
      const taskPromise = workerThreadManager.addTask('processData', { items: [] });
      
      // Get task ID from the postMessage call
      const taskId = mockWorker.postMessage.mock.calls[0][0].id;
      
      // Manually simulate worker error for this test (override automatic behavior)
      setTimeout(() => {
        mockWorker.emit('message', {
          type: 'taskComplete',
          taskId,
          error: 'Test error message'
        });
      }, 10);
      
      // Await task and expect it to reject
      await expect(taskPromise).rejects.toThrow('Test error message');
      expect(workerThreadManager.stats.tasksCompleted).toBe(1);
    });

    it('should replace crashed workers', async () => {
      const initialWorkerCount = workerThreadManager.workers.length;
      
      // Get a worker to crash
      const crashedWorker = workerThreadManager.workers[0];
      const workerId = crashedWorker.metadata.id;
      
      // Simulate worker error and exit
      crashedWorker.emit('error', new Error('Worker crashed'));
      crashedWorker.emit('exit', 1);
      
      // Allow time for replacement
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Worker count should remain the same
      expect(workerThreadManager.workers.length).toBe(initialWorkerCount);
      
      // A new worker should have been created
      expect(Worker.mock.calls.length).toBe(initialWorkerCount + 1);
      
      // The new worker should have the same ID
      const replacementWorker = workerThreadManager.workers.find(w => w.metadata.id === workerId);
      expect(replacementWorker).toBeDefined();
      expect(replacementWorker).not.toBe(crashedWorker);
    });

    it('should reject tasks when queue is full', async () => {
      // Set small max queue size
      const maxQueueSize = 1;
      
      // Make all workers busy so tasks stay in queue
      workerThreadManager.workers.forEach(worker => {
        worker.metadata.busy = true;
      });
      
      // Add first task (should queue)
      const task1 = workerThreadManager.addTask('processImage', { width: 100, height: 100 }, { maxQueueSize });
      
      // Second task should be rejected
      await expect(
        workerThreadManager.addTask('processImage', { width: 100, height: 100 }, { maxQueueSize })
      ).rejects.toThrow('Task queue is full');
      
      expect(workerThreadManager.stats.tasksRejected).toBe(1);
      
      // Reset worker busy state to allow cleanup
      workerThreadManager.workers.forEach(worker => {
        worker.metadata.busy = false;
      });
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      await workerThreadManager.initialize();
    });

    it('should provide accurate stats', async () => {
      // Add and complete a task
      const taskPromise = workerThreadManager.addTask('processImage', { width: 100, height: 100 });
      await taskPromise;
      
      // Get stats
      const stats = workerThreadManager.getStats();
      
      // Verify stats structure matches implementation
      expect(stats).toEqual({
        initialized: true,
        workers: {
          total: expect.any(Number),
          busy: expect.any(Number),
          available: expect.any(Number)
        },
        queue: {
          current: expect.any(Number),
          max: expect.any(Number)
        },
        tasks: {
          queued: 1,
          completed: 1,
          rejected: 0,
          avgProcessingTime: expect.any(String)
        }
      });
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await workerThreadManager.initialize();
    });

    it('should shut down all workers gracefully', async () => {
      // Get initial worker count
      const initialWorkerCount = workerThreadManager.workers.length;
      
      // Save reference to a worker to check its terminate method later
      const workerToCheck = workerThreadManager.workers[0];
      
      // Shut down
      await workerThreadManager.shutdown();
      
      // Verify results
      expect(workerThreadManager.isInitialized).toBe(false);
      expect(workerThreadManager.workers.length).toBe(0);
      
      // Verify terminate was called on the worker
      expect(workerToCheck.terminate).toHaveBeenCalled();
    });
  });
}); 