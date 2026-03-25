import { createContext, useContext, useState, type ReactNode } from "react";
import type { GridRow } from "../lib/parseMarkdownTable";

export type DisplayContent =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "error"; message: string }
  | { type: "grid"; rows: GridRow[]; postAction?: string; key?: string }
  | { type: "text"; text: string; postAction?: string }
  | { type: "mutated"; text?: string; rows?: GridRow[]; postAction?: string };

interface DisplayState {
  displayContent: DisplayContent;
  setDisplayContent: (content: DisplayContent) => void;
}

const DisplayContext = createContext<DisplayState | null>(null);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const [displayContent, setDisplayContent] = useState<DisplayContent>({ type: "idle" });

  return (
    <DisplayContext.Provider value={{ displayContent, setDisplayContent }}>
      {children}
    </DisplayContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDisplay(): DisplayState {
  const ctx = useContext(DisplayContext);
  if (!ctx) throw new Error("useDisplay must be used within DisplayProvider");
  return ctx;
}
