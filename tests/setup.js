/**
 * StayCrest Test Setup
 * 
 * Global setup for Jest tests.
 */

// Setup DOM environment globals
if (typeof window !== 'object') {
  global.window = {};
}

// Setup localStorage mock
if (!global.localStorage) {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
}

// Setup document mock if not in jsdom environment
if (!global.document) {
  global.document = {
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
      setAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn(() => false)
      },
      appendChild: jest.fn()
    })),
    documentElement: {
      setAttribute: jest.fn(),
      style: {
        setProperty: jest.fn()
      }
    },
    body: {
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn(() => false)
      }
    },
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    getElementById: jest.fn(() => null)
  };
}

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock process.env for tests
process.env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'test',
  PORT: process.env.PORT || '3000',
  ENABLE_METRICS: 'true',
  ENABLE_TRACING: 'true',
  WORKER_THREADS: '2',
  WORKER_PROCESSES: '2',
  LOG_LEVEL: 'error',
  REDIS_URI: 'redis://localhost:6379',
  MONGODB_URI: 'mongodb://localhost:27017/staycrest-test',
  SESSION_SECRET: 'test-session-secret',
  JWT_SECRET: 'test-jwt-secret',
};

// Mock redis client
jest.mock('redis', () => {
  const EventEmitter = require('events');
  
  const redisClient = {
    on: jest.fn().mockReturnThis(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    isReady: true
  };
  
  return {
    createClient: jest.fn(() => redisClient)
  };
}, { virtual: true });

// Mock mongoose for database operations
jest.mock('mongoose', () => {
  const mockConnection = {
    readyState: 1
  };
  
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    connection: mockConnection,
    Schema: jest.fn().mockReturnValue({
      pre: jest.fn().mockReturnThis(),
      index: jest.fn().mockReturnThis(),
      virtual: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    }),
    model: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 })
    })
  };
}, { virtual: true });

// Mock worker_threads
jest.mock('worker_threads', () => {
  const EventEmitter = require('events');
  
  const parentPort = new EventEmitter();
  parentPort.postMessage = jest.fn();
  
  return {
    Worker: jest.fn(() => ({
      on: jest.fn((event, callback) => {}),
      postMessage: jest.fn(),
      terminate: jest.fn().mockResolvedValue(undefined)
    })),
    isMainThread: true,
    parentPort,
    workerData: { workerId: 'test-worker' },
    threadId: 1
  };
}, { virtual: true });

// Setup OpenTelemetry mocks for tracing tests
jest.mock('@opentelemetry/api', () => {
  return {
    trace: {
      getTracer: jest.fn(() => ({
        startSpan: jest.fn(() => ({
          end: jest.fn(),
          setAttributes: jest.fn(),
          recordException: jest.fn(),
          setStatus: jest.fn()
        }))
      }))
    }
  };
}, { virtual: true });

// Mock Prometheus client
jest.mock('prom-client', () => {
  const mockCounter = {
    inc: jest.fn(),
    labels: jest.fn(() => mockCounter)
  };
  
  const mockGauge = {
    set: jest.fn(),
    labels: jest.fn(() => mockGauge)
  };
  
  const mockHistogram = {
    observe: jest.fn(),
    labels: jest.fn(() => mockHistogram)
  };
  
  return {
    Counter: jest.fn(() => mockCounter),
    Gauge: jest.fn(() => mockGauge),
    Histogram: jest.fn(() => mockHistogram),
    Registry: jest.fn().mockImplementation(() => ({
      registerMetric: jest.fn(),
      metrics: jest.fn().mockResolvedValue('metric data'),
      contentType: 'text/plain',
      clear: jest.fn()
    })),
    register: {
      registerMetric: jest.fn(),
      metrics: jest.fn().mockResolvedValue('metric data'),
      contentType: 'text/plain',
      clear: jest.fn()
    },
    collectDefaultMetrics: jest.fn()
  };
}, { virtual: true });

// Mock Passport
jest.mock('passport', () => ({
  authenticate: jest.fn(() => (req, res, next) => next()),
  use: jest.fn(),
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn()
}), { virtual: true });

// Mock UUID for deterministic tests
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}), { virtual: true }); 