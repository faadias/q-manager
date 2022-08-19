import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { QueueDoesNotExistError } from "../error/queueDoesNotExistError";

export abstract class BaseRawDataProducerController {
  async publish(queue: string, data: unknown, req: Request, res: Response) {
    try {
      const id = req.uuid;

      await req.publisher.publish(queue, {
        id,
        data
      });

      res.status(StatusCodes.CREATED).send();
    } catch (error) {
      if (error instanceof QueueDoesNotExistError) {
        res.status(StatusCodes.NOT_FOUND).send(error.message);
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send();
    }
  }
}
