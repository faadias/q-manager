import config from "config";
import express from "express";
import cors from "cors";
import { Server } from "@overnightjs/core";
import { Server as HttpServer } from "http";
import bodyParser from "body-parser";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { IConsumer, IQClient } from "./client/qClientInterface";
import { v4 as uuid } from "uuid";

export class QManagerServer extends Server {
  constructor(private readonly qClient: IQClient) {
    super();
  }

  async start() {
    await this.setupQClient();
    await this.setupMiddlewares();
    await this.setupControllers();
    await this.initialize();
  }

  private async initialize() {
    const port = parseInt(process.env.PORT || "3000");
    const httpServer = this.app.listen(port, () => {
      console.info(`Server listening on port: ${port}`);
    });

    process.on("SIGTERM", () => shutdownServer(httpServer, this.qClient));
    process.on("SIGINT", () => shutdownServer(httpServer, this.qClient));
    process.on("uncaughtException", (error, origin) => {
      console.error(`${origin} signal received: ${error}`);
      shutdownServer(httpServer, this.qClient);
    });
    process.on("unhandledRejection", (error) => {
      console.error(`uncaught promise: ${error}`);
      shutdownServer(httpServer, this.qClient);
    });
  }

  private async setupControllers() {
    const controllerFolderName = "controller";
    const controllersFolder = join(__dirname, controllerFolderName);

    const controllersFiles = readTsOrJsFilesFromFolder(controllersFolder);

    if (process.env.NODE_ENV === "test") {
      const controllersTestFolder = join(
        __dirname,
        "..",
        "test",
        controllerFolderName
      );
      if (existsSync(controllersTestFolder)) {
        controllersFiles.push(
          ...readTsOrJsFilesFromFolder(controllersTestFolder)
        );
      }
    }

    const controllers = await Promise.all(
      controllersFiles.map(importModuleFromFilename)
    );
    super.addControllers(controllers);
  }

  private async setupMiddlewares() {
    this.app.use(
      bodyParser.json(config.get("middlewares.json") as bodyParser.OptionsJson)
    );
    this.app.use(
      express.urlencoded(
        config.get("middlewares.urlencoded") as bodyParser.OptionsUrlencoded
      )
    );
    this.app.use(cors(config.get("middlewares.cors") as cors.CorsOptions));

    this.app.use((req, res, next) => {
      req.publisher = this.qClient;
      req.uuid = uuid();
      next();
    });
  }

  private async setupQClient() {
    const consumerFolderName = "consumer";
    const consumersFolder = join(__dirname, consumerFolderName);
    const consumersFiles = readTsOrJsFilesFromFolder(consumersFolder);
    if (process.env.NODE_ENV === "test") {
      const consumersTestFolder = join(
        __dirname,
        "..",
        "test",
        consumerFolderName
      );
      if (existsSync(consumersTestFolder)) {
        consumersFiles.push(...readTsOrJsFilesFromFolder(consumersTestFolder));
      }
    }

    const consumers = (await Promise.all(
      consumersFiles.map(importModuleFromFilename)
    )) as IConsumer[];

    await Promise.all(
      consumers.map((consumer) => this.qClient.registerQueue(consumer.queue))
    );
    await Promise.all(
      consumers.map((consumer) => this.qClient.registerConsumer(consumer))
    );
  }
}

function readTsOrJsFilesFromFolder(folder: string) {
  const onlyTsOrJSFilesFilter = (filename: string) => filename.match(/[tj]s$/);
  return existsSync(folder)
    ? readdirSync(folder)
        .filter(onlyTsOrJSFilesFilter)
        .map((filename) => join(folder, filename))
    : [];
}

async function importModuleFromFilename(filename: string) {
  const module = await import(filename);
  return new module[Object.keys(module)[0]]();
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
