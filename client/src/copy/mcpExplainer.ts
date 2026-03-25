export const MCP_COPY = {
  appSubtitle: "In this application, you are the LLM (MCP client). Browse Resources, Tools, and Prompts exposed by the MCP server. The available resources, tools and prompts were fetched from the server via the resources/list, tools/list and prompts/list tools. They are a dynamic lists dependent on what is made available by the server.",
  resourcesBlurb:
    "Resources are read-only data the server exposes by URI. Think of them like a simple GET with no params. You (the client) will have to figure out how to contextualise the raw data you recieve. Click a resource to Read it.",
  toolsBlurb:
    "Tools are actions the client can invoke with arguments. They provide all the CRUD operations. They are the only way to mutate the server state, or read using a parameterised query. Again, what is returned is up to you to contextualise. Fill the form and Call a tool.",
  promptsBlurb:
    "Prompts are pre-built messages the server returns in a structured 'LLM friendly' format. The message is opinionated and tells the LLM the purpose of the data as well providing the data itself. Invoke a prompt and check the network tab to see the response structure.",
  postActionRead: (uri: string) =>
    `You read ${uri} — the server returned this data as a Resource.`,
  postActionCall: (toolName: string) =>
    `You called ${toolName} — this Tool executed on the server.`,
  postActionInvoke: (promptName: string) =>
    `You invoked the ${promptName} prompt — this content came from a Prompt.`,
  promptNoArgs: "No arguments — invoke directly.",
} as const;
