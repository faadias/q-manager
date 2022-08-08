import { IConsumer } from "./../../src/client/qClientInterface";
import { QueueDoesNotExistError } from "../../src/error/queueDoesNotExistError";
import QClientRabbitMq from "../../src/client/qClientRabbitMq";
import { v4 } from "uuid";

function genQueueName(): string {
  return `queue-${v4()}`;
}

function waitSomeTime(timeInMillis: number) {
  return new Promise((resolve) => setTimeout(resolve, timeInMillis));
}

let client: QClientRabbitMq;

beforeAll(async () => {
  client = await QClientRabbitMq.getInstance();
});
afterAll(async () => {
  await waitSomeTime(3000);
  await client.stop();
});

describe("RabbitMQ Client Specs", () => {
  it("should return true only if a queue exists", async () => {
    const newQueue = genQueueName();
    expect(client.queueExists(newQueue)).resolves.toBe(false);
    await client.registerQueue(newQueue);
    expect(client.queueExists(newQueue)).resolves.toBe(true);
  });

  it("should return an error when trying to publish to non-existent queue", async () => {
    const nonExistentQueue = genQueueName();
    expect(client.queueExists(nonExistentQueue)).resolves.toBe(false);
    expect(
      client.publish(nonExistentQueue, { message: "any message" })
    ).rejects.toThrowError(new QueueDoesNotExistError(nonExistentQueue));
  });

  it("should return an error when trying to consume from a non-existent queue", async () => {
    const nonExistentQueue = genQueueName();
    const testConsumer: IConsumer = {
      queue: nonExistentQueue,
      name: "test-consumer",
      consume(msg) {
        console.log(msg);
      }
    };
    expect(client.queueExists(nonExistentQueue)).resolves.toBe(false);
    expect(client.registerConsumer(testConsumer)).rejects.toThrowError(
      new QueueDoesNotExistError(nonExistentQueue)
    );
  });

  it("should publish and consume messages on an existing queue", async () => {
    const queue = genQueueName();
    await client.registerQueue(queue);
    const testConsumer: IConsumer = {
      queue,
      name: "test-consumer",
      consume: jest.fn()
    };
    const publishingTimes = 3;
    for (let i = 0; i < publishingTimes; i++) {
      await client.publish(queue, { message: `test data ${i + 1}` });
    }
    await client.registerConsumer(testConsumer);
    await waitSomeTime(1000);
    expect(testConsumer.consume).toHaveBeenCalledTimes(publishingTimes);
    expect(testConsumer.consume).toHaveBeenLastCalledWith({
      message: `test data ${publishingTimes}`
    });
  });
});
