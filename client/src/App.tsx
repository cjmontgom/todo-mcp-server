import { useState } from "react";
import { McpProvider } from "./context/McpContext";
import { DisplayProvider } from "./context/DisplayContext";
import { ResourcesPanel } from "./components/ResourcesPanel";
import { ToolsPanel } from "./components/ToolsPanel";
import { PromptsPanel } from "./components/PromptsPanel";
import { ChatPanel, type ChatMessageDisplay } from "./components/ChatPanel";
import { DetailPanel } from "./components/DetailPanel";
import { MCP_COPY } from "./copy/mcpExplainer";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [chatMessages, setChatMessages] = useState<ChatMessageDisplay[]>([]);

  return (
    <McpProvider>
      <DisplayProvider activeTab={activeTab}>
        <header className="app-header">
          <h1>MCP Explorer - Task Manager</h1>
          <p>
            {activeTab === "manual"
              ? MCP_COPY.appSubtitleManual
              : MCP_COPY.appSubtitleAi}
          </p>
        </header>
        <main className="app-layout">
          <div className="panels-column">
            <div className="tab-bar">
              <button
                className={`tab-button${activeTab === "manual" ? " tab-button--active" : ""}`}
                onClick={() => setActiveTab("manual")}
              >
                You are the MCP Client
              </button>
              <button
                className={`tab-button${activeTab === "ai" ? " tab-button--active" : ""}`}
                onClick={() => setActiveTab("ai")}
              >
                Ollama is the MCP Client
              </button>
            </div>
            {activeTab === "manual" ? (
              <>
                <ResourcesPanel />
                <ToolsPanel />
                <PromptsPanel />
              </>
            ) : (
              <ChatPanel
                messages={chatMessages}
                onMessagesChange={setChatMessages}
              />
            )}
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
