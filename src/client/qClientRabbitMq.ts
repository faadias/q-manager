import client, { Channel, ConfirmChannel, Connection } from "amqplib";
import { QueueDoesNotExistError } from "../error/queueDoesNotExistError";
import { IConsumer, IQClient, Message } from "./qClientInterface";

export default class QClientRabbitMq implements IQClient {
  static instance: QClientRabbitMq | null = null;

  private readonly queues: Set<string> = new Set();

  private constructor(
    private readonly connection: Connection,
    private readonly publishChannel: ConfirmChannel,
    private readonly consumeChannel: Channel,
    private readonly queueChannel: Channel
  ) {}

  public static async getInstance(): Promise<QClientRabbitMq> {
    if (QClientRabbitMq.instance) {
      return QClientRabbitMq.instance;
    }

    const [username, password, host, port] = [
      process.env.QUEUE_USER,
      process.env.QUEUE_PWD,
      process.env.QUEUE_HOST,
      process.env.QUEUE_PORT
    ];

    const connection = await client.connect(
      `amqp://${username}:${password}@${host}:${port}`,
      {}
    );

    connection.on("error", (error) => {
      console.error("AMQP:Connection Error:", error);
    });
    connection.on("close", () => {
      console.info("AMQP:Connection Closed");
    });

    const publishChannel = await connection.createConfirmChannel();
    const consumeChannel = await connection.createChannel();
    const queueChannel = await connection.createChannel();

    return (QClientRabbitMq.instance = new QClientRabbitMq(
      connection,
      publishChannel,
      consumeChannel,
      queueChannel
    ));
  }

  async publish(queue: string, data: Message): Promise<void> {
    if (!data) {
      return;
    }

    if (!(await this.queueExists(queue))) {
      throw new QueueDoesNotExistError(queue);
    }

    this.publishChannel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
      persistent: true
    });
  }

  async registerQueue(queue: string): Promise<void> {
    this.queues.add(queue);
    await this.queueChannel.assertQueue(queue, { durable: true });
  }

  async registerConsumer(consumer: IConsumer): Promise<void> {
    if (!(await this.queueExists(consumer.queue))) {
      throw new QueueDoesNotExistError(consumer.queue);
    }

    this.consumeChannel.consume(consumer.queue, (message) => {
      if (message) {
        try {
          consumer.consume(JSON.parse(message.content.toString()));
          this.consumeChannel.ack(message);
        } catch (error) {
          console.error(`AMQP:Consumer '${consumer.name}' Error:`, error);
          this.consumeChannel.nack(message);
        }
      }
    });
  }

  async queueExists(queue: string): Promise<boolean> {
    return this.queues.has(queue);
  }

  async getQueueSize(queue: string): Promise<number> {
    const queueData = await this.queueChannel.checkQueue(queue);
    return queueData.messageCount;
  }

  async stop() {
    await Promise.all([
      this.consumeChannel.close(),
      this.publishChannel.close(),
      this.queueChannel.close()
    ]);
    await this.connection.close();
  }
}
