import { describe, it, expect, vi } from "vitest";
import { McpServerBridge } from "./spawnMcpServer.js";
import { EventEmitter } from "events";
import { createInterface } from "readline";
import { PassThrough, Writable } from "stream";

function createMockBridge() {
  const bridge = new McpServerBridge();

  const stdinChunks: string[] = [];
  const mockStdin = new Writable({
    write(chunk, _enc, cb) {
      stdinChunks.push(chunk.toString());
      cb();
    },
  });
  Object.defineProperty(mockStdin, "writable", { get: () => true });

  const mockStdout = new PassThrough();
  const mockStderr = new PassThrough();

  const mockProcess = Object.assign(new EventEmitter(), {
    stdin: mockStdin,
    stdout: mockStdout,
    stderr: mockStderr,
    kill: vi.fn(),
    pid: 12345,
  });

  (bridge as unknown as { process: typeof mockProcess }).process = mockProcess;
  (bridge as unknown as { alive: boolean }).alive = true;

  const rl = createInterface({ input: mockStdout });
  rl.on("line", (line) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if ("id" in msg && msg.id != null) {
      if ("method" in msg && typeof msg.method === "string") {
        bridge.emit("serverRequest", msg);
      } else {
        const pending = (
          bridge as unknown as {
            pending: Map<
              string | number,
              { resolve: (v: unknown) => void; timer: NodeJS.Timeout }
            >;
          }
        ).pending;
        const entry = pending.get(msg.id as string | number);
        if (entry) {
          clearTimeout(entry.timer);
          entry.resolve(msg);
          pending.delete(msg.id as string | number);
        }
      }
    } else {
      bridge.emit("notification", msg);
    }
  });

  return { bridge, mockProcess, mockStdout, stdinChunks };
}

describe("McpServerBridge", () => {
  describe("respondToServer", () => {
    it("writes a JSON-RPC success response to stdin", () => {
      const { bridge, stdinChunks } = createMockBridge();

      bridge.respondToServer(42, { foo: "bar" });

      expect(stdinChunks).toHaveLength(1);
      const parsed = JSON.parse(stdinChunks[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: 42,
        result: { foo: "bar" },
      });
    });

    it("does nothing when bridge is not alive", () => {
      const { bridge, stdinChunks } = createMockBridge();
      (bridge as unknown as { alive: boolean }).alive = false;

      bridge.respondToServer(1, {});
      expect(stdinChunks).toHaveLength(0);
    });
  });

  describe("respondErrorToServer", () => {
    it("writes a JSON-RPC error response to stdin", () => {
      const { bridge, stdinChunks } = createMockBridge();

      bridge.respondErrorToServer(7, -32603, "Something failed");

      expect(stdinChunks).toHaveLength(1);
      const parsed = JSON.parse(stdinChunks[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: 7,
        error: { code: -32603, message: "Something failed" },
      });
    });

    it("does nothing when bridge is not alive", () => {
      const { bridge, stdinChunks } = createMockBridge();
      (bridge as unknown as { alive: boolean }).alive = false;

      bridge.respondErrorToServer(1, -32600, "err");
      expect(stdinChunks).toHaveLength(0);
    });
  });

  describe("server-initiated request detection", () => {
    it("emits 'serverRequest' for messages with both id and method", async () => {
      const { bridge, mockStdout } = createMockBridge();

      const received: unknown[] = [];
      bridge.on("serverRequest", (msg: unknown) => received.push(msg));

      mockStdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sampling/createMessage",
          params: { messages: [], maxTokens: 300 },
        }) + "\n"
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveLength(1);
      expect((received[0] as Record<string, unknown>).method).toBe(
        "sampling/createMessage"
      );
      expect((received[0] as Record<string, unknown>).id).toBe(1);
    });

    it("resolves pending request for messages with id but no method", async () => {
      const { bridge, mockStdout } = createMockBridge();

      const sendPromise = bridge.send({
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: {},
      });

      mockStdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 99,
          result: { content: [{ type: "text", text: "ok" }] },
        }) + "\n"
      );

      const result = await sendPromise;
      expect((result as Record<string, unknown>).id).toBe(99);
    });

    it("emits 'notification' for messages without id", async () => {
      const { bridge, mockStdout } = createMockBridge();

      const notifications: unknown[] = [];
      bridge.on("notification", (msg: unknown) => notifications.push(msg));

      mockStdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/resources/updated",
          params: {},
        }) + "\n"
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(notifications).toHaveLength(1);
    });
  });
});
