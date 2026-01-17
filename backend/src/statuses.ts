import express from 'express';
import db, { saveDb, rowsToObjects } from './db.js';
import { authMiddleware, AuthRequest, loadProjectMember, requireProjectRole } from './middleware.js';

const router = express.Router();

router.use(authMiddleware);

// ============================================
// ПОЛУЧИТЬ ВСЕ СТАТУСЫ ПРОЕКТА
// ============================================

router.get('/project/:projectId', loadProjectMember, (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const member = req.projectMember!;

  const result = db.exec(
    'SELECT * FROM statuses WHERE project_id = ? ORDER BY position',
    [projectId]
  );

  let statuses = rowsToObjects(result);

  // Добавляем информацию о правах для каждого статуса
  statuses = statuses.map(status => {
    let permissions = { can_read: true, can_create: true, can_edit: true, can_delete: true };
    
    if (member.role !== 'owner' && member.role !== 'admin') {
      const perm = member.permissions.get(status.id) || member.permissions.get(null);
      permissions = perm || { can_read: false, can_create: false, can_edit: false, can_delete: false };
    }

    return {
      ...status,
      permissions
    };
  });

  res.json(statuses);
});

// ============================================
// СОЗДАТЬ СТАТУС
// ============================================

router.post('/project/:projectId', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { slug, title, color, icon } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Генерируем slug если не указан
  const finalSlug = slug || title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  // Проверяем уникальность slug в проекте
  const existingResult = db.exec(
    'SELECT id FROM statuses WHERE project_id = ? AND slug = ?',
    [projectId, finalSlug]
  );
  if (rowsToObjects(existingResult).length > 0) {
    return res.status(400).json({ error: 'Status with this slug already exists' });
  }

  // Получаем максимальную позицию
  const maxPosResult = db.exec(
    'SELECT MAX(position) as maxPos FROM statuses WHERE project_id = ?',
    [projectId]
  );
  const maxPos = maxPosResult[0]?.values[0]?.[0] ?? -1;
  const position = Number(maxPos) + 1;

  db.run(
    'INSERT INTO statuses (project_id, slug, title, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, finalSlug, title, color || 'from-slate-700 to-slate-800', icon || '📌', position]
  );
  saveDb();

  const result = db.exec('SELECT last_insert_rowid() as id')[0];
  const id = result.values[0][0];

  const statusResult = db.exec('SELECT * FROM statuses WHERE id = ?', [id]);
  res.status(201).json(rowsToObjects(statusResult)[0]);
});

// ============================================
// ОБНОВИТЬ СТАТУС
// ============================================

router.patch('/:statusId', (req: AuthRequest, res) => {
  const { statusId } = req.params;
  const { title, color, icon } = req.body;

  // Получаем статус и проверяем права
  const statusResult = db.exec('SELECT * FROM statuses WHERE id = ?', [statusId]);
  const status = rowsToObjects(statusResult)[0];

  if (!status) {
    return res.status(404).json({ error: 'Status not found' });
  }

  const projectId = status.project_id;
  const userId = req.user!.id;

  // Проверяем права
  if (!req.user!.is_admin) {
    const memberResult = db.exec(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    const member = rowsToObjects(memberResult)[0];

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Only project owner or admin can edit statuses' });
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (color !== undefined) { updates.push('color = ?'); values.push(color); }
  if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(statusId);
  db.run(`UPDATE statuses SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDb();

  const result = db.exec('SELECT * FROM statuses WHERE id = ?', [statusId]);
  res.json(rowsToObjects(result)[0]);
});

// ============================================
// УДАЛИТЬ СТАТУС
// ============================================

router.delete('/:statusId', (req: AuthRequest, res) => {
  const { statusId } = req.params;

  // Получаем статус
  const statusResult = db.exec('SELECT * FROM statuses WHERE id = ?', [statusId]);
  const status = rowsToObjects(statusResult)[0];

  if (!status) {
    return res.status(404).json({ error: 'Status not found' });
  }

  const projectId = status.project_id;
  const userId = req.user!.id;

  // Проверяем права
  if (!req.user!.is_admin) {
    const memberResult = db.exec(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    const member = rowsToObjects(memberResult)[0];

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Only project owner or admin can delete statuses' });
    }
  }

  // Проверяем, что это не последний статус
  const countResult = db.exec(
    'SELECT COUNT(*) as count FROM statuses WHERE project_id = ?',
    [projectId]
  );
  if (countResult[0].values[0][0] <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last status' });
  }

  // Проверяем, есть ли задачи с этим статусом
  const tasksResult = db.exec('SELECT COUNT(*) as count FROM tasks WHERE status_id = ?', [statusId]);
  if (tasksResult[0].values[0][0] > 0) {
    return res.status(400).json({ error: 'Cannot delete status with existing tasks. Move or delete tasks first.' });
  }

  db.run('DELETE FROM statuses WHERE id = ?', [statusId]);
  saveDb();

  res.status(204).send();
});

// ============================================
// ИЗМЕНИТЬ ПОРЯДОК СТАТУСОВ
// ============================================

router.put('/project/:projectId/reorder', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { statuses } = req.body;

  if (!Array.isArray(statuses)) {
    return res.status(400).json({ error: 'Statuses array is required' });
  }

  statuses.forEach((status: any, index: number) => {
    db.run(
      'UPDATE statuses SET position = ? WHERE id = ? AND project_id = ?',
      [index, status.id, projectId]
    );
  });
  saveDb();

  res.json({ success: true });
});

export default router;
