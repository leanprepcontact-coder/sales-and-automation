// Standalone scheduler, for when RUN_WORKER=false on the web process.
import { startWorkerLoop } from "./worker-loop.js";

startWorkerLoop();
