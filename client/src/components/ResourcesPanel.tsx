import { useState, useRef, useEffect } from 'react';
import { useMcp } from "../context/McpContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { readResource } from "../mcp/client";
import { parseMarkdownTable, parseJsonTaskArray } from "../lib/parseMarkdownTable";
import type { GridRow } from "../lib/parseMarkdownTable";
import { TaskGrid } from "./TaskGrid";

interface ReadState {
  status: 'idle' | 'loading' | 'error';
  rows: GridRow[];
  error?: string;
  rawText?: string;
}

export function ResourcesPanel() {
  const { resources } = useMcp();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [readState, setReadState] = useState<ReadState>({ status: 'idle', rows: [] });
  const latestUriRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function handleRead(uri: string) {
    latestUriRef.current = uri;
    setSelectedUri(uri);
    setReadState({ status: 'loading', rows: [] });
    try {
      const content = await readResource(uri);
      if (!mountedRef.current || latestUriRef.current !== uri) return;
      const mimeType = content.mimeType.split(';')[0].trim();
      if (mimeType === 'application/json') {
        setReadState({ status: 'idle', rows: parseJsonTaskArray(content.text) });
      } else if (mimeType === 'text/markdown') {
        setReadState({ status: 'idle', rows: parseMarkdownTable(content.text) });
      } else {
        setReadState({ status: 'idle', rows: [], rawText: content.text });
      }
    } catch (err) {
      if (!mountedRef.current || latestUriRef.current !== uri) return;
      setReadState({
        status: 'error',
        rows: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section className="panel">
      <h2>Resources</h2>
      <p className="blurb">{MCP_COPY.resourcesBlurb}</p>

      {resources.status === "loading" && (
        <div className="loading">
          <span className="spinner" />
          Loading resources…
        </div>
      )}

      {resources.status === "error" && (
        <div className="error">{resources.error}</div>
      )}

      {resources.status === "idle" && resources.data.length === 0 && (
        <p className="empty-state">No resources found.</p>
      )}

      {resources.data.length > 0 && (
        <div className="item-list">
          {resources.data.map((r) => (
            <div
              key={r.uri}
              className={`item-card${selectedUri === r.uri ? ' item-card--selected' : ''}`}
              onClick={() => handleRead(r.uri)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRead(r.uri); } }}
              role="button"
              tabIndex={0}
            >
              <p className="item-name">{r.name}</p>
              <p className="item-uri">{r.uri}</p>
              {r.description && (
                <p className="item-description">{r.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedUri && (
        <div className="read-result">
          {readState.status === 'loading' && (
            <div className="loading">
              <span className="spinner" />
              Reading resource…
            </div>
          )}
          {readState.status === 'error' && (
            <div className="error">{readState.error}</div>
          )}
          {readState.status === 'idle' && readState.rawText !== undefined && readState.rawText !== '' && (
            <pre className="raw-text">{readState.rawText}</pre>
          )}
          {readState.status === 'idle' && readState.rows.length > 0 && (
            <TaskGrid
              key={selectedUri}
              rows={readState.rows}
              note={MCP_COPY.gridNoteResource}
              postAction={MCP_COPY.postActionRead(selectedUri)}
            />
          )}
          {readState.status === 'idle' && readState.rows.length === 0 && readState.rawText === undefined && (
            <p className="empty-state">No rows found in resource.</p>
          )}
        </div>
      )}
    </section>
  );
}
