import { IConsumer, Message } from "./../../src/client/qClientInterface";
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
const testConsumerName = "test-consumer";

beforeAll(async () => {
  client = await QClientRabbitMq.getInstance();
});
afterEach(async () => {
  client.unregisterConsumer(testConsumerName);
});
afterAll(async () => {
  await waitSomeTime(3000);
  await client.stop();
});

describe("RabbitMQ Client Specs", () => {
  it("should always return the same instance of a QClient", async () => {
    expect(client === (await QClientRabbitMq.getInstance())).toBeTruthy();
  });

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
      name: testConsumerName,
      consume(msg) {
        console.info(msg);
      }
    };
    expect(client.queueExists(nonExistentQueue)).resolves.toBe(false);
    expect(client.registerConsumer(testConsumer)).rejects.toThrowError(
      new QueueDoesNotExistError(nonExistentQueue)
    );
  });

  it("should return an error when trying to get the size of a non-existing queue", async () => {
    const nonExistentQueue = genQueueName();
    expect(client.getQueueSize(nonExistentQueue)).rejects.toThrowError(
      new QueueDoesNotExistError(nonExistentQueue)
    );
  });

  it.only("should publish messages on an existing queue", async () => {
    const queue = genQueueName();
    await client.registerQueue(queue);

    const publishingTimes = 11;
    for (let i = 0; i < publishingTimes; i++) {
      await client.publish(queue, {
        id: v4(),
        data: { message: `test data ${i + 1}` }
      });
    }
    await waitSomeTime(1000); //precisa aguardar até o RabbitMQ efetivamente colocar as mensagens na fila

    const queueSize = await client.getQueueSize(queue);

    expect(queueSize).toBe(publishingTimes);
  });

  it("should publish and consume messages on an existing queue", async () => {
    const queue = genQueueName();
    await client.registerQueue(queue);
    const testConsumer: IConsumer = {
      queue,
      name: testConsumerName,
      consume: jest.fn()
    };
    const publishingTimes = 3;
    let message: Message | undefined = undefined;
    for (let i = 0; i < publishingTimes; i++) {
      message = {
        id: v4(),
        data: { message: `test data ${i + 1}` }
      };
      await client.publish(queue, message);
    }
    await waitSomeTime(1000); //precisa aguardar até o RabbitMQ efetivamente colocar as mensagens na fila

    await client.registerConsumer(testConsumer);

    await waitSomeTime(1000); //aguardar para dar tempo de a mensagem ser consumida

    expect(message).toBeDefined();
    expect(testConsumer.consume).toHaveBeenCalledTimes(publishingTimes);
    expect(testConsumer.consume).toHaveBeenLastCalledWith(message);
  });

  it("should unregister a consumer by its name", async () => {
    const queue = genQueueName();
    await client.registerQueue(queue);
    const testConsumer: IConsumer = {
      queue,
      name: testConsumerName,
      consume: jest.fn()
    };

    await client.registerConsumer(testConsumer);
    await client.unregisterConsumer(testConsumer.name);

    const message: Message = {
      id: v4(),
      data: { message: `test data` }
    };

    await client.publish(queue, message);

    await waitSomeTime(1000); //precisa aguardar até o RabbitMQ efetivamente colocar as mensagens na fila

    expect(await client.getQueueSize(queue)).toBe(1);
  });

  it("should return the message to the queue if consumer fails to consume it", async () => {
    const errorMessage = "Not consuming anything!";
    const queue = genQueueName();
    await client.registerQueue(queue);
    const testConsumer: IConsumer = {
      queue,
      name: testConsumerName,
      consume: jest.fn((_: Message) => {
        throw new Error(errorMessage);
      })
    };
    const message: Message = {
      id: v4(),
      data: { message: `test data` }
    };

    await client.publish(queue, message);

    await waitSomeTime(1000); //precisa aguardar até o RabbitMQ efetivamente colocar as mensagens na fila

    expect(await client.getQueueSize(queue)).toBe(1);

    await client.registerConsumer(testConsumer);

    await waitSomeTime(1000); //aguardar para dar tempo de a mensagem ser consumida

    await client.unregisterConsumer(testConsumer.name); //remove o consumer, pois enquanto ele existir, a mensagem fica sendo tirada e recolocada na fila, alternando seu tamanho entre 0 e 1

    expect(testConsumer.consume).toHaveBeenCalled();
    expect(testConsumer.consume).toThrowError(errorMessage);
    expect(await client.getQueueSize(queue)).toBe(1);
  });
});
