export class QueueDoesNotExistError extends Error {
  constructor(public queue: string) {
    super(`A queue with name '${queue}' does not exist!`);
    this.name = "QueueDoesNotExistError";
    Error.captureStackTrace(this, this.constructor);
  }
}
