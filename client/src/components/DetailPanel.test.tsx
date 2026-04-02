import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DetailPanel } from "./DetailPanel";
import type { DisplayContent } from "../context/DisplayContext";

const mockUseDisplay = vi.fn();

vi.mock("../context/DisplayContext", () => ({
  useDisplay: () => mockUseDisplay(),
}));

function makeDisplayState(overrides: Partial<ReturnType<typeof mockUseDisplay.mock.results[0]["value"]>> = {}) {
  return {
    activeTab: "manual" as const,
    displayContent: { type: "idle" } as DisplayContent,
    setDisplayContent: vi.fn(),
    submitSamplingResponse: vi.fn(),
    cancelSamplingResponse: vi.fn(),
    isSamplingTraceActive: vi.fn().mockReturnValue(false),
    clearSamplingTrace: vi.fn(),
    ...overrides,
  };
}

describe("DetailPanel sampling states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pending sampling request form and educational sections", () => {
    const displayContent: DisplayContent = {
      type: "sampling-pending",
      request: {
        id: 1,
        promptText: "Prompt from server",
        rawMessages: [],
        startedAt: new Date().toISOString(),
        sourceMode: "manual",
      },
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ displayContent }));

    render(<DetailPanel />);

    expect(screen.getByText("Sampling Request")).toBeInTheDocument();
    expect(screen.getByText("Prompt from server")).toBeInTheDocument();
    expect(screen.getByText("What is Sampling?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("submits valid JSON sampling response", async () => {
    const submitSamplingResponse = vi.fn().mockResolvedValue(undefined);
    const displayContent: DisplayContent = {
      type: "sampling-pending",
      request: {
        id: 77,
        promptText: "Prompt",
        rawMessages: [],
        startedAt: new Date().toISOString(),
        sourceMode: "manual",
      },
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ displayContent, submitSamplingResponse }));

    render(<DetailPanel />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value: JSON.stringify({
          title: "Do laundry",
          description: "Tonight",
          priority: "high",
          dueDate: "2026-04-03",
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(submitSamplingResponse).toHaveBeenCalledWith(
        77,
        JSON.stringify({
          title: "Do laundry",
          description: "Tonight",
          priority: "high",
          dueDate: "2026-04-03",
        })
      )
    );
  });

  it("triggers cancel transport and renders timeout outcome copy", async () => {
    const cancelSamplingResponse = vi.fn().mockResolvedValue(undefined);
    const pending: DisplayContent = {
      type: "sampling-pending",
      request: {
        id: 2,
        promptText: "Prompt",
        rawMessages: [],
        startedAt: new Date().toISOString(),
        sourceMode: "manual",
      },
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ displayContent: pending, cancelSamplingResponse }));

    const { rerender } = render(<DetailPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelSamplingResponse).toHaveBeenCalledWith(2));

    const timeout: DisplayContent = {
      type: "sampling-outcome",
      outcome: "timeout",
      message: "The sampling request expired. Try calling the tool again.",
    };
    mockUseDisplay.mockReturnValue(makeDisplayState({ displayContent: timeout }));

    rerender(<DetailPanel />);
    expect(
      screen.getByText("The sampling request expired. Try calling the tool again.")
    ).toBeInTheDocument();
    expect(screen.getByText("What is Sampling?")).toBeInTheDocument();
  });
});

describe("DetailPanel sampling-trace rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Sampling Trace heading and step 1 when server-requested arrives", () => {
    const displayContent: DisplayContent = {
      type: "sampling-trace",
      steps: [
        {
          step: "server-requested",
          data: { id: 10, messages: [], maxTokens: 200 },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ activeTab: "ai", displayContent }));
    render(<DetailPanel />);

    expect(screen.getByText("Sampling Trace")).toBeInTheDocument();
    expect(screen.getByText("The AI called create_task_using_sampling")).toBeInTheDocument();
    expect(screen.getByText("Server sent sampling/createMessage")).toBeInTheDocument();
    expect(screen.getByText("What is Sampling?")).toBeInTheDocument();
  });

  it("renders model name in calling-ollama step", () => {
    const displayContent: DisplayContent = {
      type: "sampling-trace",
      steps: [
        {
          step: "server-requested",
          data: { id: 10 },
          timestamp: new Date().toISOString(),
        },
        {
          step: "calling-ollama",
          data: { model: "llama3.1" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ activeTab: "ai", displayContent }));
    render(<DetailPanel />);

    expect(screen.getByText("Proxy called LLM (llama3.1)")).toBeInTheDocument();
  });

  it("renders collapsible raw JSON for ollama-responded step", () => {
    const displayContent: DisplayContent = {
      type: "sampling-trace",
      steps: [
        {
          step: "ollama-responded",
          data: { text: '{"title":"Buy milk"}' },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ activeTab: "ai", displayContent }));
    render(<DetailPanel />);

    expect(screen.getByText("LLM responded")).toBeInTheDocument();
    expect(screen.getByText("Show raw response")).toBeInTheDocument();
    expect(screen.getByText('{"title":"Buy milk"}')).toBeInTheDocument();
  });

  it("renders enrichment-applied steps with field changes and task title", () => {
    const mcpResult = {
      result: {
        content: [
          {
            type: "text",
            text: 'Created task "Buy milk enriched" enriched by AI: title: "(none)" → "Buy milk enriched", description: "(none)" → "Pick up from store"',
          },
        ],
      },
    };
    const displayContent: DisplayContent = {
      type: "sampling-trace",
      steps: [
        {
          step: "enrichment-applied",
          data: { result: mcpResult },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ activeTab: "ai", displayContent }));
    render(<DetailPanel />);

    expect(screen.getByText("Enrichment applied")).toBeInTheDocument();
    expect(screen.getByText("Task created")).toBeInTheDocument();
    // "Buy milk enriched" appears as field enriched value AND as the task title
    expect(screen.getAllByText("Buy milk enriched")).toHaveLength(2);
  });

  it("renders six numbered steps for all four SSE events combined", () => {
    const mcpResult = {
      result: {
        content: [
          {
            type: "text",
            text: 'Created task "Done" enriched by AI: title: "(none)" → "Done"',
          },
        ],
      },
    };
    const displayContent: DisplayContent = {
      type: "sampling-trace",
      steps: [
        { step: "server-requested", data: { id: 1 }, timestamp: new Date().toISOString() },
        { step: "calling-ollama", data: { model: "llama3.1" }, timestamp: new Date().toISOString() },
        { step: "ollama-responded", data: { text: "{}" }, timestamp: new Date().toISOString() },
        { step: "enrichment-applied", data: { result: mcpResult }, timestamp: new Date().toISOString() },
      ],
    };

    mockUseDisplay.mockReturnValue(makeDisplayState({ activeTab: "ai", displayContent }));
    render(<DetailPanel />);

    // Steps 1-6 should all render
    const stepNumbers = [1, 2, 3, 4, 5, 6].map(String);
    for (const n of stepNumbers) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
  });
});

describe("DetailPanel sampling-preview rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders contextual sampling preview when sampling-preview content is set", () => {
    const displayContent: DisplayContent = { type: "sampling-preview" };

    mockUseDisplay.mockReturnValue(makeDisplayState({ activeTab: "manual", displayContent }));
    render(<DetailPanel />);

    expect(screen.getByText("Sampling Trace")).toBeInTheDocument();
    expect(screen.getByText("What is Sampling?")).toBeInTheDocument();
    expect(screen.getByText(/Sampling is the forth MCP primitive/)).toBeInTheDocument();
  });
});
