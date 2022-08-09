import "dotenv/config"; //!first import to set env variables as first thing

import { Server } from "@overnightjs/core";
import bodyParser from "body-parser";
import config from "config";
import cors from "cors";
import express from "express";
import { readdirSync, existsSync } from "fs";
import { Server as HttpServer } from "http";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { IConsumer, IQClient } from "./client/qClientInterface";
import QClientRabbitMq from "./client/qClientRabbitMq";
import os from "node:os";
import cluster from "node:cluster";

cluster.isPrimary && process.env.NODE_ENV !== "development"
  ? runPrimaryProcess()
  : runWorkerProcess();

function runPrimaryProcess() {
  const procCount = os.cpus().length;
  console.info(`Primary process ${process.pid} is running`);
  console.info(`Forking server with ${procCount} processes`);
  for (let i = 0; i < procCount; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      console.info(
        `Worker ${process.pid} died with signal ${signal}. Scheduling a new one...`
      );
      cluster.fork();
    }
  });
}

async function runWorkerProcess(): Promise<void> {
  const qClient = await QClientRabbitMq.getInstance();
  const server = new Server();
  setupGlobalMiddlewares(server, qClient);
  await setupControllers(server);
  await startServer(server, qClient);
  await setupQClient(qClient);
}

function setupGlobalMiddlewares(server: Server, qClient: IQClient) {
  server.app.use(
    bodyParser.json(config.get("middlewares.json") as bodyParser.OptionsJson)
  );
  server.app.use(
    express.urlencoded(
      config.get("middlewares.urlencoded") as bodyParser.OptionsUrlencoded
    )
  );
  server.app.use(cors(config.get("middlewares.cors") as cors.CorsOptions));

  server.app.use((req, res, next) => {
    req.publisher = qClient;
    req.uuid = uuid();
    next();
  });
}

async function setupControllers(server: Server) {
  const controllerFolderName = "controller";
  const controllersFolder = join(__dirname, controllerFolderName);
  const onlyTSorJSFilesFilter = (filename: string) => filename.match(/[tj]s$/);
  const controllersFiles = existsSync(controllersFolder)
    ? readdirSync(controllersFolder)
        .filter(onlyTSorJSFilesFilter)
        .map((filename) => join(controllersFolder, filename))
    : [];

  if (process.env.NODE_ENV === "test") {
    const controllersTestFolder = join(
      __dirname,
      "..",
      "test",
      controllerFolderName
    );
    if (existsSync(controllersTestFolder)) {
      controllersFiles.push(
        ...readdirSync(controllersTestFolder)
          .filter(onlyTSorJSFilesFilter)
          .map((filename) => join(controllersTestFolder, filename))
      );
    }
  }

  const controllers: unknown[] = [];
  for (const filename of controllersFiles) {
    const module = await import(filename);
    controllers.push(new module[Object.keys(module)[0]]());
  }
  server.addControllers(controllers);

  server.app.use((req, res, next) => {
    res.status(404);
    next();
  });
}

async function startServer(server: Server, qClient: IQClient) {
  const port = parseInt(process.env.PORT || "3000");
  const httpServer = server.app.listen(port, () => {
    console.info(`Server listening on port: ${port}`);
  });

  process.on("SIGTERM", () => shutdownServer(httpServer, qClient));
  process.on("SIGINT", () => shutdownServer(httpServer, qClient));
  process.on("uncaughtException", (error, origin) => {
    console.error(`${origin} signal received: ${error}`);
    shutdownServer(httpServer, qClient);
  });
  process.on("unhandledRejection", (error) => {
    console.error(`uncaught promise: ${error}`);
    shutdownServer(httpServer, qClient);
  });
}

async function setupQClient(qClient: IQClient) {
  const consumerFolderName = "consumer";
  const consumersFolder = join(__dirname, consumerFolderName);
  const onlyTSorJSFilesFilter = (filename: string) => filename.match(/[tj]s$/);
  const consumersFiles = existsSync(consumersFolder)
    ? readdirSync(consumersFolder)
        .filter(onlyTSorJSFilesFilter)
        .map((filename) => join(consumersFolder, filename))
    : [];
  if (process.env.NODE_ENV === "test") {
    const consumersTestFolder = join(
      __dirname,
      "..",
      "test",
      consumerFolderName
    );
    if (existsSync(consumersTestFolder)) {
      consumersFiles.push(
        ...readdirSync(consumersTestFolder)
          .filter(onlyTSorJSFilesFilter)
          .map((filename) => join(consumersTestFolder, filename))
      );
    }
  }

  for (const filename of consumersFiles) {
    const module = await import(filename);
    const consumer: IConsumer = new module[Object.keys(module)[0]]();
    await qClient.registerQueue(consumer.queue);
    qClient.registerConsumer(consumer);
  }
}

async function shutdownServer(httpServer: HttpServer, qClient: IQClient) {
  console.info("Shutting down gracefully");
  httpServer.close(async () => {
    try {
      await qClient.stop();
      console.info("Closed remaining connections");
      process.exit(0);
    } catch (error) {
      console.error(`Unable to shutdown: ${error}`);
      process.exit(1);
    }
  });
}
