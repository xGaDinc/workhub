import express from 'express';
import db, { saveDb, rowsToObjects } from './db.js';
import { authMiddleware, AuthRequest, loadProjectMember, checkPermission } from './middleware.js';

const router = express.Router();

router.use(authMiddleware);

// ============================================
// ПОЛУЧИТЬ ВСЕ ЗАДАЧИ ПРОЕКТА
// ============================================

router.get('/project/:projectId', loadProjectMember, (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const member = req.projectMember!;

  // Получаем все задачи проекта
  const result = db.exec(`
    SELECT t.*, 
      u.name as assigned_name,
      creator.name as creator_name,
      s.title as status_title,
      s.slug as status_slug
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN statuses s ON t.status_id = s.id
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
  `, [projectId]);

  let tasks = rowsToObjects(result);

  // Фильтруем по правам на чтение (для member/viewer)
  if (member.role !== 'owner' && member.role !== 'admin') {
    tasks = tasks.filter(task => {
      const perm = member.permissions.get(task.status_id) || member.permissions.get(null);
      return perm?.can_read;
    });
  }

  res.json(tasks);
});

// ============================================
// СОЗДАТЬ ЗАДАЧУ
// ============================================

router.post('/project/:projectId', loadProjectMember, (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { title, description, status_id, priority = 'medium', assigned_to, due_date } = req.body;
  const member = req.projectMember!;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Получаем status_id (если не указан, берём первый статус проекта)
  let finalStatusId = status_id;
  if (!finalStatusId) {
    const statusResult = db.exec(
      'SELECT id FROM statuses WHERE project_id = ? ORDER BY position LIMIT 1',
      [projectId]
    );
    const firstStatus = rowsToObjects(statusResult)[0];
    if (!firstStatus) {
      return res.status(400).json({ error: 'No statuses in project' });
    }
    finalStatusId = firstStatus.id;
  }

  // Проверяем права на создание в этом статусе
  if (member.role !== 'owner' && member.role !== 'admin') {
    const perm = member.permissions.get(finalStatusId) || member.permissions.get(null);
    if (!perm?.can_create) {
      return res.status(403).json({ error: 'No permission to create tasks in this status' });
    }
  }

  try {
    db.run(
      'INSERT INTO tasks (project_id, title, description, status_id, priority, assigned_to, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, title, description || null, finalStatusId, priority, assigned_to || null, req.user!.id, due_date || null]
    );
    saveDb();

    const result = db.exec('SELECT last_insert_rowid() as id')[0];
    const id = result.values[0][0];

    // Получаем созданную задачу с джойнами
    const taskResult = db.exec(`
      SELECT t.*, 
        u.name as assigned_name,
        creator.name as creator_name,
        s.title as status_title,
        s.slug as status_slug
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.id = ?
    `, [id]);

    res.status(201).json(rowsToObjects(taskResult)[0]);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ============================================
// ОБНОВИТЬ ЗАДАЧУ
// ============================================

router.patch('/:taskId', (req: AuthRequest, res) => {
  const { taskId } = req.params;
  const { title, description, status_id, priority, assigned_to, due_date } = req.body;

  // Получаем задачу
  const taskResult = db.exec('SELECT * FROM tasks WHERE id = ?', [taskId]);
  const task = rowsToObjects(taskResult)[0];

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Загружаем права для проекта
  const projectId = task.project_id;
  const userId = req.user!.id;

  // Проверяем членство в проекте
  let memberRole = '';
  let permissions = new Map<number | null, any>();

  if (req.user!.is_admin) {
    memberRole = 'owner';
  } else {
    const memberResult = db.exec(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    const member = rowsToObjects(memberResult)[0];

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    memberRole = member.role;

    if (memberRole !== 'owner' && memberRole !== 'admin') {
      const permResult = db.exec(
        'SELECT * FROM permissions WHERE project_member_id = ?',
        [member.id]
      );
      rowsToObjects(permResult).forEach((p: any) => {
        permissions.set(p.status_id, p);
      });
    }
  }

  // Проверяем права на редактирование
  if (memberRole !== 'owner' && memberRole !== 'admin') {
    const perm = permissions.get(task.status_id) || permissions.get(null);
    if (!perm?.can_edit) {
      return res.status(403).json({ error: 'No permission to edit tasks in this status' });
    }

    // Если меняется статус, проверяем права на создание в новом статусе
    if (status_id && status_id !== task.status_id) {
      const newPerm = permissions.get(status_id) || permissions.get(null);
      if (!newPerm?.can_create) {
        return res.status(403).json({ error: 'No permission to move tasks to this status' });
      }
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (status_id !== undefined) { updates.push('status_id = ?'); values.push(status_id); }
  if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
  if (assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(assigned_to); }
  if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(taskId);

  db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDb();

  const result = db.exec(`
    SELECT t.*, 
      u.name as assigned_name,
      creator.name as creator_name,
      s.title as status_title,
      s.slug as status_slug
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN statuses s ON t.status_id = s.id
    WHERE t.id = ?
  `, [taskId]);

  res.json(rowsToObjects(result)[0]);
});

// ============================================
// УДАЛИТЬ ЗАДАЧУ
// ============================================

router.delete('/:taskId', (req: AuthRequest, res) => {
  const { taskId } = req.params;

  // Получаем задачу
  const taskResult = db.exec('SELECT * FROM tasks WHERE id = ?', [taskId]);
  const task = rowsToObjects(taskResult)[0];

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const projectId = task.project_id;
  const userId = req.user!.id;

  // Проверяем членство и права
  let memberRole = '';
  let permissions = new Map<number | null, any>();

  if (req.user!.is_admin) {
    memberRole = 'owner';
  } else {
    const memberResult = db.exec(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    const member = rowsToObjects(memberResult)[0];

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    memberRole = member.role;

    if (memberRole !== 'owner' && memberRole !== 'admin') {
      const permResult = db.exec(
        'SELECT * FROM permissions WHERE project_member_id = ?',
        [member.id]
      );
      rowsToObjects(permResult).forEach((p: any) => {
        permissions.set(p.status_id, p);
      });
    }
  }

  // Проверяем права на удаление
  if (memberRole !== 'owner' && memberRole !== 'admin') {
    const perm = permissions.get(task.status_id) || permissions.get(null);
    if (!perm?.can_delete) {
      return res.status(403).json({ error: 'No permission to delete tasks in this status' });
    }
  }

  db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  saveDb();

  res.status(204).send();
});

// ============================================
// ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЕЙ ПРОЕКТА (для назначения)
// ============================================

router.get('/project/:projectId/users', loadProjectMember, (req: AuthRequest, res) => {
  const { projectId } = req.params;

  const result = db.exec(`
    SELECT u.id, u.email, u.name, pm.role
    FROM project_members pm
    INNER JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY u.name
  `, [projectId]);

  res.json(rowsToObjects(result));
});

export default router;
