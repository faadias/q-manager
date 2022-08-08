import { Controller, Post } from "@overnightjs/core";
import { Request, Response } from "express";
import { BaseRawDataProducerController } from "../../src/controller/baseProducerController";

@Controller("test")
export class TestProducerController extends BaseRawDataProducerController {
  @Post()
  async post(req: Request, res: Response) {
    this.publish("test-queue", req.body, req, res);
  }
}
