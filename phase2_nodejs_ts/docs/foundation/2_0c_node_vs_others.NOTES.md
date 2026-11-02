# 2.0c — Node vs Others · Reading notes

Read 2026-10-29. First doc I read *against* my own experience instead of flat — 5 problems solved
before opening it. Conclusion up front: **it's right about everything it says, and it would not have
prevented a single bug I've hit.** It's a *chooser's* document (which runtime do I pick?), not a
*practitioner's* one (what will hurt me once I've picked?).

---

## 1 — "Node is bad at CPU work": when is that fatal, and when is it just slower?

The mechanism (mine): Node is built for *waiting* work — network requests, websockets, DB queries. It's
single-threaded, so when CPU-intensive work arrives, every other request queues behind it and runs after.

But the doc states this as a verdict, and 02 is my own proof that it's usually survivable. I kept the
hashing **in Node, in one process**, yielded to the loop, and got the health endpoint back for 17%
more total time. The doc would have sent me to Go.

| | Merely slower | Actually fatal |
|---|---|---|
| Shape of work | divisible into independent pieces | one indivisible computation (ZK proof, ML inference) |
| Share of the service | CPU work is a **minority** of the process's job | CPU work **is** the service |
| Right move | yield to the loop (02's fix) | `worker_threads`, or a different runtime |

**Correction to my own answer:** I said Go and Rust "run instantly because they are compiled". That
conflates **startup** with **throughput**. JIT warmup matters for short-lived processes (a CLI, a lambda
cold start); in a long-running server V8 compiles to machine code too, and single-core CPU throughput is
usually within a small factor of Go — not a different league. The decisive advantage is **parallelism
across cores** (plus lower memory, and no GC pauses in Rust). Go isn't 8× faster because it's compiled.
It's 8× faster because it used 8 cores.

Also: the real cost of blocking isn't throughput, it's **p99 latency and failing health checks** — the
pod gets killed and the crash loop indexes nothing. (02's debrief.)

---

## 2 — Which of the things I hand-built would Go have given me free?

My answer was "Go gives multi-threading, so the blocking condition can't happen". Half the picture, and
the interesting half runs the *opposite* way to what I expected.

**04 (the concurrency pool): nearly free in Go.**

```go
g, _ := errgroup.WithContext(ctx)
g.SetLimit(5)        // ← the entire pool I hand-wrote
```

A buffered channel as a semaphore, or `errgroup.SetLimit`. My worker-plus-cursor design is a few lines
of idiomatic Go.

**03 (the nonce manager): *harder* in Go.** My lock-free critical section —

```ts
const nonce = this.nonces.get(address)!;
this.nonces.set(address, nonce + 1);
```

— is only safe because Node never preempts mid-statement. In Go that is a genuine data race across
goroutines: I'd need a `sync.Mutex`, and `go test -race` would fail me without one. Go's stdlib even
ships `golang.org/x/sync/singleflight`, which *is* problem 03 as a package — because in Go you can't get
away with what I did.

**The honest trade: Go hands you the pool and charges you for the shared state.**

And Go doesn't abolish blocking — it abolishes the *single shared loop*. A goroutine burning CPU still
occupies an OS thread; the scheduler just has others to run.

---

## 3 — Does "if it waits → Node" explain why 03, 04 and 05 were hard?

**No.** The rule tells me Node is the right *tool* for waiting work. It says nothing about the fact that
waiting is exactly **where all the difficulty lives**. Node makes waiting **cheap**, not **simple** —
every `await` is a scheduling boundary, and 03, 04 and 05 were all bugs that lived at those boundaries.

**I got the hazard backwards in my first answer** — I said race conditions in Node "could lead to a torn
cursor". Node *cannot* tear a read. That's the one thing single-threading does buy, and it's what my own
04 notes say:

```
torn read    = another thread interrupts MID-STATEMENT   → impossible in Node
interleaving = another task runs AT YOUR await           → the only hazard in Node
```

`next++` is atomic in Node and a data race in Go. The two hazards are distinct and I had them swapped.

---

## The doc's rule of thumb, kept

> If it waits → Node · If it computes → Go or Rust · If it's a protocol or on-chain program → Rust

Still a good *selection* heuristic. Just not a difficulty estimate.
