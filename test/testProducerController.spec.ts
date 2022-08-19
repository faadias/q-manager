import { StatusCodes } from "http-status-codes";
describe("Test Producer integratin tests", () => {
  describe("When sending a request", () => {
    it("should receive the request and return a 201 status", async () => {
      const response = await globalThis.testRequest.post("/test");
      expect(response.status).toBe(StatusCodes.CREATED);
    });
  });
});
