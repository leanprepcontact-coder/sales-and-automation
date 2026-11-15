import { config } from "./config.js";
import { tick } from "./engine.js";

export function startWorkerLoop(log: (m: string) => void = console.log): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const r = await tick();
      if (r.processed || r.swept) log(`tick: ${JSON.stringify(r)}`);
    } catch (e) {
      log(`tick failed: ${(e as Error).message}`);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, config().TICK_SECONDS * 1000);
  return () => clearInterval(timer);
}
