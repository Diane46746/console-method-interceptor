import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleMethodInterceptor } from '../src/core.js';

// A fake console that records calls without writing to stdout.
function createFakeConsole() {
  const calls = [];
  const makeMethod = (name) => (...args) => {
    calls.push({ method: name, args });
  };
  return {
    log: makeMethod('log'),
    info: makeMethod('info'),
    warn: makeMethod('warn'),
    error: makeMethod('error'),
    debug: makeMethod('debug'),
    calls,
  };
}

test('constructor throws on invalid capacity', () => {
  assert.throws(() => new ConsoleMethodInterceptor(0), RangeError);
  assert.throws(() => new ConsoleMethodInterceptor(-1), RangeError);
  assert.throws(() => new ConsoleMethodInterceptor(1.5), RangeError);
  assert.throws(() => new ConsoleMethodInterceptor(NaN), RangeError);
});

test('start forwards calls to original methods and captures entries', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole);
  interceptor.start();

  fakeConsole.log('hello', 42);
  fakeConsole.warn('careful');

  assert.equal(fakeConsole.calls.length, 2);
  assert.deepEqual(fakeConsole.calls[0], { method: 'log', args: ['hello', 42] });
  assert.deepEqual(fakeConsole.calls[1], { method: 'warn', args: ['careful'] });

  const entries = interceptor.getEntries();
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { method: 'log', args: ['hello', 42] });
  assert.deepEqual(entries[1], { method: 'warn', args: ['careful'] });
});

test('stop restores original methods and stops capturing', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole);
  interceptor.start();

  fakeConsole.log('first');
  interceptor.stop();
  fakeConsole.log('second');

  assert.equal(fakeConsole.calls.length, 2);
  assert.deepEqual(fakeConsole.calls[0], { method: 'log', args: ['first'] });
  assert.deepEqual(fakeConsole.calls[1], { method: 'log', args: ['second'] });

  const entries = interceptor.getEntries();
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], { method: 'log', args: ['first'] });
});

test('start is idempotent', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole);
  interceptor.start();
  interceptor.start();

  fakeConsole.log('only once');

  assert.equal(fakeConsole.calls.length, 1);
  assert.equal(interceptor.getEntries().length, 1);
});

test('stop is idempotent', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole);
  interceptor.start();
  interceptor.stop();
  interceptor.stop();

  fakeConsole.log('after stop');

  assert.equal(fakeConsole.calls.length, 1);
  assert.equal(interceptor.getEntries().length, 0);
});

test('ring buffer overwrites oldest entries when capacity is reached', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(3, fakeConsole);
  interceptor.start();

  fakeConsole.log('a');
  fakeConsole.log('b');
  fakeConsole.log('c');
  fakeConsole.log('d');
  fakeConsole.log('e');

  const entries = interceptor.getEntries();
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { method: 'log', args: ['c'] });
  assert.deepEqual(entries[1], { method: 'log', args: ['d'] });
  assert.deepEqual(entries[2], { method: 'log', args: ['e'] });
});

test('clear empties the buffer but keeps interception active', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(5, fakeConsole);
  interceptor.start();

  fakeConsole.log('one');
  fakeConsole.log('two');
  interceptor.clear();

  assert.equal(interceptor.getEntries().length, 0);

  fakeConsole.log('three');
  assert.equal(interceptor.getEntries().length, 1);
  assert.deepEqual(interceptor.getEntries()[0], { method: 'log', args: ['three'] });
});

test('only configured methods are intercepted', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole, ['log', 'error']);
  interceptor.start();

  fakeConsole.log('captured');
  fakeConsole.warn('not captured');
  fakeConsole.error('captured too');

  assert.equal(fakeConsole.calls.length, 3);
  const entries = interceptor.getEntries();
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { method: 'log', args: ['captured'] });
  assert.deepEqual(entries[1], { method: 'error', args: ['captured too'] });
});

test('methods that are not functions on console are skipped gracefully', () => {
  const fakeConsole = createFakeConsole();
  // Remove the debug method to simulate a console without it.
  delete fakeConsole.debug;
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole);
  interceptor.start();

  fakeConsole.log('hello');
  // No error should be thrown, and the missing method should be ignored.
  assert.equal(fakeConsole.calls.length, 1);
  assert.equal(interceptor.getEntries().length, 1);
});

test('arguments are captured by reference, not cloned', () => {
  const fakeConsole = createFakeConsole();
  const interceptor = new ConsoleMethodInterceptor(10, fakeConsole);
  interceptor.start();

  const obj = { value: 1 };
  fakeConsole.log(obj);
  obj.value = 2;

  const entries = interceptor.getEntries();
  assert.equal(entries[0].args[0], obj);
  assert.equal(entries[0].args[0].value, 2);
});
