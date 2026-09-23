/**
 * A ring buffer for storing console log entries.
 * When the buffer reaches its capacity, the oldest entries are overwritten.
 */
class RingBuffer {
  /**
   * @param {number} capacity Maximum number of entries to store.
   */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('capacity must be a positive integer');
    }
    /** @type {Array<{method: string, args: any[]}>} */
    this.buffer = new Array(capacity);
    this.capacity = capacity;
    this.size = 0;
    this.head = 0; // index where the next entry will be written
  }

  /**
   * Add an entry to the ring buffer.
   * @param {{method: string, args: any[]}} entry
   */
  push(entry) {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  /**
   * Return entries in chronological order (oldest first).
   * @returns {Array<{method: string, args: any[]}>}
   */
  toArray() {
    if (this.size === 0) {
      return [];
    }
    const result = [];
    const start = (this.head - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(start + i) % this.capacity]);
    }
    return result;
  }
}

/**
 * Wraps global console methods so calls are forwarded to the original methods
 * and simultaneously captured in a ring buffer.
 *
 * The decision to store only method name and arguments (not the return value,
 * timestamp, or stack trace) keeps the interceptor lightweight and predictable.
 * The ring buffer has a fixed capacity; when full, the oldest entries are dropped.
 */
export class ConsoleMethodInterceptor {
  /**
   * @param {number} capacity Maximum number of log entries to store.
   * @param {Console} [consoleObj] The console object to wrap. Defaults to global console.
   * @param {string[]} [methods] Console method names to intercept.
   */
  constructor(
    capacity,
    consoleObj = globalThis.console,
    methods = ['log', 'info', 'warn', 'error', 'debug']
  ) {
    this.ringBuffer = new RingBuffer(capacity);
    this.consoleObj = consoleObj;
    this.methods = methods;
    /** @type {Map<string, Function>} */
    this.originalMethods = new Map();
    /** @type {Map<string, Function>} */
    this.wrappedMethods = new Map();
    this.active = false;
  }

  /**
   * Start intercepting console methods.
   * If already active, this is a no-op.
   */
  start() {
    if (this.active) {
      return;
    }
    for (const method of this.methods) {
      const original = this.consoleObj[method];
      if (typeof original !== 'function') {
        continue;
      }
      this.originalMethods.set(method, original);
      const wrapped = (...args) => {
        this.ringBuffer.push({ method, args });
        original.apply(this.consoleObj, args);
      };
      this.wrappedMethods.set(method, wrapped);
      this.consoleObj[method] = wrapped;
    }
    this.active = true;
  }

  /**
   * Stop intercepting and restore the original console methods.
   * If not active, this is a no-op.
   */
  stop() {
    if (!this.active) {
      return;
    }
    for (const [method, original] of this.originalMethods) {
      this.consoleObj[method] = original;
    }
    this.originalMethods.clear();
    this.wrappedMethods.clear();
    this.active = false;
  }

  /**
   * Get all captured entries in chronological order.
   * Does not modify the buffer.
   * @returns {Array<{method: string, args: any[]}>}
   */
  getEntries() {
    return this.ringBuffer.toArray();
  }

  /**
   * Clear all captured entries.
   */
  clear() {
    this.ringBuffer = new RingBuffer(this.ringBuffer.capacity);
  }
}
