import { ClassMiddleware, Controller, Post } from "@overnightjs/core";
import { Request, Response } from "express";
import { BaseRawDataProducerController } from "../../src/controller/baseRawDataProducerController";
import { authMiddleware } from "../../src/middleware/authMiddleware";

@Controller("test")
@ClassMiddleware([authMiddleware])
export class TestProducerController extends BaseRawDataProducerController {
  @Post()
  async post(req: Request, res: Response) {
    this.publish("test-queue", req.body, req, res);
  }
}
