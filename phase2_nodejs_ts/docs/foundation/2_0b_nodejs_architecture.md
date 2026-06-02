# 2.0b — Node.js Architecture

---

## V8 — The JavaScript Engine

V8 is Google's engine that powers both Chrome and Node.js. Its job: take your JavaScript text and make it run fast.

**How V8 executes your code:**

```
JS source (raw text)
    ↓
Lexer → tokens
    ↓
Parser → AST (Abstract Syntax Tree)
    ↓
Ignition (interpreter) → bytecode  ← starts running immediately
    ↓
TurboFan (JIT compiler) → native machine code  ← for hot code paths
```

**Step 1 — Lexer (Tokenization)**

Your JS file is just text. The lexer breaks it into labelled chunks called tokens:
```
const x = 5 + 3;

→ [keyword: "const"] [identifier: "x"] [operator: "="]
   [number: "5"] [operator: "+"] [number: "3"] [punctuation: ";"]
```

**Step 2 — Parser → AST**

Takes those tokens and builds a tree representing the structure and meaning of the code:
```
const x = 5 + 3;

→ VariableDeclaration (kind: "const")
  └── VariableDeclarator
      ├── id: Identifier (name: "x")
      └── init: BinaryExpression (operator: "+")
          ├── left:  Literal (value: 5)
          └── right: Literal (value: 3)
```
The tree captures *relationships* — "x is being assigned the result of adding 5 and 3."
This is also why syntax errors happen before your code runs — the parser fails to build the tree and throws immediately, before Ignition ever sees the code.

**Step 3 — Ignition**

Walks the AST and generates bytecode. Starts executing immediately — no warmup wait.

**Step 4 — TurboFan**

Watches which functions run often ("hot paths") and compiles them to optimized native machine code mid-execution.

**What is a hot path?**
A hot path is code that runs over and over again. V8 tracks call counts — once a function crosses a threshold, TurboFan kicks in.
```javascript
function setupConfig() { ... }         // called once → cold, stays as bytecode

function processTransaction(tx) {      // called 10,000x/sec → HOT PATH
    return tx.amount * tx.feeRate / 1e18;
}
```
Functions that only run once or twice stay as bytecode — not worth the compilation cost.

**Why does an "interpreted" language have a compiler?**

JavaScript is not purely interpreted. The real spectrum:
```
Pure interpreter       JIT compiled          AOT compiled
(Python's CPython) → (V8, SpiderMonkey) → (Go, Rust, C++)

runs bytecode          compiles hot          compiles everything
line by line           code at runtime       before running
```

JS was designed to run in a browser — the server sends JS text, not a compiled binary. You can't AOT compile it because:
1. The browser doesn't know the target machine in advance (Windows? Mac? ARM? x86?)
2. Users can't wait for a long compilation step before a page loads

So the design: **start fast (interpret), get fast over time (JIT compile hot paths).**
```
Page loads → Ignition interprets immediately   (fast startup)
                  ↓
     TurboFan watches which functions run often
                  ↓
     Compiles those to native machine code for THIS machine
                  ↓
     Same function now runs at near-native speed
```
Node.js inherited this from V8 — and it works well for long-running servers too. The server warms up and gets faster over time. That's why Node.js benchmarks show higher throughput after a warmup period.

**Deoptimization — when TurboFan's assumptions break:**
```javascript
function multiply(a, b) { return a * b; }

// called 50,000 times with numbers → TurboFan compiles a number-specialized version
for (let i = 0; i < 50000; i++) multiply(i, i + 1);

// now called with strings → assumptions break → V8 throws away compiled version
multiply("hello", "world"); // falls back to Ignition bytecode
```
This is why mixing types in hot functions kills JS performance.

---

**Bytecode vs Machine Code**

| | Bytecode | Machine Code |
|---|---|---|
| What runs it | Ignition (interpreter) | CPU directly |
| Portability | Any machine (interpreter handles differences) | CPU-specific (x86, ARM, etc.) |
| Speed | Slower (interpreter overhead every call) | Fastest (no middleman) |
| When generated | Immediately by Ignition | By TurboFan for hot paths only |

```
Bytecode execution:
  each call → interpreter reads instruction → executes → reads next → ...
  [interpreter does work on every single call]

Machine code execution:
  each call → CPU runs binary directly
  [compiled once by TurboFan, no interpreter overhead after]
```

Why not compile to machine code immediately? Two reasons:
1. Compilation takes time — for cold code, interpreting is cheaper than compiling
2. TurboFan needs runtime data — it watches what types are actually passed before it can generate an optimized version. It can't know this upfront.

Analogy: bytecode is reading a recipe every time you cook. Machine code is having it memorized — you just do it.

**What V8 does NOT handle:**
- File system access
- Network I/O
- Timers
- Child processes

All of that is libuv's job.

---

## libuv — The Engine Under the Engine

libuv is a C++ library. It's what actually talks to the OS. V8 executes your JS; libuv does everything else.

```
Your JS code
    ↓ calls
Node.js bindings (C++ bridge)
    ↓ calls
libuv
    ↓ calls
OS kernel (epoll on Linux, kqueue on macOS, IOCP on Windows)
```

