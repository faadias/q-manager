import { Controller, Post } from "@overnightjs/core";
import { Request, Response } from "express";
import { BaseRawDataProducerController } from "./baseProducerController";

@Controller("dummy")
export class DummyController extends BaseRawDataProducerController {
  @Post()
  async post(req: Request, res: Response) {
    this.publish("dummy-queue", req.body, req, res);
  }
}
