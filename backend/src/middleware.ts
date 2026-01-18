import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { ProjectMember, Permission } from './db.js';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; is_admin: boolean };
  projectMember?: {
    id: string;
    role: string;
    permissions: Map<string | null, PermissionData>;
  };
}

export interface PermissionData {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// ============================================
// БАЗОВАЯ АВТОРИЗАЦИЯ
// ============================================

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; is_admin: boolean };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// ПРОВЕРКА ГЛОБАЛЬНОГО АДМИНА
// ============================================

export const globalAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Global admin access required' });
  }
  next();
};

// ============================================
// ЗАГРУЗКА ПРАВ УЧАСТНИКА ПРОЕКТА
// ============================================

export const loadProjectMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const projectId = req.params.projectId || req.params.id || req.body.project_id;
  
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  const userId = req.user!.id;

  // Глобальный админ имеет полный доступ
  if (req.user!.is_admin) {
    req.projectMember = {
      id: '0',
      role: 'owner',
      permissions: new Map([[null, { can_read: true, can_create: true, can_edit: true, can_delete: true }]])
    };
    return next();
  }

  try {
    // Ищем участника проекта
    const member = await ProjectMember.findOne({ 
      project_id: new mongoose.Types.ObjectId(projectId), 
      user_id: new mongoose.Types.ObjectId(userId) 
    });

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    // Загружаем права
    const permissionsList = await Permission.find({ project_member_id: member._id });

    const permissions = new Map<string | null, PermissionData>();
    
    // Для owner и admin — полный доступ
    if (member.role === 'owner' || member.role === 'admin') {
      permissions.set(null, { can_read: true, can_create: true, can_edit: true, can_delete: true });
    } else {
      // Для member и viewer — загружаем конкретные права
      permissionsList.forEach((p) => {
        permissions.set(p.status_id?.toString() || null, {
          can_read: p.can_read,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete
        });
      });
    }

    req.projectMember = {
      id: member._id.toString(),
      role: member.role,
      permissions
    };

    next();
  } catch (error) {
    console.error('Load project member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============================================
// ПРОВЕРКА ПРАВ НА ДЕЙСТВИЕ
// ============================================

export const checkPermission = (action: 'read' | 'create' | 'edit' | 'delete', statusIdParam?: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const member = req.projectMember;
    
    if (!member) {
      return res.status(403).json({ error: 'No project membership loaded' });
    }

    // Owner и admin имеют полный доступ
    if (member.role === 'owner' || member.role === 'admin') {
      return next();
    }

    // Получаем status_id
    let statusId: string | null = null;
    if (statusIdParam) {
      statusId = req.params[statusIdParam] || req.body[statusIdParam];
    }

    // Проверяем права
    const perm = member.permissions.get(statusId) || member.permissions.get(null);
    
    if (!perm) {
      return res.status(403).json({ error: 'No permissions for this status' });
    }

    const actionKey = `can_${action}` as keyof PermissionData;
    if (!perm[actionKey]) {
      return res.status(403).json({ error: `No permission to ${action}` });
    }

    next();
  };
};

// ============================================
// ПРОВЕРКА РОЛИ В ПРОЕКТЕ
// ============================================

export const requireProjectRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const member = req.projectMember;
    
    if (!member) {
      return res.status(403).json({ error: 'No project membership loaded' });
    }

    if (!roles.includes(member.role)) {
      return res.status(403).json({ error: `Required role: ${roles.join(' or ')}` });
    }

    next();
  };
};
