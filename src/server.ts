import { buildApp } from "./app.js";
import { config } from "./config.js";
import { startWorkerLoop } from "./worker-loop.js";

const app = buildApp();
await app.listen({ port: config().PORT, host: "0.0.0.0" });
app.log.info(`send mode: ${config().SEND_MODE}`);
if (config().RUN_WORKER) startWorkerLoop((m) => app.log.info(m));
