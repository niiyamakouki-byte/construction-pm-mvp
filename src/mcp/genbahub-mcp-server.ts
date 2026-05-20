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
import {
  createEstimate,
  getEstimate,
  listEstimates,
  parseEstimateNl,
} from "./estimate-tools.js";
import {
  classifyPhoto,
  listPhotos,
  tagPhoto,
} from "./photo-tools.js";
import {
  createDailyReport,
  generateDailyReport,
  listDailyReports,
} from "./report-tools.js";
import {
  createSchedule,
  importSchedule,
  listScheduleItems,
  updateScheduleItem,
} from "./schedule-tools.js";
import {
  generateArticle,
  recommendKeywords,
  reportToGbp,
  trackSerp,
} from "./meo-tools.js";
import {
  computeEstimateTotal,
  listCostItems,
  searchCostMaster,
} from "./cost-tools.js";
import { searchAll } from "./search-tools.js";

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

const estimateItemSchema = z.object({
  name: z.string().describe("Estimate item name"),
  quantity: z.number().describe("Quantity"),
  unit: z.string().describe("Unit label"),
  unit_price: z.number().describe("Unit price in JPY"),
  category: z.string().optional().describe("Cost category"),
});

const scheduleItemSchema = z.object({
  name: z.string().describe("Schedule item name"),
  description: z.string().optional().describe("Schedule item description"),
  start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
  due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
  progress: z.number().min(0).max(100).optional().describe("Progress percentage"),
  cost: z.number().optional().describe("Planned cost in JPY"),
});

const scheduleUpdateSchema = {
  name: z.string().optional().describe("Schedule item name"),
  description: z.string().optional().describe("Schedule item description"),
  status: z.enum(["todo", "in_progress", "done"]).optional().describe("Schedule item status"),
  start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
  due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
  progress: z.number().min(0).max(100).optional().describe("Progress percentage"),
  cost: z.number().optional().describe("Planned cost in JPY"),
};

