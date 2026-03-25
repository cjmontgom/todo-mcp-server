import { useState, useRef, useEffect } from 'react';
import { useMcp } from "../context/McpContext";
import { useDisplay } from "../context/DisplayContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { readResource } from "../mcp/client";
import { parseMarkdownTable, parseJsonTaskArray } from "../lib/parseMarkdownTable";

interface ReadState {
  status: 'idle' | 'loading' | 'error';
  error?: string;
}

export function ResourcesPanel() {
  const { resources } = useMcp();
  const { setDisplayContent } = useDisplay();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [readState, setReadState] = useState<ReadState>({ status: 'idle' });
  const latestUriRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function handleRead(uri: string) {
    latestUriRef.current = uri;
    setSelectedUri(uri);
    setReadState({ status: 'loading' });
    setDisplayContent({ type: 'loading', label: 'Reading resource…' });

    try {
      const content = await readResource(uri);
      if (!mountedRef.current || latestUriRef.current !== uri) return;
      const mimeType = content.mimeType.split(';')[0].trim();

      setReadState({ status: 'idle' });

      const postAction = MCP_COPY.postActionRead(uri);

      if (mimeType === 'application/json') {
        const rows = parseJsonTaskArray(content.text);
        if (rows.length > 0) {
          setDisplayContent({ type: 'grid', rows, postAction, key: uri });
        } else {
          setDisplayContent({ type: 'text', text: content.text, postAction });
        }
      } else if (mimeType === 'text/markdown') {
        const rows = parseMarkdownTable(content.text);
        if (rows.length > 0) {
          setDisplayContent({ type: 'grid', rows, postAction, key: uri });
        } else {
          setDisplayContent({ type: 'text', text: content.text, postAction });
        }
      } else {
        setDisplayContent({ type: 'text', text: content.text, postAction });
      }
    } catch (err) {
      if (!mountedRef.current || latestUriRef.current !== uri) return;
      const message = err instanceof Error ? err.message : String(err);
      setReadState({ status: 'error', error: message });
      setDisplayContent({ type: 'error', message });
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
            <div key={r.uri} className="item-card-wrapper">
              <div
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
              {selectedUri === r.uri && readState.status === 'loading' && (
                <div className="loading inline-status">
                  <span className="spinner" />
                  Reading resource…
                </div>
              )}
              {selectedUri === r.uri && readState.status === 'error' && (
                <div className="error inline-status">{readState.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
