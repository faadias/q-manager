import "dotenv/config"; //!first import to set env variables as first thing

import os from "node:os";
import cluster from "node:cluster";
import QClientRabbitMq from "./client/qClientRabbitMq";
import { QManagerServer } from "./server";

cluster.isPrimary && process.env.NODE_ENV !== "development"
  ? runPrimaryProcess()
  : runWorkerProcess();

function runPrimaryProcess() {
  const MAX_THREADS = 10;
  const MIN_THREADS = 1;
  const cpusCount = os.cpus().length;
  let threadsToRun =
    (process.env.THREADS && parseInt(process.env.THREADS)) || cpusCount;
  threadsToRun = Math.max(Math.min(threadsToRun, MAX_THREADS), MIN_THREADS);

  console.info(`Primary process ${process.pid} is running`);
  console.info(`Forking server with ${threadsToRun} processes`);

  for (let i = 0; i < threadsToRun; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      console.info(
        `[Worker ${process.pid}] Died with signal ${signal}. Scheduling a new worker...`
      );
      cluster.fork();
    }
  });
}

async function runWorkerProcess(): Promise<void> {
  try {
    const server = new QManagerServer(await QClientRabbitMq.getInstance());
    server.start();
  } catch (error) {
    console.error(`[Worker ${process.pid}] Unable to start server...`);
    console.error(error);
  }
}
