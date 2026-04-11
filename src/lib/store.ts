/**
 * Project store — in-memory CRUD for projects.
 * Also exports projectRepository for Repository-pattern consumers.
 */

import { createRepository } from './repository/index.js';

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on_hold';

export type StoreProject = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  address?: string;
  budget?: number;
  includeWeekends: boolean;
  createdAt: string;
  updatedAt: string;
};

// In-memory store
const projects: Map<string, StoreProject> = new Map();

/** テスト用リセット関数 */
export function _resetProjectStore(): void {
  projects.clear();
}

export function getProjects(): StoreProject[] {
  return Array.from(projects.values());
}

export function getProject(id: string): StoreProject | undefined {
  return projects.get(id);
}

export function addProject(project: StoreProject): StoreProject {
  projects.set(project.id, project);
  return project;
}

export function updateProject(id: string, patch: Partial<Omit<StoreProject, 'id' | 'createdAt'>>): StoreProject | null {
  const existing = projects.get(id);
  if (!existing) return null;
  const updated: StoreProject = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  projects.set(id, updated);
  return updated;
}

export function deleteProject(id: string): boolean {
  return projects.delete(id);
}

// Repository-pattern accessor (for gradual migration to Supabase)
export const projectRepository = createRepository<StoreProject>('projects');
