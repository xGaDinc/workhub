import express from 'express';
import { Task, Status, User, ProjectMember, Permission } from './db.js';
import { authMiddleware, AuthRequest, loadProjectMember, checkPermission } from './middleware.js';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================
// ПОЛУЧИТЬ ВСЕ ЗАДАЧИ ПРОЕКТА
// ============================================

router.get('/project/:projectId', authMiddleware, loadProjectMember, checkPermission('read'), async (req: AuthRequest, res) => {
  const { projectId } = req.params;

  try {
    const tasks = await Task.find({ project_id: new mongoose.Types.ObjectId(projectId) })
      .populate('status_id', 'title slug')
      .populate('assigned_to', 'name')
      .populate('created_by', 'name')
      .sort({ created_at: -1 });

    const result = tasks.map(task => {
      const status = task.status_id as any;
      const assignee = task.assigned_to as any;
      const creator = task.created_by as any;
      
      return {
        id: task._id,
        project_id: task.project_id,
        title: task.title,
        description: task.description,
        status_id: status._id,
        status_title: status.title,
        status_slug: status.slug,
        priority: task.priority,
        assigned_to: task.assigned_to ? (task.assigned_to as any)._id : null,
        assigned_name: assignee?.name || null,
        created_by: creator._id,
        creator_name: creator.name,
        due_date: task.due_date,
        checklist: task.checklist,
        attachments: task.attachments,
        created_at: task.created_at,
        updated_at: task.updated_at
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// СОЗДАТЬ ЗАДАЧУ
// ============================================

router.post('/project/:projectId', authMiddleware, loadProjectMember, checkPermission('create', 'status_id'), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { title, description, status_id, priority, assigned_to, due_date, checklist } = req.body;

  if (!title || !status_id) {
    return res.status(400).json({ error: 'Title and status_id are required' });
  }

  try {
    const task = await Task.create({
      project_id: new mongoose.Types.ObjectId(projectId),
      title,
      description,
      status_id: new mongoose.Types.ObjectId(status_id),
      priority: priority || 'medium',
      assigned_to: assigned_to ? new mongoose.Types.ObjectId(assigned_to) : undefined,
      created_by: new mongoose.Types.ObjectId(req.user!.id),
      due_date: due_date ? new Date(due_date) : undefined,
      checklist: checklist || []
    });

    const status = await Status.findById(status_id);
    const creator = await User.findById(req.user!.id);
    
    res.status(201).json({
      id: task._id,
      project_id: task.project_id,
      title: task.title,
      description: task.description,
      status_id: task.status_id,
      status_title: status?.title,
      status_slug: status?.slug,
      priority: task.priority,
      assigned_to: task.assigned_to,
      assigned_name: null,
      created_by: task.created_by,
      creator_name: creator?.name,
      due_date: task.due_date,
      checklist: task.checklist,
      attachments: task.attachments,
      created_at: task.created_at,
      updated_at: task.updated_at
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ОБНОВИТЬ ЗАДАЧУ
// ============================================

router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { title, description, status_id, priority, assigned_to, due_date, checklist, attachments } = req.body;

  try {
    const task = await Task.findById(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Для глобального админа - полный доступ
    if (!req.user!.is_admin) {
      const member = await ProjectMember.findOne({
        project_id: task.project_id,
        user_id: new mongoose.Types.ObjectId(req.user!.id)
      });
      
      if (!member) {
        return res.status(403).json({ error: 'Not a project member' });
      }
      
      if (member.role !== 'owner' && member.role !== 'admin') {
        const perms = await Permission.find({ project_member_id: member._id });
        const statusPerm = perms.find(p => p.status_id?.toString() === task.status_id.toString());
        if (!statusPerm?.can_edit) {
          return res.status(403).json({ error: 'No permission to edit' });
        }
      }
    }

    const updateData: any = { updated_at: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status_id !== undefined) updateData.status_id = new mongoose.Types.ObjectId(status_id);
    if (priority !== undefined) updateData.priority = priority;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to ? new mongoose.Types.ObjectId(assigned_to) : null;
    if (due_date !== undefined) updateData.due_date = due_date ? new Date(due_date) : null;
    if (checklist !== undefined) updateData.checklist = checklist;
    if (attachments !== undefined) updateData.attachments = attachments;

    const updated = await Task.findByIdAndUpdate(id, updateData, { new: true });
    const status = await Status.findById(updated!.status_id);
    const creator = await User.findById(updated!.created_by);
    const assignee = updated!.assigned_to ? await User.findById(updated!.assigned_to) : null;

    res.json({
      id: updated!._id,
      project_id: updated!.project_id,
      title: updated!.title,
      description: updated!.description,
      status_id: updated!.status_id,
      status_title: status?.title,
      status_slug: status?.slug,
      priority: updated!.priority,
      assigned_to: updated!.assigned_to,
      assigned_name: assignee?.name || null,
      created_by: updated!.created_by,
      creator_name: creator?.name,
      due_date: updated!.due_date,
      checklist: updated!.checklist,
      attachments: updated!.attachments,
      created_at: updated!.created_at,
      updated_at: updated!.updated_at
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// УДАЛИТЬ ЗАДАЧУ
// ============================================

router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const task = await Task.findById(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Для глобального админа - полный доступ
    if (!req.user!.is_admin) {
      const member = await ProjectMember.findOne({
        project_id: task.project_id,
        user_id: new mongoose.Types.ObjectId(req.user!.id)
      });
      
      if (!member) {
        return res.status(403).json({ error: 'Not a project member' });
      }
      
      if (member.role !== 'owner' && member.role !== 'admin') {
        const perms = await Permission.find({ project_member_id: member._id });
        const statusPerm = perms.find(p => p.status_id?.toString() === task.status_id.toString());
        if (!statusPerm?.can_delete) {
          return res.status(403).json({ error: 'No permission to delete' });
        }
      }
    }

    await Task.findByIdAndDelete(id);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЕЙ ПРОЕКТА (для назначения)
// ============================================

router.get('/project/:projectId/users', authMiddleware, loadProjectMember, async (req: AuthRequest, res) => {
  const { projectId } = req.params;

  try {
    const members = await ProjectMember.find({ 
      project_id: new mongoose.Types.ObjectId(projectId) 
    }).populate('user_id', 'name email');

    const users = members.map(m => {
      const user = m.user_id as any;
      return {
        id: user._id,
        name: user.name,
        email: user.email
      };
    });

    res.json(users);
  } catch (error) {
    console.error('Get project users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
