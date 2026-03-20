import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import { EventEmitter } from "events";

interface PendingRequest {
  resolve: (msg: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class McpServerBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private pending = new Map<string | number, PendingRequest>();
  private alive = false;

  get isAlive() {
    return this.alive;
  }

  start(serverPath: string): void {
    this.process = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.alive = true;

    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stderr.write(`[mcp-server] unparseable stdout: ${line}\n`);
        return;
      }

      if ("id" in msg && msg.id != null) {
        const entry = this.pending.get(msg.id as string | number);
        if (entry) {
          clearTimeout(entry.timer);
          entry.resolve(msg);
          this.pending.delete(msg.id as string | number);
        }
      } else {
        this.emit("notification", msg);
      }
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(`[mcp-server] ${chunk}`);
    });

    this.process.on("exit", (code) => {
      this.alive = false;
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error("MCP server exited"));
        this.pending.delete(id);
      }
      this.emit("exit", code);
    });

    this.process.on("error", (err) => {
      this.alive = false;
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(err);
        this.pending.delete(id);
      }
      this.emit("error", err);
    });
  }

  async send(
    jsonRpcMessage: Record<string, unknown>,
    timeoutMs = 30000,
  ): Promise<unknown> {
    if (!this.alive || !this.process?.stdin?.writable) {
      throw new Error("MCP server is not available");
    }

    return new Promise((resolve, reject) => {
      const id = jsonRpcMessage.id as string | number;

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Request timed out"));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.process!.stdin!.write(JSON.stringify(jsonRpcMessage) + "\n");
    });
  }

  kill(): void {
    this.process?.kill();
  }
}
