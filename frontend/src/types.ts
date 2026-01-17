export interface User {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  creator_name: string;
  created_at: string;
  my_role: 'owner' | 'admin' | 'member' | 'viewer';
  members_count: number;
  tasks_count: number;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  email: string;
  name: string;
  created_at: string;
}

export interface Permission {
  id: number;
  project_member_id: number;
  status_id: number | null;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  status_title?: string;
  status_slug?: string;
}

export interface Status {
  id: number;
  project_id: number;
  slug: string;
  title: string;
  color: string;
  icon: string;
  position: number;
  permissions: {
    can_read: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status_id: number;
  status_title: string;
  status_slug: string;
  priority: 'low' | 'medium' | 'high';
  assigned_to: number | null;
  assigned_name: string | null;
  created_by: number;
  creator_name: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: '🟢 Низкий',
  medium: '🟡 Средний',
  high: '🔴 Высокий',
};
