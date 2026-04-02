import { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DisplayProvider,
  useDisplay,
  type DisplayContent,
} from "./DisplayContext";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((evt: MessageEvent<string>) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {}

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

function DisplayProbe({ onChange }: { onChange: (content: DisplayContent) => void }) {
  const { displayContent } = useDisplay();
  useEffect(() => {
    onChange(displayContent);
  }, [displayContent, onChange]);
  return null;
}

describe("DisplayProvider sampling SSE behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    FakeEventSource.instances.length = 0;
    vi.unstubAllGlobals();
  });

  it("activates sampling request UI in manual mode", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: DisplayContent[] = [];

    render(
      <DisplayProvider activeTab="manual">
        <DisplayProbe onChange={(content) => states.push(content)} />
      </DisplayProvider>
    );

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBe(1);
    });
    const es = FakeEventSource.instances[0];
    act(() => {
      es.emit({
        type: "sampling-request",
        id: 42,
        messages: [
          {
            role: "user",
            content: { type: "text", text: "Prompt line one\nPrompt line two" },
          },
        ],
        maxTokens: 300,
      });
    });

    const latest = states[states.length - 1];
    expect(latest.type).toBe("sampling-pending");
    if (latest.type !== "sampling-pending") return;
    expect(latest.request.id).toBe(42);
    expect(latest.request.promptText).toContain("Prompt line one");
    expect(latest.request.sourceMode).toBe("manual");
  });

  it("ignores sampling-request activation while AI tab is active", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: DisplayContent[] = [];

    render(
      <DisplayProvider activeTab="ai">
        <DisplayProbe onChange={(content) => states.push(content)} />
      </DisplayProvider>
    );

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBe(1);
    });
    const es = FakeEventSource.instances[0];
    act(() => {
      es.emit({
        type: "sampling-request",
        id: 99,
        messages: [{ role: "user", content: { type: "text", text: "Ignored" } }],
        maxTokens: 300,
      });
    });

    const latest = states[states.length - 1];
    expect(latest.type).toBe("idle");
  });

  it("activates sampling-trace in AI mode and accumulates steps", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: DisplayContent[] = [];

    render(
      <DisplayProvider activeTab="ai">
        <DisplayProbe onChange={(content) => states.push(content)} />
      </DisplayProvider>
    );

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBe(1);
    });
    const es = FakeEventSource.instances[0];

    act(() => {
      es.emit({ type: "sampling-trace", step: "server-requested", data: { id: 1, messages: [], maxTokens: 200 } });
    });
    act(() => {
      es.emit({ type: "sampling-trace", step: "calling-ollama", data: { model: "llama3.1" } });
    });

    const latest = states[states.length - 1];
    expect(latest.type).toBe("sampling-trace");
    if (latest.type !== "sampling-trace") return;
    expect(latest.steps).toHaveLength(2);
    expect(latest.steps[0].step).toBe("server-requested");
    expect(latest.steps[1].step).toBe("calling-ollama");
    expect(latest.steps[1].data?.model).toBe("llama3.1");
  });

  it("ignores sampling-trace events in manual mode", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: DisplayContent[] = [];

    render(
      <DisplayProvider activeTab="manual">
        <DisplayProbe onChange={(content) => states.push(content)} />
      </DisplayProvider>
    );

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBe(1);
    });
    const es = FakeEventSource.instances[0];

    act(() => {
      es.emit({ type: "sampling-trace", step: "server-requested", data: { id: 2 } });
    });

    const latest = states[states.length - 1];
    expect(latest.type).toBe("idle");
  });

  it("isSamplingTraceActive returns true after trace events arrive", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);

    let traceActive: (() => boolean) | undefined;

    function Probe() {
      const { isSamplingTraceActive } = useDisplay();
      traceActive = isSamplingTraceActive;
      return null;
    }

    render(
      <DisplayProvider activeTab="ai">
        <Probe />
      </DisplayProvider>
    );

    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    expect(traceActive?.()).toBe(false);

    act(() => {
      FakeEventSource.instances[0].emit({
        type: "sampling-trace",
        step: "calling-ollama",
        data: { model: "llama3.1" },
      });
    });

    expect(traceActive?.()).toBe(true);
  });

  it("clearSamplingTrace resets the trace state", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);

    let traceActive: (() => boolean) | undefined;
    let clear: (() => void) | undefined;

    function Probe() {
      const { isSamplingTraceActive, clearSamplingTrace } = useDisplay();
      traceActive = isSamplingTraceActive;
      clear = clearSamplingTrace;
      return null;
    }

    render(
      <DisplayProvider activeTab="ai">
        <Probe />
      </DisplayProvider>
    );

    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));

    act(() => {
      FakeEventSource.instances[0].emit({
        type: "sampling-trace",
        step: "server-requested",
        data: { id: 5 },
      });
    });
    expect(traceActive?.()).toBe(true);

    act(() => {
      clear?.();
    });
    expect(traceActive?.()).toBe(false);
  });

  it("ignores timeout events for stale or unknown request ids", async () => {
    vi.stubEnv("VITE_MCP_PROXY_URL", "http://localhost:3001");
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: DisplayContent[] = [];

    render(
      <DisplayProvider activeTab="manual">
        <DisplayProbe onChange={(content) => states.push(content)} />
      </DisplayProvider>
    );

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBe(1);
    });
    const es = FakeEventSource.instances[0];

    act(() => {
      es.emit({
        type: "sampling-request",
        id: 7,
        messages: [{ role: "user", content: { type: "text", text: "Current request" } }],
      });
    });

    act(() => {
      es.emit({
        type: "sampling-request-error",
        id: 999,
        error: "Sampling request timed out — no human response received within 10 minutes",
      });
    });

    const latest = states[states.length - 1];
    expect(latest.type).toBe("sampling-pending");
    if (latest.type !== "sampling-pending") return;
    expect(latest.request.id).toBe(7);
  });
});
