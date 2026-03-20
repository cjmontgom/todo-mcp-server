import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { listResources, listTools, listPrompts, type Resource, type Tool, type Prompt } from "../mcp/client";

type SectionStatus = "idle" | "loading" | "error";

interface SectionState<T> {
  status: SectionStatus;
  data: T[];
  error?: string;
}

interface McpState {
  resources: SectionState<Resource>;
  tools: SectionState<Tool>;
  prompts: SectionState<Prompt>;
}

const loading = <T,>(): SectionState<T> => ({ status: "loading", data: [] });

const McpContext = createContext<McpState | null>(null);

export function McpProvider({ children }: { children: ReactNode }) {
  const [resources, setResources] = useState<SectionState<Resource>>(loading);
  const [tools, setTools] = useState<SectionState<Tool>>(loading);
  const [prompts, setPrompts] = useState<SectionState<Prompt>>(loading);

  useEffect(() => {
    listResources()
      .then((data) => setResources({ status: "idle", data }))
      .catch((err: unknown) => setResources({ status: "error", data: [], error: err instanceof Error ? err.message : String(err) }));

    listTools()
      .then((data) => setTools({ status: "idle", data }))
      .catch((err: unknown) => setTools({ status: "error", data: [], error: err instanceof Error ? err.message : String(err) }));

    listPrompts()
      .then((data) => setPrompts({ status: "idle", data }))
      .catch((err: unknown) => setPrompts({ status: "error", data: [], error: err instanceof Error ? err.message : String(err) }));
  }, []);

  return (
    <McpContext.Provider value={{ resources, tools, prompts }}>
      {children}
    </McpContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMcp(): McpState {
  const ctx = useContext(McpContext);
  if (!ctx) throw new Error("useMcp must be used within McpProvider");
  return ctx;
}