libuv has two mechanisms for async work:

### Background: File Descriptors

When you open a file, socket, or network connection, the OS gives you back a small integer called a **file descriptor (fd)** — a handle that represents that resource.
```
open('file.txt')      → OS returns fd: 7
connect to google.com → OS returns fd: 8
```
You don't talk to the resource directly — you talk to the OS using the fd.

---

**1. OS-level async I/O** (for network, pipes)

Modern OS kernels have a feature: give me a list of file descriptors, watch them, and wake me up when any of them have data. On Linux this is `epoll`, on macOS it's `kqueue`.

```
1. Node opens a socket → OS gives back fd: 8
2. libuv registers fd 8 with epoll:
       "hey kernel, watch fd 8 — tell me when data arrives"
3. libuv returns immediately → your JS keeps running
4. Kernel watches fd 8 in the background (OS-level, no thread needed)
5. Response arrives → kernel notifies libuv
6. libuv queues your callback → event loop picks it up
```

The kernel itself does the watching — no extra thread needed. libuv just registered interest and moved on.

---

**2. Thread pool** (for file system, DNS, crypto)

File I/O on most OSes **cannot be made truly async** the same way. `epoll` works great for sockets but has limitations with regular files. So libuv cheats — it uses a thread pool:

```
1. Your JS calls fs.readFile('file.txt', callback)
2. libuv picks an idle thread from the pool (default: 4 threads)
3. That thread makes a BLOCKING read() call to the OS
       (the thread sits and waits — but it's not your JS thread)
4. Your JS thread is free, keeps running
5. Worker thread gets the data back
6. Worker queues your callback → event loop picks it up
```

libuv is still blocking — but it's blocking a *background thread*, not your JS thread.

---

**Side by side:**
```
Network (fetch, WebSocket):
  JS thread → libuv → epoll/kqueue → OS kernel watches → callback
  [no extra thread]

File system (fs.readFile):
  JS thread → libuv → thread pool worker → blocking OS call → callback
  [background thread blocks so your JS thread doesn't have to]
```

So Node.js is single-threaded for your JS, but libuv uses threads internally for things the OS can't do async. You never see those threads from JS.

---

## The Call Stack, Callback Queue, and Microtask Queue

```
┌─────────────────────────────────┐
│           Call Stack             │  ← your synchronous JS runs here
│  (V8 executes functions here)   │     one frame at a time, LIFO
└─────────────────────────────────┘
          ↑ when stack empties
┌─────────────────────────────────┐
│         Microtask Queue          │  ← Promise.then(), async/await resumes,
│    (checked after every task)   │     queueMicrotask() — DRAINS FULLY first
└─────────────────────────────────┘
          ↑ when microtask queue empties
┌─────────────────────────────────┐
│         Macrotask Queue          │  ← setTimeout, setInterval, I/O callbacks,
│    (one task per loop tick)     │     setImmediate — one at a time
└─────────────────────────────────┘
```

**The order that matters:**

```javascript
console.log('1 - sync');

setTimeout(() => console.log('4 - setTimeout'), 0);

Promise.resolve().then(() => console.log('3 - microtask'));

console.log('2 - sync');

// Output: 1, 2, 3, 4
```

Why? Call stack runs sync code first (1, 2). Then **before** taking the next macrotask, the event loop drains the entire microtask queue (3). Only then does it pick up macrotasks (4).

**With async/await:**
```javascript
async function fetchData() {
    console.log('A');
    const result = await somePromise; // suspends here → goes to microtask queue
    console.log('C');                 // resumes here when microtask is picked up
}

fetchData();
console.log('B');

// Output: A, B, C
```

`await` suspends the function and returns control to the caller. When the promise resolves, the continuation is put into the microtask queue and runs before any timers or I/O callbacks.

---

## One Loop Tick

```
1. Run current call stack to empty
2. Drain entire microtask queue (including any new microtasks added during drain)
3. Pick ONE macrotask (timer, I/O callback, etc.)
4. Drain microtask queue again
5. Repeat
```

---

## Full Picture

```
Your Code (JS)
    │
    ├── sync work → call stack (V8 executes directly)
    │
    ├── Promise.then / await → microtask queue
    │
    ├── setTimeout/setInterval → timer phase (libuv tracks expiry)
    │
    └── fs.readFile / fetch / net → libuv
            ├── network I/O → OS kernel (epoll) → I/O callback queue
            └── file I/O → libuv thread pool → I/O callback queue
```

---

## Why This Matters Practically

```javascript
// DANGER — blocks the event loop, no other requests can be served
app.get('/data', (req, res) => {
    const start = Date.now();
    while (Date.now() - start < 5000) {} // busy loop — 5 seconds
    res.send('done');
});

// CORRECT — hands off to libuv, event loop stays free
app.get('/data', async (req, res) => {
    const data = await fs.promises.readFile('bigfile.txt');
    res.send(data);
});
```

One CPU-bound task blocks ALL other requests. Non-blocking I/O lets the loop keep serving requests while waiting.

> Note: We will go much deeper into event loop phases, starvation, `process.nextTick` vs `setImmediate`, worker threads, and clustering in **milestone 2.2 — Async Mastery**.
