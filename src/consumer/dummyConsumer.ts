import { IConsumer, Message } from "../client/qClientInterface";

export class DummyConsumer implements IConsumer {
  readonly queue = "dummy-queue";
  readonly name = "dummy-consumer";
  consume(message: Message): void {
    console.info(
      `"Dummy consumed: ${message.id} - ${JSON.stringify(message.data)}`
    );
  }
}
