export const MCP_COPY = {
  appSubtitleManual:
    "In this application, you are the LLM (MCP client). Browse Resources, Tools, and Prompts exposed by the MCP server. The available resources, tools and prompts were fetched from the server via the resources/list, tools/list and prompts/list tools. They are dynamic lists dependent on what is made available by the server.",
  appSubtitleAi:
    "Watch the AI (MCP client) interpret your plain-language requests, select the right MCP operation, and execute it — just like agents like Claude do under the hood.",
  resourcesBlurb:
    "Resources are read-only data the server exposes by URI. Think of them like a simple GET with no params. You (the client) will have to figure out how to contextualise the raw data you receive. Click a resource to Read it.",
  toolsBlurb:
    "Tools are actions the client can invoke with arguments. They provide all the CRUD operations. They are the only way to mutate the server state, or read using a parameterised query. Again, what is returned is up to you to contextualise. Fill the form and Call a tool.",
  samplingResultTitle: "Sampling enrichment detected",
  samplingResultNote:
    "The server used Sampling to request the help of the LLM before finishing create_task. Compare your original input with the enriched values below.",
  samplingManualRequestNote:
    "The server sent this sampling/createMessage request and is waiting for your response. You are the MCP client.",
  samplingManualAnsweredNote:
    "You answered the server's sampling/createMessage - you acted as the MCP client.",
  samplingTitle: "What is Sampling?",
  samplingExplanation:
    "Sampling is the forth MCP primitive. During initialise, a sampling-capable client declares capabilities.sampling. Sampling flips the script in that the server sends a request to the client (normally an LLM), then waits for that response before continuing. In this example, this has a practical use case of enriching the task creation input with AI-powered data if, for example, the user did not provide adequate details.",
  samplingFallbackNote:
    "No sampling enrichment was detected for this create_task call, so the server appears to have used your original values as-is.",
  promptsBlurb:
    "Prompts are pre-built messages the server returns in a structured 'LLM friendly' format. The message is opinionated and tells the LLM the purpose of the data as well providing the data itself. Invoke a prompt and check the network tab to see how the response structure differs from Tools and Resources.",
  chatBlurb:
    "Type a plain-language request and watch the AI select and execute the right MCP operation.",
  postActionRead: (uri: string) =>
    `You read ${uri} — the server returned this data as a Resource.`,
  postActionCall: (toolName: string) =>
    `You called the ${toolName} tool — this Tool executed on the server.`,
  postActionSamplingCall: (toolName: string) =>
    `You called the ${toolName} tool — the server executed the Tool and used Sampling to ask its client for an LLM completion.`,
  postActionInvoke: (promptName: string) =>
    `You invoked the ${promptName} prompt — this content came from a Prompt.`,
  postActionAiRead: (uri: string) =>
    `The AI read ${uri} — the server returned this data as a Resource.`,
  postActionAiCall: (toolName: string) =>
    `The AI called the ${toolName} tool — tool — this Tool executed on the server.`,
  postActionAiInvoke: (promptName: string) =>
    `The AI invoked the ${promptName} prompt — this content came from a Prompt.`,
  promptNoArgs: "No arguments — invoke directly.",
  ollamaSetupHint:
    "LLM features require Ollama running locally. Install: brew install ollama && ollama pull llama3.1",
  samplingTraceTitle: "Sampling Trace",
  samplingTraceStep1:
    "The AI (MCP client) selected and called create_task_using_sampling — the server will now execute the tool.",
  samplingTraceStep2:
    "The server sent a sampling/createMessage request — it delegated the task enrichment back to the AI.",
  samplingTraceStep3:
    "The proxy received the sampling request and forwarded it to the LLM — the AI acting as sampling client.",
  samplingTraceStep4:
    "The LLM generated a response — raw model output containing the enriched task fields in JSON.",
  samplingTraceStep5:
    "The server applied the enrichment — task fields were updated using the AI-generated values.",
  samplingTraceStep6:
    "Task created successfully with enriched values — the sampling round-trip is complete.",

} as const;
