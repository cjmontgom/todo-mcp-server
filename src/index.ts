import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  dueDate?: string;
}

const VALID_STATUSES: Task["status"][] = ["todo", "in-progress", "done"];
const VALID_PRIORITIES: Task["priority"][] = ["low", "medium", "high"];
const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

function escMdCell(s: string): string {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function markdownTable(tasks: Task[]): string {
  const header = "| ID | Title | Priority | Due | Status |";
  const separator = "| --- | --- | --- | --- | --- |";
  const lines = tasks.map(
    (t) =>
      `| ${escMdCell(t.id)} | ${escMdCell(t.title)} | ${escMdCell(t.priority)} | ${escMdCell(t.dueDate ?? "")} | ${escMdCell(t.status)} |`
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
        content: [
          {
            type: "text",
            text: `Created task ${id}: ${newTask.title}`,
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
      if ("status" in args) task.status = args.status as Task["status"];
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