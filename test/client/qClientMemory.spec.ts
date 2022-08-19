import { IConsumer, Message } from "./../../src/client/qClientInterface";
import { QueueDoesNotExistError } from "../../src/error/queueDoesNotExistError";
import QClientMemory from "./qClientMemory";
import { v4 } from "uuid";

function genQueueName(): string {
  return `queue-${v4()}`;
}

function waitSomeTime(timeInMillis: number) {
  return new Promise((resolve) => setTimeout(resolve, timeInMillis));
}

let client: QClientMemory;

beforeAll(async () => {
  client = await QClientMemory.getInstance();
});
afterAll(async () => {
  await waitSomeTime(3000);
  await client.stop();
});

describe("Memory Client Specs", () => {
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
      client.publish(nonExistentQueue, {
        id: v4(),
        data: { message: "any message" }
      })
    ).rejects.toThrowError(new QueueDoesNotExistError(nonExistentQueue));
  });

  it("should return an error when trying to consume from a non-existent queue", async () => {
    const nonExistentQueue = genQueueName();
    const testConsumer: IConsumer = {
      queue: nonExistentQueue,
      name: "test-consumer",
      consume(msg) {
        console.info(msg);
      }
    };
    expect(client.queueExists(nonExistentQueue)).resolves.toBe(false);
    expect(client.registerConsumer(testConsumer)).rejects.toThrowError(
      new QueueDoesNotExistError(nonExistentQueue)
    );
  });

  it("should publish messages on an existing queue", async () => {
    const queue = genQueueName();
    await client.registerQueue(queue);

    const publishingTimes = 11;
    for (let i = 0; i < publishingTimes; i++) {
      await client.publish(queue, {
        id: v4(),
        data: { message: `test data ${i + 1}` }
      });
    }
    await waitSomeTime(1000);

    const queueSize = await client.getQueueSize(queue);

    expect(queueSize).toBe(publishingTimes);
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
    let message: Message | undefined = undefined;
    for (let i = 0; i < publishingTimes; i++) {
      message = {
        id: v4(),
        data: { message: `test data ${i + 1}` }
      };
      client.publish(queue, message);
    }
    await waitSomeTime(1000);

    await client.registerConsumer(testConsumer);

    await waitSomeTime(1000);

    expect(message).toBeDefined();
    expect(testConsumer.consume).toHaveBeenCalledTimes(publishingTimes);
    expect(testConsumer.consume).toHaveBeenLastCalledWith(message);
  });
});
