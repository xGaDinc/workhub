import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обработка ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH
// ============================================

export const auth = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) => 
    api.post('/auth/register', { email, password, name }),
  me: () => 
    api.get('/auth/me'),
  getUsers: () => 
    api.get('/auth/users'),
  updateUser: (id: number, data: any) => 
    api.patch(`/auth/users/${id}`, data),
  deleteUser: (id: number) => 
    api.delete(`/auth/users/${id}`),
};

// ============================================
// PROJECTS
// ============================================

export const projects = {
  getAll: () => 
    api.get('/projects'),
  getOne: (id: number) => 
    api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string }) => 
    api.post('/projects', data),
  update: (id: number, data: { name?: string; description?: string }) => 
    api.patch(`/projects/${id}`, data),
  delete: (id: number) => 
    api.delete(`/projects/${id}`),
  
  // Members
  getMembers: (projectId: number) => 
    api.get(`/projects/${projectId}/members`),
  addMember: (projectId: number, data: { user_id: number; role?: string }) => 
    api.post(`/projects/${projectId}/members`, data),
  createAndAddMember: (projectId: number, data: { email: string; name: string; password: string; role?: string }) => 
    api.post(`/projects/${projectId}/members/create`, data),
  updateMember: (projectId: number, memberId: number, data: { role: string }) => 
    api.patch(`/projects/${projectId}/members/${memberId}`, data),
  removeMember: (projectId: number, memberId: number) => 
    api.delete(`/projects/${projectId}/members/${memberId}`),
  
  // Permissions
  getMemberPermissions: (projectId: number, memberId: number) => 
    api.get(`/projects/${projectId}/members/${memberId}/permissions`),
  setMemberPermissions: (projectId: number, memberId: number, permissions: any[]) => 
    api.put(`/projects/${projectId}/members/${memberId}/permissions`, { permissions }),
};

// ============================================
// TASKS
// ============================================

export const tasks = {
  getAll: (projectId: number) => 
    api.get(`/tasks/project/${projectId}`),
  create: (projectId: number, data: any) => 
    api.post(`/tasks/project/${projectId}`, data),
  update: (taskId: number, data: any) => 
    api.patch(`/tasks/${taskId}`, data),
  delete: (taskId: number) => 
    api.delete(`/tasks/${taskId}`),
  getUsers: (projectId: number) => 
    api.get(`/tasks/project/${projectId}/users`),
};

// ============================================
// STATUSES
// ============================================

export const statuses = {
  getAll: (projectId: number) => 
    api.get(`/statuses/project/${projectId}`),
  create: (projectId: number, data: any) => 
    api.post(`/statuses/project/${projectId}`, data),
  update: (statusId: number, data: any) => 
    api.patch(`/statuses/${statusId}`, data),
  delete: (statusId: number) => 
    api.delete(`/statuses/${statusId}`),
  reorder: (projectId: number, statusList: any[]) => 
    api.put(`/statuses/project/${projectId}/reorder`, { statuses: statusList }),
};

export default api;
