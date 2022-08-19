export interface IQClient extends IPublisher {
  publish(queue: string, message: Message): Promise<void>;
  registerConsumer(consumer: IConsumer): Promise<void>;
  registerQueue(queue: string): Promise<void>;
  queueExists(queue: string): Promise<boolean>;
  getQueueSize(queue: string): Promise<number>;
  stop(): Promise<void>;
}

export interface IConsumer {
  get queue(): string;
  get name(): string;
  consume(message: Message): void;
}

export interface IPublisher {
  publish(queue: string, message: Message): Promise<void>;
}

export type Message = {
  id: string;
  data: unknown;
};
