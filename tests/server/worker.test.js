/**
 * Worker Thread - Minimal Test
 */

// Minimal test to verify worker initialization
describe('Worker Thread', () => {
  let mockParentPort;
  let mockPostMessage;
  
  beforeEach(() => {
    jest.resetModules();
    
    // Create minimal mocks
    mockPostMessage = jest.fn();
    mockParentPort = { 
      on: jest.fn(),
      postMessage: mockPostMessage
    };
    
    // Apply mocks
    jest.mock('worker_threads', () => ({
      parentPort: mockParentPort,
      workerData: { workerId: 'test-worker' }
    }));
    
    jest.mock('crypto', () => ({
      createHash: jest.fn(() => ({
        update: jest.fn(() => ({
          digest: jest.fn(() => 'hash')
        }))
      }))
    }));
  });
  
  it('initializes and sends ready status', () => {
    // Load worker module
    require('../../server/services/worker');
    
    // Should register message handler
    expect(mockParentPort.on).toHaveBeenCalledWith('message', expect.any(Function));
    
    // Should send ready status
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'status',
      data: {
        status: 'ready',
        workerId: 'test-worker'
      }
    });
  });
}); 