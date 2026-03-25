import { McpProvider } from "./context/McpContext";
import { DisplayProvider } from "./context/DisplayContext";
import { ResourcesPanel } from "./components/ResourcesPanel";
import { ToolsPanel } from "./components/ToolsPanel";
import { PromptsPanel } from "./components/PromptsPanel";
import { DetailPanel } from "./components/DetailPanel";
import { MCP_COPY } from "./copy/mcpExplainer";
import "./App.css";

function App() {
  return (
    <McpProvider>
      <DisplayProvider>
        <header className="app-header">
          <h1>MCP Explorer - Task Manager</h1>
          <p>{MCP_COPY.appSubtitle}</p>
        </header>
        <main className="app-layout">
          <div className="panels-column">
            <ResourcesPanel />
            <ToolsPanel />
            <PromptsPanel />
          </div>
          <aside className="detail-column">
            <DetailPanel />
          </aside>
        </main>
      </DisplayProvider>
    </McpProvider>
  );
}

export default App;
