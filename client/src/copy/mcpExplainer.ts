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
  gridNoteResource: "This grid shows data Read from a Resource. We're using AG Grid as much as possible so you can learn it while learning MCP.",
  toolMutatedNote: "You just used a Tool — the server state changed.",
  toolRefreshHint: "Re-read any Resource above to see the updated task data.",
  gridNoteTool: "This grid shows data returned by a Tool Call. Tools execute actions on the server — unlike Resources, which are read-only.",
  gridNotePrompt: "This content came from a Prompt — shown here in the grid.",
} as const;
