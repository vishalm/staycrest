const EventEmitter = require('events');

// Create a mock of the parentPort with a working postMessage
const parentPortMock = new EventEmitter();
parentPortMock.postMessage = jest.fn();

// Export mock worker_threads module
module.exports = {
  parentPort: parentPortMock,
  workerData: { workerId: 'test-worker-1' },
  isMainThread: false,
  Worker: jest.fn().mockImplementation(() => {
    const workerMock = new EventEmitter();
    workerMock.postMessage = jest.fn();
    workerMock.terminate = jest.fn().mockImplementation(() => Promise.resolve());
    return workerMock;
  })
}; 