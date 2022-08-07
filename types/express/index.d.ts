import { IPublisher } from "./../../src/client/qClientInterface";

declare module "express-serve-static-core" {
  export interface Request {
    publisher: IPublisher;
    uuid: string;
  }
}
