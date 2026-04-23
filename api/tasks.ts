import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import { Task, TaskPriority } from '../types';

interface TaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  tags?: string[];
}

interface BackendTask {
  id: number;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  tags?: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function toFrontend(t: BackendTask, category = 'Personal'): Task {
  return {
    id: String(t.id),
    title: t.title,
    description: t.description,
    priority: (t.priority?.toLowerCase() as TaskPriority) || 'normal',
    completed: t.status === 'DONE' || !!t.completedAt,
    category,
    date: t.dueDate ? t.dueDate.split('T')[0] : '',
    source: 'local',
    recurrence: 'none',
  };
}

function toPayload(task: Partial<Task>): TaskPayload {
  const payload: TaskPayload = { title: task.title || '' };
  if (task.description) payload.description = task.description;
  if (task.priority) payload.priority = task.priority.toUpperCase() as any;
  if (task.date) payload.dueDate = task.date + 'T00:00:00';
  if (task.completed !== undefined) payload.status = task.completed ? 'DONE' : 'TODO';
  return payload;
}

export async function fetchTasks(): Promise<Task[]> {
  const data = await apiGet<BackendTask[]>('/api/tasks');
  return data.map(t => toFrontend(t));
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  const data = await apiPost<BackendTask>('/api/tasks', toPayload(task));
  return toFrontend(data, task.category);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const data = await apiPut<BackendTask>(`/api/tasks/${id}`, toPayload(updates));
  return toFrontend(data, updates.category);
}

export async function completeTask(id: string): Promise<Task> {
  const data = await apiPatch<BackendTask>(`/api/tasks/${id}/complete`);
  return toFrontend(data);
}

export async function deleteTask(id: string): Promise<void> {
  await apiDelete(`/api/tasks/${id}`);
}
