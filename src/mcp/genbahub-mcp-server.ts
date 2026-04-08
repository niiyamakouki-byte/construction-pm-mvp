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

function safeResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `エラー: ${msg}` }], isError: true };
}

const server = new McpServer({
  name: "genbahub",
  version: "1.0.0",
});

server.tool(
  "list_projects",
  "List all construction projects in GenbaHub",
  {},
  async () => {
    try {
      const projects = await listProjects();
      return safeResult(projects);
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "get_project",
  "Get a single project by ID",
  { id: z.string().describe("Project UUID") },
  async ({ id }) => {
    try {
      const project = await getProject(id);
      if (!project) {
        return errorResult(new Error(`Project ${id} not found`));
      }
      return safeResult(project);
    } catch (err) { return errorResult(err); }
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
    try {
      const project = await createProject(input);
      return safeResult(project);
    } catch (err) { return errorResult(err); }
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
    try {
      const project = await updateProject(id, fields);
      return safeResult(project);
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "list_tasks",
  "List all tasks for a project",
  { project_id: z.string().describe("Project UUID") },
  async ({ project_id }) => {
    try {
      const tasks = await listTasks(project_id);
      return safeResult(tasks);
    } catch (err) { return errorResult(err); }
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
    try {
      const task = await createTask(input);
      return safeResult(task);
    } catch (err) { return errorResult(err); }
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
    try {
      const task = await updateTask(id, fields);
      return safeResult(task);
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "search_projects",
  "Search projects by name, address, or contractor",
  { query: z.string().describe("Search keyword") },
  async ({ query }) => {
    try {
      const projects = await searchProjects(query);
      return safeResult(projects);
    } catch (err) { return errorResult(err); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
