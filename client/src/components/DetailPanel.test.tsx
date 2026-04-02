import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DetailPanel } from "./DetailPanel";
import type { DisplayContent } from "../context/DisplayContext";

const mockUseDisplay = vi.fn();

vi.mock("../context/DisplayContext", () => ({
  useDisplay: () => mockUseDisplay(),
}));

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

    mockUseDisplay.mockReturnValue({
      activeTab: "manual",
      displayContent,
      setDisplayContent: vi.fn(),
      submitSamplingResponse: vi.fn(),
      cancelSamplingResponse: vi.fn(),
    });

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

    mockUseDisplay.mockReturnValue({
      activeTab: "manual",
      displayContent,
      setDisplayContent: vi.fn(),
      submitSamplingResponse,
      cancelSamplingResponse: vi.fn(),
    });

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

    mockUseDisplay.mockReturnValue({
      activeTab: "manual",
      displayContent: pending,
      setDisplayContent: vi.fn(),
      submitSamplingResponse: vi.fn(),
      cancelSamplingResponse,
    });

    const { rerender } = render(<DetailPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelSamplingResponse).toHaveBeenCalledWith(2));

    const timeout: DisplayContent = {
      type: "sampling-outcome",
      outcome: "timeout",
      message: "The sampling request expired. Try calling the tool again.",
    };
    mockUseDisplay.mockReturnValue({
      activeTab: "manual",
      displayContent: timeout,
      setDisplayContent: vi.fn(),
      submitSamplingResponse: vi.fn(),
      cancelSamplingResponse: vi.fn(),
    });

    rerender(<DetailPanel />);
    expect(
      screen.getByText("The sampling request expired. Try calling the tool again.")
    ).toBeInTheDocument();
    expect(screen.getByText("What is Sampling?")).toBeInTheDocument();
  });
});
