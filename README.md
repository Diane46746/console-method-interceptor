# Console Method Interceptor

Wraps global console methods so every call is forwarded to the original log while also being captured into a fixed-size ring buffer for later retrieval.

## Usage

```javascript
import { ConsoleMethodInterceptor } from './src/index.js';

const interceptor = new ConsoleMethodInterceptor(100);
interceptor.start();

console.log('hello', 42);
console.warn('be careful');

const entries = interceptor.getEntries();
// entries = [
//   { method: 'log', args: ['hello', 42] },
//   { method: 'warn', args: ['be careful'] }
// ]

interceptor.stop();
```

The constructor accepts an optional custom console object and an optional list of method names to intercept. By default it wraps `log`, `info`, `warn`, `error`, and `debug` on the global `console`.

```javascript
const fakeConsole = {
  log: (...args) => { /* ... */ },
};
const interceptor = new ConsoleMethodInterceptor(10, fakeConsole, ['log']);
```

## Why this library exists

When debugging complex applications, it is often useful to see what has been logged recently without printing everything twice or losing output to a file. This interceptor solves that by keeping a bounded history of console calls in memory. The trade-off is that the buffer has a fixed size: once full, the oldest entries are silently dropped. This is intentional — an unbounded buffer would grow without limit and eventually exhaust memory.

## Edge cases

- The ring buffer overwrites the oldest entries when capacity is reached.
- Calling `start()` more than once has no effect; calling `stop()` more than once has no effect.
- Arguments are stored by reference. If an object is logged and later mutated, the captured entry will reflect the mutation.
- If a configured method is not a function on the console object (for example, a custom console without `debug`), it is skipped without error.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

