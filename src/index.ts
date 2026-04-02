import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { applyEnrichment, VALID_PRIORITIES } from "./enrichment.js";

// Keep this aligned with proxy human-in-the-loop sampling window.
const SAMPLING_TOOL_TIMEOUT_MS = 10 * 60 * 1000;

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
}

const VALID_STATUSES: Task["status"][] = ["todo", "in-progress", "done"];

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

function escMdCell(s: string): string {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function markdownTable(tasks: Task[]): string {
  const header = "| ID | Title | Description | Priority | Due | Status |";
  const separator = "| --- | --- | --- | --- | --- | --- |";
  const lines = tasks.map(
    (t) =>
      `| ${escMdCell(t.id)} | ${escMdCell(t.title)} | ${escMdCell(t.description)} | ${escMdCell(t.priority)} | ${escMdCell(t.dueDate ?? "")} | ${escMdCell(t.status)} |`
  );
  return [header, separator, ...lines].join("\n");
}

// In-memory task store
const tasks: Map<string, Task> = new Map();

// Initialise with sample tasks
tasks.set("1", {
  id: "1",
  title: "Sample Task",
  description: "This is a sample task",
  status: "todo",
  priority: "medium",
  createdAt: new Date().toISOString(),
});

// Create the MCP server
const server = new Server(
  {
    name: "task-manager",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// RESOURCES - Read-only data exposure
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "task://all",
        name: "All Tasks",
        mimeType: "application/json",
        description: "View all tasks in the system",
      },
      {
        uri: "task://summary",
        name: "Task Summary",
        mimeType: "text/plain",
        description: "Summary of task statistics",
      },
      {
        uri: "task://table/all",
        name: "All Tasks (Table)",
        mimeType: "text/markdown",
        description: "All tasks as a markdown table with columns ID, Title, Priority, Due, Status",
      },
      {
        uri: "task://table/by-deadline",
        name: "Tasks by Deadline",
        mimeType: "text/markdown",
        description: "All tasks sorted by due date (ascending, nulls last) as a markdown table",
      },
      {
        uri: "task://table/by-priority",
        name: "Tasks by Priority",
        mimeType: "text/markdown",
        description: "All tasks sorted by priority (high → medium → low) as a markdown table",
      },
      {
        uri: "task://table/priority-then-deadline",
        name: "Tasks by Priority then Deadline",
        mimeType: "text/markdown",
        description: "All tasks sorted by priority, then by due date within each priority group",
      },
      {
        uri: "task://open",
        name: "Open Tasks",
        mimeType: "text/markdown",
        description: "Only todo and in-progress tasks as a markdown table",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "task://all") {
    const allTasks = Array.from(tasks.values());
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(allTasks, null, 2),
        },
      ],
    };
  }

  if (uri === "task://summary") {
    const total = tasks.size;
    const byStatus = {
      todo: Array.from(tasks.values()).filter((t) => t.status === "todo").length,
      "in-progress": Array.from(tasks.values()).filter((t) => t.status === "in-progress").length,
      done: Array.from(tasks.values()).filter((t) => t.status === "done").length,
    };

    const summary = 
      `Task Summary
      Total Tasks: ${total}
      - Todo: ${byStatus.todo}
      - In Progress: ${byStatus["in-progress"]}
      - Done: ${byStatus.done}`;

    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: summary,
        },
      ],
    };
  }

  if (uri === "task://table/all") {
    const allTasks = [...tasks.values()].sort((a, b) => a.id.localeCompare(b.id));
    return {
      contents: [{ uri, mimeType: "text/markdown", text: markdownTable(allTasks) }],
    };
  }

  if (uri === "task://table/by-deadline") {
    const sorted = [...Array.from(tasks.values())].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return {
      contents: [{ uri, mimeType: "text/markdown", text: markdownTable(sorted) }],
    };
  }

  if (uri === "task://table/by-priority") {
    const sorted = [...tasks.values()].sort((a, b) => {
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.id.localeCompare(b.id);
    });
    return {
      contents: [{ uri, mimeType: "text/markdown", text: markdownTable(sorted) }],
    };
  }

  if (uri === "task://table/priority-then-deadline") {
    const sorted = [...Array.from(tasks.values())].sort((a, b) => {
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return {
      contents: [{ uri, mimeType: "text/markdown", text: markdownTable(sorted) }],
    };
  }

  if (uri === "task://open") {
    const openTasks = [...tasks.values()]
      .filter((t) => t.status === "todo" || t.status === "in-progress")
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      contents: [{ uri, mimeType: "text/markdown", text: markdownTable(openTasks) }],
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// TOOLS - Interactive functions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_task",
        description: "Create a new task",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description" },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Task priority",
            },
            dueDate: {
              type: "string",
              description: "Optional due date (ISO 8601, e.g. 2026-04-01)",
            },
          },
          required: ["title", "description"],
        },
      },
      {
        name: "update_task",
        description: "Update one or more fields of an existing task",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID to update" },
            title: { type: "string", description: "New task title" },
            description: { type: "string", description: "New task description" },
            status: {
              type: "string",
              enum: ["todo", "in-progress", "done"],
              description: "New task status",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "New task priority",
            },
            dueDate: {
              type: ["string", "null"],
              description: "New due date (ISO 8601) or null to clear",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "update_task_status",
        description: "Update the status of a task",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID" },
            status: {
              type: "string",
              enum: ["todo", "in-progress", "done"],
              description: "New status",
            },
          },
          required: ["id", "status"],
        },
      },
      {
        name: "get_task",
        description: "Get details of a specific task",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_task",
        description: "Delete a task",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "create_task_using_sampling",
        description:
          "Create a new task with AI-powered enrichment via MCP sampling. Requires the client to support the sampling capability.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title (required)" },
            description: {
              type: "string",
              description: "Optional starting description — the LLM will improve or create it",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Optional starting priority — the LLM may adjust it",
            },
            dueDate: {
              type: "string",
              description: "Optional due date (ISO 8601, e.g. 2026-04-01) — the LLM may suggest one",
            },
          },
          required: ["title"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "create_task": {
      if (!(args.title as string).trim()) {
        return {
          content: [{ type: "text", text: "Title cannot be empty" }],
          isError: true,
        };
      }
      if (!(args.description as string).trim()) {
        return {
          content: [{ type: "text", text: "Description cannot be empty" }],
          isError: true,
        };
      }

      const id = String(tasks.size + 1);
      const newTask: Task = {
        id,
        title: args.title as string,
        description: args.description as string,
        status: "todo",
        priority: (args.priority as Task["priority"]) || "medium",
        createdAt: new Date().toISOString(),
        dueDate: args.dueDate ? (args.dueDate as string) : undefined,
      };

      tasks.set(id, newTask);

      return {
        content: [{ type: "text", text: `Created task ${id}: ${newTask.title}` }],
      };
    }

    case "create_task_using_sampling": {
      if (!(args.title as string)?.trim()) {
        return {
          content: [{ type: "text", text: "Title cannot be empty" }],
          isError: true,
        };
      }

      const id = String(tasks.size + 1);
      const newTask: Task = {
        id,
        title: args.title as string,
        description: (args.description as string) || "",
        status: "todo",
        priority: (args.priority as Task["priority"]) || "medium",
        createdAt: new Date().toISOString(),
        dueDate: args.dueDate ? (args.dueDate as string) : undefined,
      };

      const original = {
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
      };

      const needsDescription = !original.description.trim();

      const enrichmentPrompt =
        `You are enriching a task for a task manager. ` +
        `Given the task details below, return a JSON object that improves the task.\n\n` +
        `RULES:\n` +
        `- Return ONLY a raw JSON object — no markdown fences, no explanation, no extra text.\n` +
        `- The JSON object may contain: title (string), description (string), priority ("low" | "medium" | "high"), dueDate (ISO 8601 string).\n` +
        (needsDescription
          ? `- The description is MISSING — you MUST provide a useful, actionable description for this task.\n`
          : `- Improve the description if it could be clearer or more actionable.\n`) +
        `- Improve the title if it could be clearer.\n` +
        `- Set or adjust priority and dueDate if appropriate.\n\n` +
        `Task:\n` +
        `- title: ${original.title}\n` +
        `- description: ${original.description || "(empty)"}\n` +
        `- priority: ${original.priority}` +
        (original.dueDate ? `\n- dueDate: ${original.dueDate}` : "") +
        `\n\nRespond with the JSON object only:`;

      let samplingResponse: Awaited<ReturnType<typeof server.createMessage>>;
      try {
        samplingResponse = await Promise.race([
          server.createMessage({
            messages: [{ role: "user", content: { type: "text", text: enrichmentPrompt } }],
            maxTokens: 300,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Sampling timed out")),
              SAMPLING_TOOL_TIMEOUT_MS
            )
          ),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sampling failed";
        const isSamplingTimeout = msg === "Sampling timed out";
        return {
          content: [
            {
              type: "text",
              text: isSamplingTimeout
                ? "Sampling timed out — task not created"
                : `create_task_using_sampling requires sampling capability. The client reported: ${msg}`,
            },
          ],
          isError: true,
        };
      }

      const contentItem = Array.isArray(samplingResponse.content)
        ? samplingResponse.content[0]
        : samplingResponse.content;

      if (!contentItem || contentItem.type !== "text") {
        return {
          content: [{ type: "text", text: "Sampling returned a non-text response — task not created" }],
          isError: true,
        };
      }

      console.log("[sampling] Raw enrichment response:", JSON.stringify(contentItem.text));
      const enrichmentResult = applyEnrichment(newTask, contentItem.text);

      if (!enrichmentResult.enriched) {
        console.warn("[sampling] Enrichment failed — no fields changed. Response was:", contentItem.text);
        return {
          content: [{ type: "text", text: "Sampling returned no usable enrichment — task not created" }],
          isError: true,
        };
      }

      tasks.set(id, newTask);

      const changes = enrichmentResult.changedFields
        .map((f) => {
          const origVal = original[f as keyof typeof original] ?? "";
          const newVal = (newTask as unknown as Record<string, string>)[f] ?? "";
          return `${f}: "${origVal}" → "${newVal}"`;
        })
        .join(", ");

      return {
        content: [
          {
            type: "text",
            text: `Created task ${id}: ${newTask.title} (enriched by AI — ${changes})`,
          },
        ],
      };
    }

    case "update_task": {
      const updateFields = ["title", "description", "status", "priority", "dueDate"] as const;
      if (!updateFields.some((f) => f in args)) {
        return {
          content: [{ type: "text", text: "No fields to update. Provide at least one of: title, description, status, priority, dueDate" }],
          isError: true,
        };
      }

      const id = String(args.id);
      const task = tasks.get(id);
      if (!task) {
        return {
          content: [{ type: "text", text: `Task ${id} not found` }],
          isError: true,
        };
      }

      if ("status" in args && !VALID_STATUSES.includes(args.status as Task["status"])) {
        return {
          content: [{ type: "text", text: `Invalid status: ${args.status}. Must be one of: ${VALID_STATUSES.join(", ")}` }],
          isError: true,
        };
      }

      if ("priority" in args && !VALID_PRIORITIES.includes(args.priority as Task["priority"])) {
        return {
          content: [{ type: "text", text: `Invalid priority: ${args.priority}. Must be one of: ${VALID_PRIORITIES.join(", ")}` }],
          isError: true,
        };
      }

      if ("title" in args && !(args.title as string).trim()) {
        return {
          content: [{ type: "text", text: "Title cannot be empty" }],
          isError: true,
        };
      }

      if ("description" in args && !(args.description as string).trim()) {
        return {
          content: [{ type: "text", text: "Description cannot be empty" }],
          isError: true,
        };
      }

      if ("title" in args) task.title = args.title as string;
      if ("description" in args) task.description = args.description as string;
      if ("status" in args) {
        task.status = args.status as Task["status"];
        if (task.status === "done" && !task.completedAt) {
          task.completedAt = new Date().toISOString();
        } else if (task.status !== "done") {
          task.completedAt = undefined;
        }
      }
      if ("priority" in args) task.priority = args.priority as Task["priority"];

      if ("dueDate" in args) {
        task.dueDate = args.dueDate === null ? undefined : (args.dueDate as string);
      }

      return {
        content: [
          {
            type: "text",
            text: `Updated task ${id}: ${task.title}`,
          },
        ],
      };
    }

    case "update_task_status": {
      const id = String(args.id);
      const task = tasks.get(id);
      if (!task) {
        return {
          content: [{ type: "text", text: `Task ${id} not found` }],
          isError: true,
        };
      }
      task.status = args.status as Task["status"];
      if (task.status === "done" && !task.completedAt) {
        task.completedAt = new Date().toISOString();
      } else if (task.status !== "done") {
        task.completedAt = undefined;
      }
      return {
        content: [
          {
            type: "text",
            text: `Updated task ${id} status to ${args.status}`,
          },
        ],
      };
    }

    case "get_task": {
      const id = String(args.id);
      const task = tasks.get(id);
      if (!task) {
        return {
          content: [{ type: "text", text: `Task ${id} not found` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    }

    case "delete_task": {
      const id = String(args.id);
      if (!tasks.has(id)) {
        return {
          content: [{ type: "text", text: `Task ${id} not found` }],
          isError: true,
        };
      }
      tasks.delete(id);
      return {
        content: [{ type: "text", text: `Deleted task ${id}` }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// PROMPTS - Parameterised prompt templates
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "tasks_table",
        description: "Get all tasks as a markdown table, sorted by the specified order",
        arguments: [
          {
            name: "sort",
            description: "Sort order: 'deadline' | 'priority' | 'priority-then-deadline'",
            required: true,
          },
        ],
      },
      {
        name: "tasks_summary_for_stakeholders",
        description: "Summary of task counts by status, overdue count, and overdue task details",
      },
      {
        name: "completions_by_date",
        description: "Completed tasks grouped by completion date, with optional date range filter",
        arguments: [
          {
            name: "from",
            description: "Start date for filtering (ISO 8601, e.g. 2026-03-01). Optional.",
            required: false,
          },
          {
            name: "to",
            description: "End date for filtering (ISO 8601, e.g. 2026-03-31). Optional.",
            required: false,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: promptArgs = {} } = request.params;

  if (name === "tasks_table") {
    const sort = promptArgs["sort"];
    const allTasks = Array.from(tasks.values());
    let sorted: Task[];

    if (sort === "deadline") {
      sorted = [...allTasks].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if (sort === "priority") {
      sorted = [...allTasks].sort((a, b) => {
        const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pDiff !== 0) return pDiff;
        return a.id.localeCompare(b.id);
      });
    } else if (sort === "priority-then-deadline") {
      sorted = [...allTasks].sort((a, b) => {
        const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pDiff !== 0) return pDiff;
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else {
      throw new Error(
        `Invalid sort value: "${sort}". Must be one of: deadline, priority, priority-then-deadline`
      );
    }

    return {
      messages: [{ role: "user", content: { type: "text", text: markdownTable(sorted) } }],
    };
  }

  if (name === "tasks_summary_for_stakeholders") {
    const allTasks = Array.from(tasks.values());
    const todoCount = allTasks.filter((t) => t.status === "todo").length;
    const inProgressCount = allTasks.filter((t) => t.status === "in-progress").length;
    const doneCount = allTasks.filter((t) => t.status === "done").length;

    const today = new Date().toISOString().slice(0, 10);
    const overdueTasks = allTasks.filter(
      (t) => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== "done"
    );

    let summary = `# Task Summary for Stakeholders\n\n`;
    summary += `| Status | Count |\n| --- | --- |\n`;
    summary += `| Todo | ${todoCount} |\n`;
    summary += `| In Progress | ${inProgressCount} |\n`;
    summary += `| Done | ${doneCount} |\n`;
    summary += `| **Total** | **${allTasks.length}** |\n\n`;
    summary += `**Overdue tasks:** ${overdueTasks.length}\n`;

    if (overdueTasks.length > 0) {
      summary += `\n## Overdue Tasks\n\n`;
      summary += markdownTable(overdueTasks);
    }

    return {
      messages: [{ role: "user", content: { type: "text", text: summary } }],
    };
  }

  if (name === "completions_by_date") {
    const from = promptArgs["from"];
    const to = promptArgs["to"];

    let completed = Array.from(tasks.values()).filter(
      (t) => t.status === "done" && t.completedAt
    );

    if (from) {
      completed = completed.filter((t) => t.completedAt!.slice(0, 10) >= from);
    }
    if (to) {
      completed = completed.filter((t) => t.completedAt!.slice(0, 10) <= to);
    }

    if (completed.length === 0) {
      return {
        messages: [
          { role: "user", content: { type: "text", text: "No completed tasks found." } },
        ],
      };
    }

    const groups: Record<string, number> = {};
    for (const t of completed) {
      const dateKey = t.completedAt!.slice(0, 10);
      groups[dateKey] = (groups[dateKey] || 0) + 1;
    }

    const sortedDates = Object.keys(groups).sort();
    let table = "| Date | Completed |\n| --- | --- |\n";
    for (const date of sortedDates) {
      table += `| ${date} | ${groups[date]} |\n`;
    }

    return {
      messages: [{ role: "user", content: { type: "text", text: table } }],
    };
  }

  throw new Error(`Prompt not found: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Task Manager MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});