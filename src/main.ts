import "dotenv/config"; //!first import to set env variables as first thing

import { Server } from "@overnightjs/core";
import bodyParser from "body-parser";
import config from "config";
import cors from "cors";
import express from "express";
import { readdirSync } from "fs";
import { Server as HttpServer } from "http";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { IConsumer, IQClient } from "./client/qClientInterface";
import QClientRabbitMq from "./client/qClientRabbitMq";

(async function init(): Promise<void> {
  const qClient = await QClientRabbitMq.getInstance();
  const server = new Server();
  setupGlobalMiddlewares(server, qClient);
  await setupControllers(server);
  await startServer(server, qClient);
  await setupQClient(qClient);
})();

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
  const controllersFolder = join(__dirname, "controller");
  const onlyTSorJSFilesFilter = (filename: string) => filename.match(/[tj]s$/);
  const controllersFiles = readdirSync(controllersFolder).filter(
    onlyTSorJSFilesFilter
  );

  const controllers: unknown[] = [];
  for (const filename of controllersFiles) {
    const module = await import(join(controllersFolder, filename));
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
  const consumersFolder = join(__dirname, "consumer");
  const onlyTSorJSFilesFilter = (filename: string) => filename.match(/[tj]s$/);
  const consumersFiles = readdirSync(consumersFolder).filter(
    onlyTSorJSFilesFilter
  );

  for (const filename of consumersFiles) {
    const module = await import(join(consumersFolder, filename));
    const consumer: IConsumer = new module[Object.keys(module)[0]]();
    qClient.registerQueue(consumer.queue);
    qClient.registerConsumer(consumer);
  }
}

async function shutdownServer(httpServer: HttpServer, qClient: IQClient) {
  console.info("Shutting down gracefully");
  httpServer.close(async () => {
    await qClient.stop();
    console.info("Closed remaining connections");
    process.exit(0);
  });
}
