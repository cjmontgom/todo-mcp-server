import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// In-memory task store
const tasks = new Map();
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
const server = new Server({
    name: "task-manager",
    version: "1.0.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
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
        const summary = `Task Summary
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
                    },
                    required: ["title", "description"],
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
            const id = String(tasks.size + 1);
            const newTask = {
                id,
                title: args.title,
                description: args.description,
                status: "todo",
                priority: args.priority || "medium",
                createdAt: new Date().toISOString(),
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
        case "update_task_status": {
            const task = tasks.get(args.id);
            if (!task) {
                return {
                    content: [{ type: "text", text: `Task ${args.id} not found` }],
                    isError: true,
                };
            }
            task.status = args.status;
            return {
                content: [
                    {
                        type: "text",
                        text: `Updated task ${args.id} status to ${args.status}`,
                    },
                ],
            };
        }
        case "get_task": {
            const task = tasks.get(args.id);
            if (!task) {
                return {
                    content: [{ type: "text", text: `Task ${args.id} not found` }],
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
            if (!tasks.has(args.id)) {
                return {
                    content: [{ type: "text", text: `Task ${args.id} not found` }],
                    isError: true,
                };
            }
            tasks.delete(args.id);
            return {
                content: [{ type: "text", text: `Deleted task ${args.id}` }],
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
