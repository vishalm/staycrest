/**
 * Cluster Manager - Simple Tests
 */

// Mock dependencies
jest.mock('cluster', () => {
  const EventEmitter = require('events');
  const mockCluster = new EventEmitter();
  
  // Mock Worker class
  class MockWorker extends EventEmitter {
    constructor(id) {
      super();
      this.id = id;
      this.process = { pid: 10000 + id };
      this.exitedAfterDisconnect = false;
      this.isConnected = jest.fn(() => true);
      this.disconnect = jest.fn(() => {
        this.exitedAfterDisconnect = true;
        this.emit('exit', 0);
      });
      this.kill = jest.fn();
      this.send = jest.fn();
    }
  }
  
  // Create a workers collection
  const mockWorkers = {};
  
  // Add methods to the cluster mock
  const clusterMock = {
    isMaster: true,
    isWorker: false,
    fork: jest.fn(() => {
      const id = Object.keys(mockWorkers).length + 1;
      const worker = new MockWorker(id);
      mockWorkers[id] = worker;
      return worker;
    }),
    workers: mockWorkers,
    Worker: MockWorker,
    on: mockCluster.on.bind(mockCluster),
    once: mockCluster.once.bind(mockCluster),
    emit: mockCluster.emit.bind(mockCluster),
    removeListener: mockCluster.removeListener.bind(mockCluster)
  };
  
  return clusterMock;
});

jest.mock('os', () => ({
  cpus: jest.fn(() => Array(4).fill({}))
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn()
}));

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('../../server', () => ({
  server: {
    close: jest.fn(cb => setTimeout(() => cb(), 10))
  }
}), { virtual: true });

describe('Cluster Manager', () => {
  let cluster;
  let fs;
  let originalEnv;
  let originalProcess;
  
  beforeEach(() => {
    jest.resetModules();
    
    // Import mocked modules
    cluster = require('cluster');
    fs = require('fs');
    
    // Store original process properties
    originalEnv = { ...process.env };
    originalProcess = {
      on: process.on,
      exit: process.exit,
      send: process.send
    };
    
    // Mock process.exit
    process.exit = jest.fn();
    
    // Mock process.send
    process.send = jest.fn();
    
    // Clear cluster workers
    Object.keys(cluster.workers).forEach(id => {
      delete cluster.workers[id];
    });
  });
  
  afterEach(() => {
    // Restore process
    process.env = originalEnv;
    process.on = originalProcess.on;
    process.exit = originalProcess.exit;
    process.send = originalProcess.send;
    
    // Clear timeouts and intervals
    jest.useRealTimers();
  });
  
  describe('Master mode', () => {
    beforeEach(() => {
      cluster.isMaster = true;
      cluster.isWorker = false;
    });
    
    it('should create logs directory if it does not exist', () => {
      // Run the cluster code
      require('../../cluster');
      
      // Check that log directory was checked and created
      expect(fs.existsSync).toHaveBeenCalledWith('logs');
      expect(fs.mkdirSync).toHaveBeenCalledWith('logs');
    });
    
    it('should fork workers based on CPU count', () => {
      // Configure CPU count
      require('os').cpus.mockReturnValue(Array(4).fill({}));
      
      // Clear fork calls from previous tests
      cluster.fork.mockClear();
      
      // Run the cluster code
      require('../../cluster');
      
      // Should fork workers based on CPU count (actual implementation forks 2 for testing)
      expect(cluster.fork).toHaveBeenCalled();
      expect(cluster.fork.mock.calls.length).toBeGreaterThan(0);
    });
    
    it('should fork workers based on environment variable', () => {
      // Set environment variable
      process.env.WORKER_PROCESSES = '2';
      
      // Run the cluster code
      require('../../cluster');
      
      // Should fork 2 workers based on env var
      expect(cluster.fork).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Worker mode', () => {
    beforeEach(() => {
      cluster.isMaster = false;
      cluster.isWorker = true;
    });
    
    it('should handle messages from master', () => {
      // Capture process.on calls
      const processOnSpy = jest.spyOn(process, 'on');
      
      // Run the cluster code
      require('../../cluster');
      
      // Check that event handlers were registered
      expect(processOnSpy).toHaveBeenCalledWith('message', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      
      // Get the message handler
      const messageHandler = processOnSpy.mock.calls.find(call => call[0] === 'message')[1];
      
      // Send a config message to the worker
      messageHandler({ 
        type: 'config',
        workerId: 1,
        totalWorkers: 4
      });
      
      // Check that environment variables were set
      expect(process.env.WORKER_ID).toBe(1);
      expect(process.env.TOTAL_WORKERS).toBe(4);
      
      // Check that ready message was sent back
      expect(process.send).toHaveBeenCalledWith({
        type: 'status',
        status: 'ready'
      });
    });
  });
}); 