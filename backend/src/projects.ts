import express from 'express';
import bcrypt from 'bcryptjs';
import { Project, ProjectMember, Status, Task, Permission, User } from './db.js';
import { authMiddleware, AuthRequest, loadProjectMember, requireProjectRole } from './middleware.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(authMiddleware);

// ============================================
// ПОЛУЧИТЬ ВСЕ ПРОЕКТЫ ПОЛЬЗОВАТЕЛЯ
// ============================================

router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.is_admin;

  try {
    let projects;
    
    if (isAdmin) {
      // Глобальный админ видит все проекты
      projects = await Project.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'created_by',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },
        {
          $lookup: {
            from: 'projectmembers',
            let: { projectId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$project_id', '$$projectId'] } } },
              { $count: 'count' }
            ],
            as: 'members'
          }
        },
        {
          $lookup: {
            from: 'tasks',
            let: { projectId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$project_id', '$$projectId'] } } },
              { $count: 'count' }
            ],
            as: 'tasks'
          }
        },
        {
          $lookup: {
            from: 'projectmembers',
            let: { projectId: '$_id' },
            pipeline: [
              { 
                $match: { 
                  $expr: { 
                    $and: [
                      { $eq: ['$project_id', '$$projectId'] },
                      { $eq: ['$user_id', new mongoose.Types.ObjectId(userId)] }
                    ]
                  }
                }
              }
            ],
            as: 'my_membership'
          }
        },
        {
          $project: {
            id: '$_id',
            name: 1,
            description: 1,
            created_by: 1,
            creator_name: '$creator.name',
            created_at: 1,
            my_role: { 
              $ifNull: [
                { $arrayElemAt: ['$my_membership.role', 0] },
                'admin'
              ]
            },
            members_count: { $ifNull: [{ $arrayElemAt: ['$members.count', 0] }, 0] },
            tasks_count: { $ifNull: [{ $arrayElemAt: ['$tasks.count', 0] }, 0] }
          }
        },
        { $sort: { created_at: -1 } }
      ]);
    } else {
      // Обычный пользователь видит только свои проекты
      const memberships = await ProjectMember.find({ 
        user_id: new mongoose.Types.ObjectId(userId) 
      });
      
      const projectIds = memberships.map(m => m.project_id);
      
      projects = await Project.aggregate([
        { $match: { _id: { $in: projectIds } } },
        {
          $lookup: {
            from: 'users',
            localField: 'created_by',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },
        {
          $lookup: {
            from: 'projectmembers',
            let: { projectId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$project_id', '$$projectId'] } } },
              { $count: 'count' }
            ],
            as: 'members'
          }
        },
        {
          $lookup: {
            from: 'tasks',
            let: { projectId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$project_id', '$$projectId'] } } },
              { $count: 'count' }
            ],
            as: 'tasks'
          }
        },
        {
          $lookup: {
            from: 'projectmembers',
            let: { projectId: '$_id' },
            pipeline: [
              { 
                $match: { 
                  $expr: { 
                    $and: [
                      { $eq: ['$project_id', '$$projectId'] },
                      { $eq: ['$user_id', new mongoose.Types.ObjectId(userId)] }
                    ]
                  }
                }
              }
            ],
            as: 'my_membership'
          }
        },
        {
          $project: {
            id: '$_id',
            name: 1,
            description: 1,
            created_by: 1,
            creator_name: '$creator.name',
            created_at: 1,
            my_role: { $arrayElemAt: ['$my_membership.role', 0] },
            members_count: { $ifNull: [{ $arrayElemAt: ['$members.count', 0] }, 0] },
            tasks_count: { $ifNull: [{ $arrayElemAt: ['$tasks.count', 0] }, 0] }
          }
        },
        { $sort: { created_at: -1 } }
      ]);
    }

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// СОЗДАТЬ ПРОЕКТ
// ============================================

router.post('/', async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  const userId = req.user!.id;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    // Создаём проект
    const project = await Project.create({
      name,
      description: description || null,
      created_by: new mongoose.Types.ObjectId(userId)
    });

    // Добавляем создателя как owner
    await ProjectMember.create({
      project_id: project._id,
      user_id: new mongoose.Types.ObjectId(userId),
      role: 'owner'
    });

    // Создаём дефолтные статусы
    const defaultStatuses = [
      { slug: 'todo', title: 'To Do', color: 'from-slate-700 to-slate-800', icon: '📋', position: 0 },
      { slug: 'in_progress', title: 'In Progress', color: 'from-blue-700 to-blue-800', icon: '⚡', position: 1 },
      { slug: 'done', title: 'Done', color: 'from-green-700 to-green-800', icon: '✓', position: 2 },
    ];

    await Promise.all(defaultStatuses.map(status => 
      Status.create({
        project_id: project._id,
        slug: status.slug,
        title: status.title,
        color: status.color,
        icon: status.icon,
        position: status.position
      })
    ));

    res.status(201).json({
      id: project._id,
      name: project.name,
      description: project.description,
      created_by: project.created_by,
      my_role: 'owner'
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ПОЛУЧИТЬ ПРОЕКТ
// ============================================

router.get('/:id', loadProjectMember, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const project = await Project.findById(id).populate('created_by', 'name email');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const creator = project.created_by as any;
    
    res.json({
      id: project._id,
      name: project.name,
      description: project.description,
      created_by: project.created_by,
      creator_name: creator.name,
      created_at: project.created_at,
      my_role: req.projectMember!.role
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ОБНОВИТЬ ПРОЕКТ
// ============================================

router.patch('/:id', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const project = await Project.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      id: project._id,
      name: project.name,
      description: project.description,
      created_by: project.created_by
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// УДАЛИТЬ ПРОЕКТ
// ============================================

router.delete('/:id', loadProjectMember, requireProjectRole('owner'), async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    await Project.findByIdAndDelete(id);
    // Mongoose автоматически удалит связанные документы благодаря каскадному удалению
    await ProjectMember.deleteMany({ project_id: new mongoose.Types.ObjectId(id) });
    await Status.deleteMany({ project_id: new mongoose.Types.ObjectId(id) });
    await Task.deleteMany({ project_id: new mongoose.Types.ObjectId(id) });

    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ПОЛУЧИТЬ УЧАСТНИКОВ ПРОЕКТА
// ============================================

router.get('/:id/members', loadProjectMember, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const members = await ProjectMember.find({ 
      project_id: new mongoose.Types.ObjectId(id) 
    }).populate('user_id', 'name email').sort({ created_at: 1 });

    const result = members.map(m => {
      const user = m.user_id as any;
      return {
        id: m._id,
        project_id: m.project_id,
        user_id: user._id,
        role: m.role,
        email: user.email,
        name: user.name,
        created_at: m.created_at
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ДОБАВИТЬ УЧАСТНИКА
// ============================================

router.post('/:id/members', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { user_id, role } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const member = await ProjectMember.create({
      project_id: new mongoose.Types.ObjectId(id),
      user_id: new mongoose.Types.ObjectId(user_id),
      role: role || 'member'
    });

    const populated = await ProjectMember.findById(member._id).populate('user_id', 'name email');
    const user = populated!.user_id as any;

    res.status(201).json({
      id: populated!._id,
      project_id: populated!.project_id,
      user_id: user._id,
      role: populated!.role,
      email: user.email,
      name: user.name,
      created_at: populated!.created_at
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'User is already a member' });
    }
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// СОЗДАТЬ И ДОБАВИТЬ УЧАСТНИКА
// ============================================

router.post('/:id/members/create', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { email, name, password, role } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await User.create({
      email,
      name,
      password: hashedPassword,
      is_admin: false
    });

    const member = await ProjectMember.create({
      project_id: new mongoose.Types.ObjectId(id),
      user_id: user._id,
      role: role || 'member'
    });

    res.status(201).json({
      id: member._id,
      project_id: member.project_id,
      user_id: user._id,
      role: member.role,
      email: user.email,
      name: user.name,
      created_at: member.created_at
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Create and add member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ИЗМЕНИТЬ РОЛЬ УЧАСТНИКА
// ============================================

router.patch('/:id/members/:memberId', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { id, memberId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  try {
    const member = await ProjectMember.findById(memberId);
    
    if (!member || member.project_id.toString() !== id) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'owner' && req.projectMember!.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can change owner role' });
    }

    member.role = role;
    await member.save();

    const populated = await ProjectMember.findById(memberId).populate('user_id', 'name email');
    const user = populated!.user_id as any;

    res.json({
      id: populated!._id,
      project_id: populated!.project_id,
      user_id: user._id,
      role: populated!.role,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// УДАЛИТЬ УЧАСТНИКА
// ============================================

router.delete('/:id/members/:memberId', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { id, memberId } = req.params;

  try {
    const member = await ProjectMember.findById(memberId);
    
    if (!member || member.project_id.toString() !== id) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    await ProjectMember.findByIdAndDelete(memberId);
    await Permission.deleteMany({ project_member_id: new mongoose.Types.ObjectId(memberId) });

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ПОЛУЧИТЬ ПРАВА УЧАСТНИКА
// ============================================

router.get('/:id/members/:memberId/permissions', loadProjectMember, async (req: AuthRequest, res) => {
  const { memberId } = req.params;

  try {
    const member = await ProjectMember.findById(memberId);
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'owner' || member.role === 'admin') {
      return res.json({ role: member.role, permissions: [] });
    }

    const permissions = await Permission.find({ 
      project_member_id: new mongoose.Types.ObjectId(memberId) 
    }).populate('status_id', 'title slug');

    const result = permissions.map(p => {
      const status = p.status_id as any;
      return {
        id: p._id,
        project_member_id: p.project_member_id,
        status_id: p.status_id,
        status_title: status?.title,
        status_slug: status?.slug,
        can_read: p.can_read,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete
      };
    });

    res.json({ role: member.role, permissions: result });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// УСТАНОВИТЬ ПРАВА УЧАСТНИКА
// ============================================

router.put('/:id/members/:memberId/permissions', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { memberId } = req.params;
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions array is required' });
  }

  try {
    const member = await ProjectMember.findById(memberId);
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'owner' || member.role === 'admin') {
      return res.status(400).json({ error: 'Cannot set permissions for owner or admin' });
    }

    // Удаляем старые права
    await Permission.deleteMany({ project_member_id: new mongoose.Types.ObjectId(memberId) });

    // Создаём новые
    const newPermissions = await Promise.all(
      permissions.map(p => 
        Permission.create({
          project_member_id: new mongoose.Types.ObjectId(memberId),
          status_id: p.status_id ? new mongoose.Types.ObjectId(p.status_id) : null,
          can_read: p.can_read ?? true,
          can_create: p.can_create ?? false,
          can_edit: p.can_edit ?? false,
          can_delete: p.can_delete ?? false
        })
      )
    );

    res.json({ 
      message: 'Permissions updated',
      permissions: newPermissions.map(p => ({
        id: p._id,
        project_member_id: p.project_member_id,
        status_id: p.status_id,
        can_read: p.can_read,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete
      }))
    });
  } catch (error) {
    console.error('Set permissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
