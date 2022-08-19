import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (process.env.API_KEY && process.env.API_KEY !== req.query.apiKey) {
    res.status(StatusCodes.UNAUTHORIZED).send();
  } else {
    next();
  }
}
