export const MCP_COPY = {
  appSubtitleManual:
    "In this application, you are the LLM (MCP client). Browse Resources, Tools, and Prompts exposed by the MCP server. The available resources, tools and prompts were fetched from the server via the resources/list, tools/list and prompts/list tools. They are dynamic lists dependent on what is made available by the server.",
  appSubtitleAi:
    "Watch Ollama (the MCP client) interpret your plain-language requests, select the right MCP operation, and execute it — just like agents like Claude do under the hood.",
  resourcesBlurb:
    "Resources are read-only data the server exposes by URI. Think of them like a simple GET with no params. You (the client) will have to figure out how to contextualise the raw data you receive. Click a resource to Read it.",
  toolsBlurb:
    "Tools are actions the client can invoke with arguments. They provide all the CRUD operations. They are the only way to mutate the server state, or read using a parameterised query. Again, what is returned is up to you to contextualise. Fill the form and Call a tool.",
  promptsBlurb:
    "Prompts are pre-built messages the server returns in a structured 'LLM friendly' format. The message is opinionated and tells the LLM the purpose of the data as well providing the data itself. Invoke a prompt and check the network tab to see how the response structure differs from Tools and Resources.",
  chatBlurb:
    "Type a plain-language request and watch the AI select and execute the right MCP operation.",
  postActionRead: (uri: string) =>
    `You read ${uri} — the server returned this data as a Resource.`,
  postActionCall: (toolName: string) =>
    `You called the ${toolName} tool — this Tool executed on the server.`,
  postActionInvoke: (promptName: string) =>
    `You invoked the ${promptName} prompt — this content came from a Prompt.`,
  postActionAiRead: (uri: string) =>
    `The AI read the resource ${uri} — this is exactly how an MCP client uses Resources.`,
  postActionAiCall: (toolName: string) =>
    `The AI called the ${toolName} tool — this is how an MCP client uses Tools to mutate state or run parameterised queries.`,
  postActionAiInvoke: (promptName: string) =>
    `The AI invoked the ${promptName} prompt — this is how an MCP client uses Prompts to get structured, LLM-oriented content.`,
  promptNoArgs: "No arguments — invoke directly.",
  ollamaSetupHint:
    "LLM features require Ollama running locally. Install: brew install ollama && ollama pull llama3.1",
} as const;
