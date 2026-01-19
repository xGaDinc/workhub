export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  telegram_id?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  telegram_bot_token?: string;
  created_by: string;
  creator_name: string;
  created_at: string;
  my_role: 'owner' | 'admin' | 'member' | 'viewer';
  members_count: number;
  tasks_count: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  email: string;
  name: string;
  created_at: string;
}

export interface Permission {
  id: string;
  project_member_id: string;
  status_id: string | null;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  status_title?: string;
  status_slug?: string;
}

export interface Status {
  id: string;
  project_id: string;
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

export interface ChecklistItem {
  _id?: string;
  text: string;
  completed: boolean;
}

export interface Attachment {
  _id?: string;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  url: string;
  uploaded_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status_id: string;
  status_title: string;
  status_slug: string;
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  assigned_name: string | null;
  created_by: string;
  creator_name: string;
  due_date: string | null;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  text: string;
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
