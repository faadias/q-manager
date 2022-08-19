import { StatusCodes } from "http-status-codes";
import { authMiddleware } from "./authMiddleware";

beforeEach(() => (process.env.API_KEY = ""));

describe("AuthMiddleware unit tests", () => {
  it("should return 401 if an api key is defined in env var but was not provided", async () => {
    process.env.API_KEY = "bananas";

    const reqFake = {
      query: {}
    };
    const resFake = {
      status: jest.fn(() => ({
        send: jest.fn()
      }))
    };
    const nextFake = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authMiddleware(reqFake as any, resFake as any, nextFake);
    expect(nextFake).not.toHaveBeenCalled();
    expect(resFake.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
  });

  it("should allow access if the correct api key was given", async () => {
    const apiKey = "bananas";
    process.env.API_KEY = apiKey;

    const reqFake = {
      query: { apiKey }
    };
    const resFake = {
      status: jest.fn(() => ({
        send: jest.fn()
      }))
    };
    const nextFake = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authMiddleware(reqFake as any, resFake as any, nextFake);
    expect(nextFake).toHaveBeenCalled();
    expect(resFake.status).not.toHaveBeenCalled();
  });
});
