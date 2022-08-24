import { QueueDoesNotExistError } from "../../src/error/queueDoesNotExistError";
import {
  IConsumer,
  Message,
  IQClient
} from "../../src/client/qClientInterface";

let memory: { [key: string]: Array<Message> } = {};
let consumers: { [key: string]: Array<IConsumer> } = {};

export default class QClientMemory implements IQClient {
  static instance: QClientMemory;

  private polling: NodeJS.Timer | undefined = undefined;

  public static async getInstance(): Promise<QClientMemory> {
    return (QClientMemory.instance = QClientMemory.instance
      ? QClientMemory.instance
      : new QClientMemory());
  }

  private constructor() {
    this.startQueuePolling();
  }

  async publish(queue: string, message: Message): Promise<void> {
    if (!(queue in memory)) {
      throw new QueueDoesNotExistError(queue);
    }

    memory[queue].push(message);
  }

  async registerConsumer(consumer: IConsumer): Promise<void> {
    const queue = consumer.queue;

    if (!(queue in memory)) {
      throw new QueueDoesNotExistError(queue);
    }

    if (!(queue in consumers)) {
      consumers[queue] = [];
    }

    consumers[queue].push(consumer);
  }

  async unregisterConsumer(consumerName: string): Promise<void> {
    for (const queueName in consumers) {
      const consumerIndex = consumers[queueName].findIndex(
        (consumer) => consumer.name === consumerName
      );
      if (consumerIndex !== -1) {
        consumers[queueName].splice(consumerIndex, 1);
      }
    }
  }

  async registerQueue(queue: string): Promise<void> {
    if (!(queue in memory)) {
      memory[queue] = [];
    }
  }

  async queueExists(queue: string): Promise<boolean> {
    return queue in memory;
  }

  async getQueueSize(queue: string): Promise<number> {
    if (!(queue in memory)) {
      throw new QueueDoesNotExistError(queue);
    }

    return memory[queue].length;
  }

  async stop(): Promise<void> {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = undefined;
    }
    memory = {};
    consumers = {};
    console.info("Memory client stopped");
  }

  private startQueuePolling(): void {
    if (this.polling) {
      return;
    }

    let inProgressPolling = false;
    this.polling = setInterval(() => {
      if (inProgressPolling) {
        return;
      }

      inProgressPolling = true;
      for (const queue in consumers) {
        consumers[queue].forEach(async (consumer) => {
          const message = memory[queue].shift();
          if (!message || !this.polling) {
            return;
          }

          try {
            consumer.consume(message);
          } catch (error) {
            memory[queue].unshift(message);
          }
        });
      }

      inProgressPolling = false;
    }, 100);
  }
}
