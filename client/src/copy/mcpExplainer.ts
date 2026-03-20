export const MCP_COPY = {
  appSubtitle: "Browse Resources, Tools, and Prompts exposed by the MCP server.",
  resourcesBlurb:
    "Resources are read-only data the server exposes by URI. Click a resource to Read it.",
  toolsBlurb:
    "Tools are actions the client can invoke with arguments. Fill the form and Call a tool.",
  promptsBlurb:
    "Prompts are pre-built messages the server returns. Invoke a prompt to get that content.",
  postActionRead: (uri: string) =>
    `You read ${uri} — the server returned this data as a Resource.`,
  postActionCall: (toolName: string) =>
    `You called ${toolName} — this Tool executed on the server.`,
  postActionInvoke: (promptName: string) =>
    `You invoked the ${promptName} prompt — this content came from a Prompt.`,
  postActionList: (capability: string) =>
    `You listed ${capability} via ${capability.toLowerCase()}/list.`,
} as const;
