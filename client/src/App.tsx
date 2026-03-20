import { McpProvider } from "./context/McpContext";
import { ResourcesPanel } from "./components/ResourcesPanel";
import { ToolsPanel } from "./components/ToolsPanel";
import { PromptsPanel } from "./components/PromptsPanel";
import { MCP_COPY } from "./copy/mcpExplainer";
import "./App.css";

function App() {
  return (
    <McpProvider>
      <header className="app-header">
        <h1>MCP Explorer</h1>
        <p>{MCP_COPY.appSubtitle}</p>
      </header>
      <main className="panels">
        <ResourcesPanel />
        <ToolsPanel />
        <PromptsPanel />
      </main>
    </McpProvider>
  );
}

export default App;
