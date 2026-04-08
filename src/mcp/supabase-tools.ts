import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabase(): SupabaseClient {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
  }
  return createClient(url, key);
}

export type ProjectRow = {
  id: string;
  name: string;
  contractor: string;
  address: string;
  status: string;
  description: string;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: string;
  start_date?: string;
  due_date?: string;
  progress: number;
  cost: number;
  created_at: string;
  updated_at: string;
};

export async function listProjects(supabase?: SupabaseClient): Promise<ProjectRow[]> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectRow[];
}

export async function getProject(id: string, supabase?: SupabaseClient): Promise<ProjectRow | null> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProjectRow | null;
}

export async function createProject(
  input: Partial<ProjectRow>,
  supabase?: SupabaseClient,
): Promise<ProjectRow> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("projects")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function updateProject(
  id: string,
  input: Partial<ProjectRow>,
  supabase?: SupabaseClient,
): Promise<ProjectRow> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("projects")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function listTasks(projectId: string, supabase?: SupabaseClient): Promise<TaskRow[]> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export async function createTask(
  input: Partial<TaskRow>,
  supabase?: SupabaseClient,
): Promise<TaskRow> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("tasks")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function updateTask(
  id: string,
  input: Partial<TaskRow>,
  supabase?: SupabaseClient,
): Promise<TaskRow> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("tasks")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function searchProjects(query: string, supabase?: SupabaseClient): Promise<ProjectRow[]> {
  const db = supabase ?? getSupabase();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .or(`name.ilike.%${query}%,address.ilike.%${query}%,contractor.ilike.%${query}%`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectRow[];
}
