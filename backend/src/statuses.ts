import express from 'express';
import { Status, Task, Permission, ProjectMember } from './db.js';
import { authMiddleware, AuthRequest, loadProjectMember, requireProjectRole } from './middleware.js';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================
// ПОЛУЧИТЬ ВСЕ СТАТУСЫ ПРОЕКТА
// ============================================

router.get('/project/:projectId', authMiddleware, loadProjectMember, async (req: AuthRequest, res) => {
  const { projectId } = req.params;

  try {
    const statuses = await Status.find({ 
      project_id: new mongoose.Types.ObjectId(projectId) 
    }).sort({ position: 1 });

    const member = req.projectMember!;
    
    const result = statuses.map(status => {
      let permissions = { can_read: true, can_create: true, can_edit: true, can_delete: true };
      
      if (member.role !== 'owner' && member.role !== 'admin') {
        const perm = member.permissions.get(status._id.toString()) || member.permissions.get(null);
        permissions = perm || { can_read: false, can_create: false, can_edit: false, can_delete: false };
      }

      return {
        id: status._id,
        project_id: status.project_id,
        slug: status.slug,
        title: status.title,
        color: status.color,
        icon: status.icon,
        position: status.position,
        permissions
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get statuses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// СОЗДАТЬ СТАТУС
// ============================================

router.post('/project/:projectId', authMiddleware, loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { slug, title, color, icon } = req.body;

  if (!slug || !title) {
    return res.status(400).json({ error: 'Slug and title are required' });
  }

  try {
    const maxPosition = await Status.findOne({ 
      project_id: new mongoose.Types.ObjectId(projectId) 
    }).sort({ position: -1 });

    const position = maxPosition ? maxPosition.position + 1 : 0;

    const status = await Status.create({
      project_id: new mongoose.Types.ObjectId(projectId),
      slug,
      title,
      color: color || '#475569',
      icon: icon || '📌',
      position
    });

    res.status(201).json({
      id: status._id,
      project_id: status.project_id,
      slug: status.slug,
      title: status.title,
      color: status.color,
      icon: status.icon,
      position: status.position,
      permissions: { can_read: true, can_create: true, can_edit: true, can_delete: true }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Status with this slug already exists' });
    }
    console.error('Create status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ОБНОВИТЬ СТАТУС
// ============================================

router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { title, color, icon } = req.body;

  try {
    const status = await Status.findById(id);
    
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    req.params.projectId = status.project_id.toString();
    await new Promise<void>((resolve, reject) => {
      loadProjectMember(req, res, (err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const member = req.projectMember!;
    if (member.role !== 'owner' && member.role !== 'admin') {
      return res.status(403).json({ error: 'Only owner or admin can update statuses' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;

    const updated = await Status.findByIdAndUpdate(id, updateData, { new: true });

    res.json({
      id: updated!._id,
      project_id: updated!.project_id,
      slug: updated!.slug,
      title: updated!.title,
      color: updated!.color,
      icon: updated!.icon,
      position: updated!.position
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// УДАЛИТЬ СТАТУС
// ============================================

router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const status = await Status.findById(id);
    
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    req.params.projectId = status.project_id.toString();
    await new Promise<void>((resolve, reject) => {
      loadProjectMember(req, res, (err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const member = req.projectMember!;
    if (member.role !== 'owner' && member.role !== 'admin') {
      return res.status(403).json({ error: 'Only owner or admin can delete statuses' });
    }

    const tasksCount = await Task.countDocuments({ status_id: new mongoose.Types.ObjectId(id) });
    
    if (tasksCount > 0) {
      return res.status(400).json({ error: 'Cannot delete status with tasks' });
    }

    await Status.findByIdAndDelete(id);
    await Permission.deleteMany({ status_id: new mongoose.Types.ObjectId(id) });

    res.json({ message: 'Status deleted' });
  } catch (error) {
    console.error('Delete status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ИЗМЕНИТЬ ПОРЯДОК СТАТУСОВ
// ============================================

router.put('/project/:projectId/reorder', authMiddleware, loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { statuses } = req.body;

  if (!Array.isArray(statuses)) {
    return res.status(400).json({ error: 'Statuses array is required' });
  }

  try {
    const updates = statuses.map((s, index) => 
      Status.findByIdAndUpdate(s.id, { position: index })
    );

    await Promise.all(updates);

    const updated = await Status.find({ 
      project_id: new mongoose.Types.ObjectId(projectId) 
    }).sort({ position: 1 });

    res.json(updated.map(s => ({
      id: s._id,
      project_id: s.project_id,
      slug: s.slug,
      title: s.title,
      color: s.color,
      icon: s.icon,
      position: s.position
    })));
  } catch (error) {
    console.error('Reorder statuses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
