import supertest, { SuperTest, Test } from "supertest";
import QClientMemory from "../src/client/qClientMemory";
import { QManagerServer } from "../src/server";

declare global {
  // eslint-disable-next-line no-var
  var testRequest: SuperTest<Test>;
}

let server: QManagerServer;

beforeAll(async () => {
  server = new QManagerServer(await QClientMemory.getInstance());
  await server.start();

  global.testRequest = supertest(server.app);
});

afterAll(async () => await server.stop());
