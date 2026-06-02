# 2.0a — Why Node.js Exists

---

## The Problem (Before Node.js)

Apache HTTP Server handled each request with a **new thread**.

```
Apache model:
User 1 connects → spawn Thread 1
User 2 connects → spawn Thread 2
...
User 10,000 → 10,000 threads
```

**Why this breaks at scale:**
- Each thread = ~2MB RAM just to exist
- OS spends CPU time **context switching** between threads
- Most threads are just **waiting** — for DB queries, file reads, network responses
- At high concurrency: memory explodes, performance collapses

This was called the **C10k problem** — how do you handle 10,000 concurrent connections?

---

## Ryan Dahl's Insight (2009 JSConf)

Most of what servers do is **I/O — they wait**. The actual CPU work is tiny.

So: instead of one thread per connection → **one thread + an event loop**.

- When you hit I/O, don't block — register a callback and move on
- When I/O completes, put the callback in a queue
- The event loop picks it up and resumes your code

### What "register a callback and move on" actually means

**Blocking (what threads do):**
```javascript
// Thread stops here and waits — nothing else can run
const data = fs.readFileSync('file.txt');
console.log(data); // only runs after file is fully read
```
Like a waiter who walks to the kitchen, stands there waiting for the food, and can't take any other orders in the meantime.

**Non-blocking (what Node does):**
```javascript
// Hand off to libuv, leave a "note" (callback), keep moving
fs.readFile('file.txt', (err, data) => {
    console.log(data); // runs LATER when OS signals the file is ready
});
console.log('I kept moving'); // runs IMMEDIATELY
```
Output:
```
I kept moving        ← synchronous, runs first
<file contents>      ← callback, runs when OS is done
```
Like a waiter who gives the order to the kitchen, leaves a note saying "bring it to table 5 when ready," and goes to take other orders.

**What happens under the hood:**
```
1. Your JS calls fs.readFile()
2. Node passes the request to libuv
3. libuv tells the OS: "read this file, notify me when done"
4. libuv immediately returns → your JS keeps running
5. OS reads the file in the background
6. OS signals libuv: "done, here's the data"
7. libuv puts your callback in the I/O queue
8. Event loop picks it up → your callback runs
```
Your thread never waited. It registered the callback and moved on.

**With async/await it looks synchronous but works the same way:**
```javascript
async function loadFile() {
    console.log('before');
    const data = await fs.promises.readFile('file.txt'); // suspends here
    console.log('after'); // resumes when file is ready
}

loadFile();
console.log('this runs before "after"');
```
Output:
```
before
this runs before "after"    ← event loop kept going
after                        ← resumed when file was ready
```
`await` is syntactic sugar for the same mechanism — it suspends the function (registers a callback internally) and frees the thread to do other work.

Two components make this work:

| Component | What it is |
|---|---|
| **V8** | Google's JS engine — compiles JavaScript to machine code via JIT |
| **libuv** | C++ library — provides the event loop and non-blocking I/O at the OS level |

```
Node.js = V8 (JS engine) + libuv (event loop + async I/O) + standard library
```

Why JavaScript? It had no existing I/O model (clean slate), first-class functions, and V8 was brand new and fast.

---

## The Event Loop (simplified)

```
while (work exists) {
    1. Run all sync JS (call stack empties)
    2. Run microtasks (Promise .then, queueMicrotask)
    3. Run expired timers (setTimeout, setInterval)
    4. Run I/O callbacks (file done, HTTP response arrived)
    5. Run setImmediate callbacks
    6. Close callbacks
}
```

When you `await fetch(url)` — libuv sends the request at OS level and immediately returns. Your thread keeps running. When the response arrives, libuv queues your callback. Step 4 resumes your code. **The thread never sat idle.**

---

## Tradeoffs

| | Apache/Traditional | Node.js |
|---|---|---|
| Model | Thread per connection | Single thread + event loop |
| I/O | Blocking | Non-blocking |
| Concurrency | ~thousands (OS/memory limited) | ~100k+ (memory only) |
| CPU tasks | Good (multiple threads) | Bad (blocks the loop) |

**Node wins:** I/O-heavy work — RPC calls, DB queries, WebSocket listeners, API servers  
**Node loses:** CPU-heavy work — cryptographic proofs, data crunching → use Go or Rust

---

## Why This Matters for Blockchain

Every blockchain backend is I/O:
- RPC calls to nodes (HTTP/WebSocket)
- DB reads/writes
- Event listeners
- Concurrent API requests

That's why nearly every blockchain SDK, indexer, and tool is in Node/TypeScript.
