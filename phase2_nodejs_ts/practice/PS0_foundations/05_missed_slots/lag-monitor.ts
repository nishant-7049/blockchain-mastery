export type LagReport = { maxLagMs: number; samples: number };

export function startLagMonitor(intervalMs: number): { stop(): LagReport } {
  throw new Error("TODO: implement startLagMonitor");
}
