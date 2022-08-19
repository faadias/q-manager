import { IConsumer, Message } from "../../src/client/qClientInterface";
import crypto from "node:crypto";

export class TestConsumer implements IConsumer {
  readonly queue = "test-queue";
  readonly name = "test-consumer";
  consume(message: Message): void {
    console.info(
      `Test consumed: ${message.id} - ${crypto
        .createHash("md5")
        .update(JSON.stringify(message.data))
        .digest("hex")}`
    );
  }
}
