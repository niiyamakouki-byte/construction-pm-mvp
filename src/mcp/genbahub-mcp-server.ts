import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  listTasks,
  createTask,
  updateTask,
  searchProjects,
} from "./supabase-tools.js";

const server = new McpServer({
  name: "genbahub",
  version: "1.0.0",
});

server.tool(
  "list_projects",
  "List all construction projects in GenbaHub",
  {},
  async () => {
    const projects = await listProjects();
    return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
  },
);

server.tool(
  "get_project",
  "Get a single project by ID",
  { id: z.string().describe("Project UUID") },
  async ({ id }) => {
    const project = await getProject(id);
    if (!project) {
      return { content: [{ type: "text", text: `Project ${id} not found` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
  },
);

server.tool(
  "create_project",
  "Create a new construction project",
  {
    name: z.string().describe("Project name"),
    contractor: z.string().describe("Contractor name"),
    address: z.string().describe("Site address"),
    status: z.enum(["planning", "active", "completed"]).optional().describe("Project status"),
    description: z.string().optional().describe("Project description"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
  },
  async (input) => {
    const project = await createProject(input);
    return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
  },
);

server.tool(
  "update_project",
  "Update an existing project",
  {
    id: z.string().describe("Project UUID"),
    name: z.string().optional(),
    contractor: z.string().optional(),
    address: z.string().optional(),
    status: z.enum(["planning", "active", "completed"]).optional(),
    description: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  },
  async ({ id, ...fields }) => {
    const project = await updateProject(id, fields);
    return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
  },
);

server.tool(
  "list_tasks",
  "List all tasks for a project",
  { project_id: z.string().describe("Project UUID") },
  async ({ project_id }) => {
    const tasks = await listTasks(project_id);
    return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
  },
);

server.tool(
  "create_task",
  "Create a new task within a project",
  {
    project_id: z.string().describe("Project UUID"),
    name: z.string().describe("Task name"),
    description: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    progress: z.number().min(0).max(100).optional().describe("Progress percentage"),
    cost: z.number().optional().describe("Task cost in JPY"),
  },
  async (input) => {
    const task = await createTask(input);
    return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
  },
);

server.tool(
  "update_task",
  "Update an existing task",
  {
    id: z.string().describe("Task UUID"),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
    cost: z.number().optional(),
  },
  async ({ id, ...fields }) => {
    const task = await updateTask(id, fields);
    return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
  },
);

server.tool(
  "search_projects",
  "Search projects by name, address, or contractor",
  { query: z.string().describe("Search keyword") },
  async ({ query }) => {
    const projects = await searchProjects(query);
    return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
