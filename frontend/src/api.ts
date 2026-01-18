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
  updateUser: (id: string, data: any) => 
    api.patch(`/auth/users/${id}`, data),
  deleteUser: (id: string) => 
    api.delete(`/auth/users/${id}`),
};

// ============================================
// PROJECTS
// ============================================

export const projects = {
  getAll: () => 
    api.get('/projects'),
  getOne: (id: string) => 
    api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string }) => 
    api.post('/projects', data),
  update: (id: string, data: { name?: string; description?: string }) => 
    api.patch(`/projects/${id}`, data),
  delete: (id: string) => 
    api.delete(`/projects/${id}`),
  
  // Members
  getMembers: (projectId: string) => 
    api.get(`/projects/${projectId}/members`),
  addMember: (projectId: string, data: { user_id: string; role?: string }) => 
    api.post(`/projects/${projectId}/members`, data),
  createAndAddMember: (projectId: string, data: { email: string; name: string; password: string; role?: string }) => 
    api.post(`/projects/${projectId}/members/create`, data),
  updateMember: (projectId: string, memberId: string, data: { role: string }) => 
    api.patch(`/projects/${projectId}/members/${memberId}`, data),
  removeMember: (projectId: string, memberId: string) => 
    api.delete(`/projects/${projectId}/members/${memberId}`),
  
  // Permissions
  getMemberPermissions: (projectId: string, memberId: string) => 
    api.get(`/projects/${projectId}/members/${memberId}/permissions`),
  setMemberPermissions: (projectId: string, memberId: string, permissions: any[]) => 
    api.put(`/projects/${projectId}/members/${memberId}/permissions`, { permissions }),
};

// ============================================
// TASKS
// ============================================

export const tasks = {
  getAll: (projectId: string) => 
    api.get(`/tasks/project/${projectId}`),
  create: (projectId: string, data: any) => 
    api.post(`/tasks/project/${projectId}`, data),
  update: (taskId: string, data: any) => 
    api.patch(`/tasks/${taskId}`, data),
  delete: (taskId: string) => 
    api.delete(`/tasks/${taskId}`),
  getUsers: (projectId: string) => 
    api.get(`/tasks/project/${projectId}/users`),
  uploadAttachment: (taskId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/tasks/${taskId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteAttachment: (taskId: string, attachmentId: string) => 
    api.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
  getComments: (taskId: string) =>
    api.get(`/tasks/${taskId}/comments`),
  createComment: (taskId: string, text: string) =>
    api.post(`/tasks/${taskId}/comments`, { text }),
  updateComment: (commentId: string, text: string) =>
    api.patch(`/comments/${commentId}`, { text }),
  deleteComment: (commentId: string) =>
    api.delete(`/comments/${commentId}`),
};

// ============================================
// STATUSES
// ============================================

export const statuses = {
  getAll: (projectId: string) => 
    api.get(`/statuses/project/${projectId}`),
  create: (projectId: string, data: any) => 
    api.post(`/statuses/project/${projectId}`, data),
  update: (statusId: string, data: any) => 
    api.patch(`/statuses/${statusId}`, data),
  delete: (statusId: string) => 
    api.delete(`/statuses/${statusId}`),
  reorder: (projectId: string, statusList: any[]) => 
    api.put(`/statuses/project/${projectId}/reorder`, { statuses: statusList }),
};

// ============================================
// SEARCH
// ============================================

export const search = {
  tasks: (query: string, projectId?: string) =>
    api.get('/search', { params: { q: query, projectId } }),
};

export default api;