const totalItemSchema = z.object({
  quantity: z.number().describe("Quantity"),
  unit_price: z.number().describe("Unit price in JPY"),
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

server.tool(
  "create_estimate",
  "Create a draft estimate with line items for a project.",
  {
    project_id: z.string().describe("Project UUID"),
    items: z.array(estimateItemSchema).min(1).describe("Estimate line items"),
    notes: z.string().optional().describe("Estimate notes"),
  },
  async (input) => {
    try {
      return safeResult(await createEstimate(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "list_estimates",
  "List estimates, optionally filtered by project.",
  { project_id: z.string().optional().describe("Project UUID") },
  async ({ project_id }) => {
    try {
      return safeResult(await listEstimates(project_id));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "get_estimate",
  "Get a single estimate by ID.",
  { id: z.string().describe("Estimate ID") },
  async ({ id }) => {
    try {
      const estimate = await getEstimate(id);
      if (!estimate) return errorResult(new Error(`Estimate ${id} not found`));
      return safeResult(estimate);
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "parse_estimate_nl",
  "Parse natural language renovation scope into estimate intent.",
  { text: z.string().describe("Natural language estimate request") },
  async ({ text }) => {
    try {
      return safeResult(parseEstimateNl(text));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "classify_photo",
  "Classify a construction photo into an interior work category.",
  {
    photo_url: z.string().optional().describe("Photo URL or filename"),
    photo_id: z.string().optional().describe("Existing photo ID"),
  },
  async (input) => {
    try {
      return safeResult(await classifyPhoto(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "list_photos",
  "List project photos, optionally filtered by project or tag.",
  {
    project_id: z.string().optional().describe("Project UUID"),
    tag: z.string().optional().describe("Photo tag"),
  },
  async (input) => {
    try {
      return safeResult(await listPhotos(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "tag_photo",
  "Replace the tags assigned to a photo.",
  {
    photo_id: z.string().describe("Photo ID"),
    tags: z.array(z.string()).describe("Tags to assign"),
  },
  async (input) => {
    try {
      return safeResult(await tagPhoto(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "create_daily_report",
  "Create or replace a daily construction report.",
  {
    project_id: z.string().describe("Project UUID"),
    date: z.string().describe("Report date (YYYY-MM-DD)"),
    body: z.string().describe("Report body"),
    attendees: z.array(z.string()).optional().describe("Attendee names"),
  },
  async (input) => {
    try {
      return safeResult(await createDailyReport(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "list_daily_reports",
  "List daily reports, optionally filtered by project and date range.",
  {
    project_id: z.string().optional().describe("Project UUID"),
    date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
  },
  async (input) => {
    try {
      return safeResult(await listDailyReports(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "generate_daily_report",
  "Generate printable daily report HTML for a project date.",
  {
    project_id: z.string().describe("Project UUID"),
    date: z.string().describe("Report date (YYYY-MM-DD)"),
  },
  async (input) => {
    try {
      return safeResult(await generateDailyReport(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "create_schedule",
  "Create schedule items for a project.",
  {
    project_id: z.string().describe("Project UUID"),
    items: z.array(scheduleItemSchema).min(1).describe("Schedule items"),
  },
  async (input) => {
    try {
      return safeResult(await createSchedule(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "list_schedule_items",
  "List schedule items for a project.",
  { project_id: z.string().describe("Project UUID") },
  async ({ project_id }) => {
    try {
      return safeResult(await listScheduleItems(project_id));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "update_schedule_item",
  "Update fields on one schedule item.",
  {
    id: z.string().describe("Schedule item ID"),
    fields: z.object(scheduleUpdateSchema).describe("Fields to update"),
  },
  async ({ id, fields }) => {
    try {
      return safeResult(await updateScheduleItem(id, fields));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "import_schedule",
  "Import schedule items from a JSON payload.",
  {
    project_id: z.string().describe("Project UUID"),
    file_base64: z.string().optional().describe("Base64 encoded JSON array"),
    buffer: z.string().optional().describe("Raw JSON array"),
  },
  async (input) => {
    try {
      return safeResult(await importSchedule(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "recommend_keywords",
  "Recommend local SEO keywords for a completed project.",
  { project_id: z.string().describe("Project UUID") },
  async ({ project_id }) => {
    try {
      return safeResult(await recommendKeywords(project_id));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "generate_article",
  "Generate a local SEO article for a primary keyword.",
  {
    project_id: z.string().describe("Project UUID"),
    primary_keyword: z.string().describe("Primary SEO keyword"),
  },
  async (input) => {
    try {
      return safeResult(await generateArticle(input));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "track_serp",
  "Track SERP rankings for recommended project keywords.",
  { project_id: z.string().describe("Project UUID") },
  async ({ project_id }) => {
    try {
      return safeResult(await trackSerp(project_id));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "report_to_gbp",
  "Prepare a Google Business Profile sync report for a project.",
  { project_id: z.string().describe("Project UUID") },
  async ({ project_id }) => {
    try {
      return safeResult(await reportToGbp(project_id));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "list_cost_items",
  "List cost master items, optionally filtered by category.",
  { category: z.string().optional().describe("Cost category") },
  async ({ category }) => {
    try {
      return safeResult(await listCostItems(category));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "search_cost_master",
  "Search cost master items by code, name, category, or note.",
  { query: z.string().describe("Search keyword") },
  async ({ query }) => {
    try {
      return safeResult(await searchCostMaster(query));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "compute_estimate_total",
  "Compute subtotal, tax, and total for estimate line items.",
  { items: z.array(totalItemSchema).describe("Estimate items") },
  async ({ items }) => {
    try {
      return safeResult(computeEstimateTotal(items));
    } catch (err) { return errorResult(err); }
  },
);

server.tool(
  "search_all",
  "Search across projects, estimates, photos, and reports.",
  { query: z.string().describe("Search keyword") },
  async ({ query }) => {
    try {
      return safeResult(await searchAll(query));
    } catch (err) { return errorResult(err); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
