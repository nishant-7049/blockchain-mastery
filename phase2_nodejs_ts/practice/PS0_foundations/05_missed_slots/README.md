# 05 — Missed Slots

**Difficulty:** ★★☆ · **Concept:** timers are "not before" guarantees, measuring event loop lag, `ref`/`unref` and process lifetime

---

## 🚨 The Incident

Your Solana-style block producer has to act every **400ms** (one slot). You scheduled it with
`setInterval(produce, 400)`. Grafana shows you **miss 1 slot in 20**, and nobody knows why.
CPU sits at 30% and memory looks fine.

Before anyone can fix it, the team needs to **see** the problem. Your job is to build the instrument.

## 🎯 Your Task

Implement `startLagMonitor(intervalMs)` in `lag-monitor.ts`. It returns `{ stop }`, and `stop()` returns a report:

```ts
const monitor = startLagMonitor(10);
// ... app runs ...
const { maxLagMs, samples } = monitor.stop();
```

- **lag** = how much *later* a timer fired than it was scheduled to. `maxLagMs` is the largest lag seen. `samples` is how many measurements were taken.
- An idle event loop should report a lag of only a few ms.
- If something blocks the loop for 200ms, the report must show a `maxLagMs` of about 200.
- After `stop()`, **nothing** the monitor created may still be scheduled.
- A running monitor must **not keep the process alive**. If the app finishes all its work and forgets to call `stop()`,
  Node must still exit.
- Don't use `perf_hooks.monitorEventLoopDelay`. That's the built-in answer; you're building it yourself.

```bash
npm run check 05
```

## 🧠 Concept Briefing

- `setTimeout(fn, 10)` means "run fn **no earlier than** 10ms from now." The callback can only run when the
  loop reaches the timers phase, and the loop can't get there while the call stack is busy.
- `Date.now()` has 1ms resolution and can jump when the system clock changes (NTP). `performance.now()` is monotonic and sub-ms.
- Node keeps running as long as there are **ref'd** handles (timers, sockets, servers). Every timer is ref'd by default.

<details><summary>Hint 1</summary>

Schedule a timer. When it fires, compare `performance.now()` to the time you *expected* it to fire. The difference is the lag.
Then schedule the next timer.
</details>

<details><summary>Hint 2</summary>

`setTimeout` returns a `Timeout` object. Look at its methods in the Node docs, especially one that makes the timer not hold the process open.
</details>

<details><summary>Hint 3</summary>

A chained `setTimeout` is easier to reason about than `setInterval`. You always know which single timer is pending, so `stop()` can clear it.
</details>

## 🔍 Debrief

1. Going back to the incident: which kinds of code could cause a 400ms timer to fire late in a real service? Name three.
2. Why does lag measured by a *timer* also tell you how long an incoming HTTP request would wait before its handler starts?
3. Why do metrics libraries (`prom-client`) `unref()` their timers?
4. `setInterval` under heavy load: do missed ticks pile up and fire in a burst, or get skipped? Write a tiny experiment to find out.
