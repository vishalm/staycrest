/**
 * Metrics Service for StayCrest
 * Simple in-memory metrics collection service that mimics Prometheus client functionality
 */

const logger = require('./logging-service').getLogger('metrics');

/**
 * In-memory metrics storage
 */
class MetricsRegistry {
  constructor() {
    this.metrics = {};
    this.contentType = 'text/plain; version=0.0.4';
    this.logger = logger.createChildLogger('metrics-registry', { service: 'metrics' });
    this.logger.info('Metrics registry initialized');
  }
  
  /**
   * Register a new metric
   * @param {string} name - Metric name
   * @param {string} type - Metric type (counter, gauge, histogram)
   * @param {string} help - Help text for the metric
   * @param {Array} labelNames - Array of label names
   * @returns {object} - Metric object
   */
  register(name, type, help, labelNames = []) {
    if (this.metrics[name]) {
      this.logger.warn(`Metric ${name} already exists, overwriting`);
    }
    
    const metric = {
      name,
      type,
      help,
      labelNames,
      values: new Map(),
      timestamp: Date.now()
    };
    
    this.metrics[name] = metric;
    this.logger.debug(`Registered metric: ${name}`, { type, labels: labelNames });
    
    return metric;
  }
  
  /**
   * Get all metrics in Prometheus format
   * @returns {string} - Metrics in Prometheus format
   */
  async metrics() {
    let output = '';
    
    // For each metric
    for (const [name, metric] of Object.entries(this.metrics)) {
      // Add help text
      output += `# HELP ${name} ${metric.help}\n`;
      
      // Add type
      output += `# TYPE ${name} ${metric.type}\n`;
      
      // Add values
      for (const [labels, value] of metric.values.entries()) {
        if (labels !== '') {
          const labelPairs = JSON.parse(labels);
          const labelStr = Object.entries(labelPairs)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          
          output += `${name}{${labelStr}} ${value} ${Date.now()}\n`;
        } else {
          output += `${name} ${value} ${Date.now()}\n`;
        }
      }
      
      // Add newline between metrics
      output += '\n';
    }
    
    return output;
  }
}

/**
 * Base metric class
 */
class Metric {
  constructor(name, help, labelNames = [], registry) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.registry = registry;
  }
  
  /**
   * Convert labels object to string key
   * @param {object} labels - Labels object
   * @returns {string} - String key for labels
   */
  _labelsToKey(labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    // Only include labels that are in labelNames
    const filteredLabels = {};
    for (const label of this.labelNames) {
      if (labels[label] !== undefined) {
        filteredLabels[label] = labels[label];
      }
    }
    
    return JSON.stringify(filteredLabels);
  }
}

/**
 * Counter metric
 */
class Counter extends Metric {
  constructor(name, help, labelNames = [], registry) {
    super(name, help, labelNames, registry);
    this.metric = registry.register(name, 'counter', help, labelNames);
  }
  
  /**
   * Increment counter
   * @param {object} labels - Labels for the counter
   * @param {number} value - Value to increment by (default: 1)
   */
  inc(labels = {}, value = 1) {
    const key = this._labelsToKey(labels);
    const currentValue = this.metric.values.get(key) || 0;
    this.metric.values.set(key, currentValue + value);
  }
  
  /**
   * Reset counter
   * @param {object} labels - Labels for the counter
   */
  reset(labels = {}) {
    const key = this._labelsToKey(labels);
    this.metric.values.set(key, 0);
  }
}

/**
 * Gauge metric
 */
class Gauge extends Metric {
  constructor(name, help, labelNames = [], registry) {
    super(name, help, labelNames, registry);
    this.metric = registry.register(name, 'gauge', help, labelNames);
  }
  
  /**
   * Set gauge value
   * @param {object} labels - Labels for the gauge
   * @param {number} value - Value to set
   */
  set(labels = {}, value) {
    const key = this._labelsToKey(labels);
    this.metric.values.set(key, value);
  }
  
  /**
   * Increment gauge
   * @param {object} labels - Labels for the gauge
   * @param {number} value - Value to increment by (default: 1)
   */
  inc(labels = {}, value = 1) {
    const key = this._labelsToKey(labels);
    const currentValue = this.metric.values.get(key) || 0;
    this.metric.values.set(key, currentValue + value);
  }
  
  /**
   * Decrement gauge
   * @param {object} labels - Labels for the gauge
   * @param {number} value - Value to decrement by (default: 1)
   */
  dec(labels = {}, value = 1) {
    const key = this._labelsToKey(labels);
    const currentValue = this.metric.values.get(key) || 0;
    this.metric.values.set(key, currentValue - value);
  }
}

/**
 * Histogram metric
 */
class Histogram extends Metric {
  constructor(name, help, labelNames = [], buckets = [0.1, 0.5, 1, 2, 5, 10], registry) {
    super(name, help, labelNames, registry);
    this.buckets = buckets.sort((a, b) => a - b);
    this.metric = registry.register(name, 'histogram', help, labelNames);
    
    // Initialize buckets
    this.bucketMetrics = {};
    for (const bucket of this.buckets) {
      const bucketName = `${name}_bucket`;
      this.bucketMetrics[bucket] = registry.register(
        bucketName, 
        'counter', 
        `${help} (bucket: ${bucket})`,
        [...labelNames, 'le']
      );
    }
    
    // Initialize sum and count metrics
    this.sumMetric = registry.register(
      `${name}_sum`, 'counter', `${help} (sum)`, labelNames
    );
    
    this.countMetric = registry.register(
      `${name}_count`, 'counter', `${help} (count)`, labelNames
    );
  }
  
  /**
   * Observe a value
   * @param {object} labels - Labels for the histogram
   * @param {number} value - Value to observe
   */
  observe(labels = {}, value) {
    const key = this._labelsToKey(labels);
    
    // Increment bucket counters
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        const bucketKey = this._labelsToKey({
          ...labels,
          le: bucket
        });
        
        const currentValue = this.bucketMetrics[bucket].values.get(bucketKey) || 0;
        this.bucketMetrics[bucket].values.set(bucketKey, currentValue + 1);
      }
    }
    
    // Increment sum
    const currentSum = this.sumMetric.values.get(key) || 0;
    this.sumMetric.values.set(key, currentSum + value);
    
    // Increment count
    const currentCount = this.countMetric.values.get(key) || 0;
    this.countMetric.values.set(key, currentCount + 1);
  }
}

// Create singleton registry
const register = new MetricsRegistry();

module.exports = {
  register,
  Counter: (name, help, labelNames) => new Counter(name, help, labelNames, register),
  Gauge: (name, help, labelNames) => new Gauge(name, help, labelNames, register),
  Histogram: (name, help, labelNames, buckets) => new Histogram(name, help, labelNames, buckets, register),
  collectDefaultMetrics: () => {
    // Add some default metrics
    const osMetrics = new Gauge('node_os_memory_free_bytes', 'Free memory in bytes', [], register);
    const cpuMetrics = new Gauge('node_os_cpu_load', 'CPU load average', ['interval'], register);
    
    // Update OS metrics every 15 seconds
    setInterval(() => {
      const os = require('os');
      osMetrics.set({}, os.freemem());
      cpuMetrics.set({ interval: '1m' }, os.loadavg()[0]);
      cpuMetrics.set({ interval: '5m' }, os.loadavg()[1]);
      cpuMetrics.set({ interval: '15m' }, os.loadavg()[2]);
    }, 15000);
  }
}; 