import {
  PING_INTERVAL_MS,
  buildJsonRpcNotification,
  buildWsUrl,
  toWireMethod,
  type Json,
} from "./protocol";

export type { Json };
export { buildWsUrl };

type Pending = {
  resolve: (value: Json) => void;
  reject: (err: Error) => void;
};

export type IncomingRequest = {
  id: Json;
  method: string;
  params: Json;
};

export type SessionUpdate = {
  sessionId?: string;
  update?: {
    sessionUpdate?: string;
    content?: { type?: string; text?: string };
    toolCallId?: string;
    title?: string;
    kind?: string;
    status?: string;
    [k: string]: Json | undefined;
  };
};

const DEFAULT_TIMEOUT_MS = 120_000;

export class AcpClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private pingTimer: number | null = null;

  onNotification: (method: string, params: Json) => void = () => {};
  onRequest: (req: IncomingRequest) => Promise<Json | undefined> = async () =>
    undefined;
  onClose: (ev: CloseEvent) => void = () => {};
  onOpen: () => void = () => {};

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
    this.disconnect();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        reject(err);
      };
      const onOpen = () => {
        if (settled) return;
        settled = true;
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        this.armPing();
        this.onOpen();
        resolve();
      };
      const onError = () => fail(new Error(`WebSocket error connecting to ${url}`));
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("message", (ev) => this.onMessage(ev));
      ws.addEventListener("close", (ev) => {
        this.clearPing();
        this.failAll(new Error(`WebSocket closed (${ev.code})`));
        if (!settled) {
          fail(new Error(`WebSocket closed during connect (${ev.code})`));
        }
        this.onClose(ev);
      });
    });
  }

  disconnect(): void {
    this.clearPing();
    this.failAll(new Error("disconnected"));
    const ws = this.ws;
    this.ws = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
  }

  /** Close the socket without clearing `wantOpen` at the app layer — tests reconnect. */
  dropSocket(): void {
    this.ws?.close();
  }

  /** Fire-and-forget JSON-RPC notification (no `id`). Use for `session/cancel`. */
  notify(method: string, params: Json): void {
    this.send(buildJsonRpcNotification(method, params));
  }

  request(method: string, params: Json, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Json> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          window.clearTimeout(timer);
          reject(err);
        },
      });
      this.send({ jsonrpc: "2.0", id, method: toWireMethod(method), params });
    });
  }

  respond(id: Json, result: Json): void {
    this.send({ jsonrpc: "2.0", id, result });
  }

  respondError(id: Json, code: number, message: string): void {
    this.send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  private send(payload: Record<string, Json>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.ws.send(JSON.stringify(payload));
  }

  private armPing(): void {
    this.clearPing();
    this.pingTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, PING_INTERVAL_MS);
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private async onMessage(ev: MessageEvent): Promise<void> {
    const raw = typeof ev.data === "string" ? ev.data : "";
    const trimmed = raw.replace(/[\r\n]+$/g, "");
    if (!trimmed || trimmed === "ping" || trimmed === "pong") return;
    let msg: { [k: string]: Json };
    try {
      msg = JSON.parse(trimmed) as { [k: string]: Json };
    } catch {
      return;
    }

    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const id = typeof msg.id === "number" ? msg.id : Number(msg.id);
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      if (msg.error) {
        const err = msg.error as { message?: string; code?: number };
        pending.reject(
          new Error(err.message ?? `ACP error ${err.code ?? ""}`.trim()),
        );
      } else {
        pending.resolve(msg.result ?? null);
      }
      return;
    }

    if (typeof msg.method === "string") {
      const method = msg.method.startsWith("_") ? msg.method.slice(1) : msg.method;
      const params = (msg.params ?? null) as Json;
      if (msg.id !== undefined && msg.id !== null) {
        try {
          const result = await this.onRequest({ id: msg.id, method, params });
          this.respond(msg.id, result ?? {});
        } catch (e) {
          this.respondError(
            msg.id,
            -32000,
            e instanceof Error ? e.message : String(e),
          );
        }
        return;
      }
      this.onNotification(method, params);
    }
  }
}


