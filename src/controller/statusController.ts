import { Controller, Get } from "@overnightjs/core";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

@Controller("status")
export class StatusController {
  @Get("health")
  public checkHealth(req: Request, res: Response) {
    res.status(StatusCodes.OK).send("Server ON");
  }

  @Get()
  public config(req: Request, res: Response) {
    const now = new Date();

    const status = {
      environment: process.env.NODE_ENV,
      timezone: process.env.TZ,
      now: now.toISOString(),
      offset: now.getTimezoneOffset()
    };

    res.status(StatusCodes.OK).send(status);
  }
}
