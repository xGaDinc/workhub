import express from 'express';
import bcrypt from 'bcryptjs';
import db, { saveDb, rowsToObjects } from './db.js';
import { authMiddleware, AuthRequest, loadProjectMember, requireProjectRole } from './middleware.js';

const router = express.Router();

router.use(authMiddleware);

// ============================================
// ПОЛУЧИТЬ ВСЕ ПРОЕКТЫ ПОЛЬЗОВАТЕЛЯ
// ============================================

router.get('/', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.is_admin;

  let result;
  if (isAdmin) {
    // Глобальный админ видит все проекты
    result = db.exec(`
      SELECT p.*, u.name as creator_name,
        COALESCE(pm.role, 'admin') as my_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as members_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as tasks_count
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);
  } else {
    // Обычный пользователь видит только свои проекты
    result = db.exec(`
      SELECT p.*, u.name as creator_name, pm.role as my_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as members_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as tasks_count
      FROM projects p
      INNER JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `, [userId]);
  }

  const projects = rowsToObjects(result);
  res.json(projects);
});

// ============================================
// СОЗДАТЬ ПРОЕКТ
// ============================================

router.post('/', (req: AuthRequest, res) => {
  const { name, description } = req.body;
  const userId = req.user!.id;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    // Создаём проект
    db.run(
      'INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || null, userId]
    );
    
    const projectResult = db.exec('SELECT last_insert_rowid() as id')[0];
    const projectId = projectResult.values[0][0] as number;

    // Добавляем создателя как owner
    db.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, userId, 'owner']
    );

    // Создаём дефолтные статусы
    const defaultStatuses = [
      { slug: 'todo', title: 'To Do', color: 'from-slate-700 to-slate-800', icon: '📋', position: 0 },
      { slug: 'in_progress', title: 'In Progress', color: 'from-blue-700 to-blue-800', icon: '⚡', position: 1 },
      { slug: 'done', title: 'Done', color: 'from-green-700 to-green-800', icon: '✓', position: 2 },
    ];

    defaultStatuses.forEach(status => {
      db.run(
        'INSERT INTO statuses (project_id, slug, title, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)',
        [projectId, status.slug, status.title, status.color, status.icon, status.position]
      );
    });

    saveDb();

    res.status(201).json({
      id: projectId,
      name,
      description,
      created_by: userId,
      my_role: 'owner'
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ============================================
// ПОЛУЧИТЬ ПРОЕКТ ПО ID
// ============================================

router.get('/:projectId', loadProjectMember, (req: AuthRequest, res) => {
  const { projectId } = req.params;

  const result = db.exec(`
    SELECT p.*, u.name as creator_name
    FROM projects p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
  `, [projectId]);

  const project = rowsToObjects(result)[0];
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({
    ...project,
    my_role: req.projectMember!.role
  });
});

// ============================================
// ОБНОВИТЬ ПРОЕКТ
// ============================================

router.patch('/:projectId', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(projectId);
  db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDb();

  const result = db.exec('SELECT * FROM projects WHERE id = ?', [projectId]);
  const project = rowsToObjects(result)[0];
  res.json(project);
});

// ============================================
// УДАЛИТЬ ПРОЕКТ
// ============================================

router.delete('/:projectId', loadProjectMember, requireProjectRole('owner'), (req: AuthRequest, res) => {
  const { projectId } = req.params;

  db.run('DELETE FROM projects WHERE id = ?', [projectId]);
  saveDb();

  res.status(204).send();
});

// ============================================
// УЧАСТНИКИ ПРОЕКТА
// ============================================

// Получить всех участников
router.get('/:projectId/members', loadProjectMember, (req: AuthRequest, res) => {
  const { projectId } = req.params;

  const result = db.exec(`
    SELECT pm.*, u.email, u.name
    FROM project_members pm
    INNER JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY pm.role, u.name
  `, [projectId]);

  const members = rowsToObjects(result);
  res.json(members);
});

// Добавить участника
router.post('/:projectId/members', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { user_id, role = 'member' } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Проверяем, что роль валидна
  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Нельзя добавить owner (только создатель проекта)
  if (role === 'owner') {
    return res.status(400).json({ error: 'Cannot assign owner role' });
  }

  try {
    db.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, user_id, role]
    );
    
    const memberResult = db.exec('SELECT last_insert_rowid() as id')[0];
    const memberId = memberResult.values[0][0] as number;

    // Для viewer создаём права только на чтение для всех статусов
    if (role === 'viewer') {
      db.run(
        'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 0, 0, 0)',
        [memberId]
      );
    }
    // Для member создаём базовые права
    else if (role === 'member') {
      db.run(
        'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 1, 1, 0)',
        [memberId]
      );
    }

    saveDb();

    const result = db.exec(`
      SELECT pm.*, u.email, u.name
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.id = ?
    `, [memberId]);

    res.status(201).json(rowsToObjects(result)[0]);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'User is already a member' });
    }
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Создать пользователя и добавить в проект
router.post('/:projectId/members/create', loadProjectMember, requireProjectRole('owner', 'admin'), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { email, name, password, role = 'member' } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name and password are required' });
  }

  // Проверяем, что роль валидна
  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = db.exec('SELECT id FROM users WHERE email = ?', [email]);
    let userId: number;

    if (rowsToObjects(existingUser).length > 0) {
      // Пользователь уже существует — просто добавим в проект
      userId = rowsToObjects(existingUser)[0].id;
      
      // Проверяем, не является ли уже участником
      const existingMember = db.exec(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, userId]
      );
      if (rowsToObjects(existingMember).length > 0) {
        return res.status(400).json({ error: 'Пользователь уже в проекте' });
      }
    } else {
      // Создаём нового пользователя
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name]
      );
      const userResult = db.exec('SELECT last_insert_rowid() as id')[0];
      userId = userResult.values[0][0] as number;
    }

    // Добавляем в проект
    db.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, userId, role]
    );
    
    const memberResult = db.exec('SELECT last_insert_rowid() as id')[0];
    const memberId = memberResult.values[0][0] as number;

    // Создаём права в зависимости от роли
    if (role === 'viewer') {
      db.run(
        'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 0, 0, 0)',
        [memberId]
      );
    } else if (role === 'member') {
      db.run(
        'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 1, 1, 0)',
        [memberId]
      );
    }

    saveDb();

    const result = db.exec(`
      SELECT pm.*, u.email, u.name
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.id = ?
    `, [memberId]);

    res.status(201).json(rowsToObjects(result)[0]);
  } catch (error: any) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Обновить роль участника
router.patch('/:projectId/members/:memberId', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId, memberId } = req.params;
  const { role } = req.body;

  // Проверяем, что участник существует
  const memberResult = db.exec(
    'SELECT * FROM project_members WHERE id = ? AND project_id = ?',
    [memberId, projectId]
  );
  const member = rowsToObjects(memberResult)[0];

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Нельзя изменить роль owner
  if (member.role === 'owner') {
    return res.status(400).json({ error: 'Cannot change owner role' });
  }

  // Нельзя назначить owner
  if (role === 'owner') {
    return res.status(400).json({ error: 'Cannot assign owner role' });
  }

  // Admin не может менять роль другого admin
  if (req.projectMember!.role === 'admin' && member.role === 'admin') {
    return res.status(403).json({ error: 'Admin cannot change another admin role' });
  }

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.run('UPDATE project_members SET role = ? WHERE id = ?', [role, memberId]);
  
  // Обновляем права в зависимости от роли
  db.run('DELETE FROM permissions WHERE project_member_id = ?', [memberId]);
  
  if (role === 'viewer') {
    db.run(
      'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 0, 0, 0)',
      [memberId]
    );
  } else if (role === 'member') {
    db.run(
      'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 1, 1, 0)',
      [memberId]
    );
  }
  
  saveDb();

  const result = db.exec(`
    SELECT pm.*, u.email, u.name
    FROM project_members pm
    INNER JOIN users u ON pm.user_id = u.id
    WHERE pm.id = ?
  `, [memberId]);

  res.json(rowsToObjects(result)[0]);
});

// Удалить участника
router.delete('/:projectId/members/:memberId', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId, memberId } = req.params;

  // Проверяем, что участник существует
  const memberResult = db.exec(
    'SELECT * FROM project_members WHERE id = ? AND project_id = ?',
    [memberId, projectId]
  );
  const member = rowsToObjects(memberResult)[0];

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Нельзя удалить owner
  if (member.role === 'owner') {
    return res.status(400).json({ error: 'Cannot remove project owner' });
  }

  // Admin не может удалить другого admin
  if (req.projectMember!.role === 'admin' && member.role === 'admin') {
    return res.status(403).json({ error: 'Admin cannot remove another admin' });
  }

  db.run('DELETE FROM project_members WHERE id = ?', [memberId]);
  saveDb();

  res.status(204).send();
});

// ============================================
// ПРАВА УЧАСТНИКА
// ============================================

// Получить права участника
router.get('/:projectId/members/:memberId/permissions', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { memberId } = req.params;

  const result = db.exec(`
    SELECT p.*, s.title as status_title, s.slug as status_slug
    FROM permissions p
    LEFT JOIN statuses s ON p.status_id = s.id
    WHERE p.project_member_id = ?
  `, [memberId]);

  const permissions = rowsToObjects(result);
  res.json(permissions);
});

// Установить права участника
router.put('/:projectId/members/:memberId/permissions', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId, memberId } = req.params;
  const { permissions } = req.body;

  // Проверяем, что участник существует и это не owner/admin
  const memberResult = db.exec(
    'SELECT * FROM project_members WHERE id = ? AND project_id = ?',
    [memberId, projectId]
  );
  const member = rowsToObjects(memberResult)[0];

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  if (member.role === 'owner' || member.role === 'admin') {
    return res.status(400).json({ error: 'Cannot set permissions for owner or admin' });
  }

  // Удаляем старые права
  db.run('DELETE FROM permissions WHERE project_member_id = ?', [memberId]);

  // Добавляем новые права
  if (Array.isArray(permissions)) {
    permissions.forEach((perm: any) => {
      db.run(
        'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)',
        [memberId, perm.status_id || null, perm.can_read ? 1 : 0, perm.can_create ? 1 : 0, perm.can_edit ? 1 : 0, perm.can_delete ? 1 : 0]
      );
    });
  }

  saveDb();

  const result = db.exec(`
    SELECT p.*, s.title as status_title
    FROM permissions p
    LEFT JOIN statuses s ON p.status_id = s.id
    WHERE p.project_member_id = ?
  `, [memberId]);

  res.json(rowsToObjects(result));
});

// ============================================
// ПРИГЛАШЕНИЯ В ПРОЕКТ
// ============================================

// Генерация случайного кода
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Получить все приглашения проекта
router.get('/:projectId/invites', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId } = req.params;

  const result = db.exec(`
    SELECT i.*, u.name as creator_name
    FROM project_invites i
    LEFT JOIN users u ON i.created_by = u.id
    WHERE i.project_id = ?
    ORDER BY i.created_at DESC
  `, [projectId]);

  res.json(rowsToObjects(result));
});

// Создать приглашение
router.post('/:projectId/invites', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { role = 'member', max_uses, expires_in_hours } = req.body;
  const userId = req.user!.id;

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Admin не может создавать приглашения для admin
  if (req.projectMember!.role === 'admin' && role === 'admin') {
    return res.status(403).json({ error: 'Admin cannot create admin invites' });
  }

  const code = generateInviteCode();
  const expiresAt = expires_in_hours 
    ? new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString()
    : null;

  db.run(
    'INSERT INTO project_invites (project_id, code, role, max_uses, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, code, role, max_uses || null, expiresAt, userId]
  );
  saveDb();

  const result = db.exec('SELECT * FROM project_invites WHERE code = ?', [code]);
  res.status(201).json(rowsToObjects(result)[0]);
});

// Удалить приглашение
router.delete('/:projectId/invites/:inviteId', loadProjectMember, requireProjectRole('owner', 'admin'), (req: AuthRequest, res) => {
  const { projectId, inviteId } = req.params;

  db.run('DELETE FROM project_invites WHERE id = ? AND project_id = ?', [inviteId, projectId]);
  saveDb();

  res.status(204).send();
});

// Использовать приглашение (присоединиться к проекту)
router.post('/join/:code', (req: AuthRequest, res) => {
  const { code } = req.params;
  const userId = req.user!.id;

  // Находим приглашение
  const inviteResult = db.exec(`
    SELECT i.*, p.name as project_name
    FROM project_invites i
    INNER JOIN projects p ON i.project_id = p.id
    WHERE i.code = ?
  `, [code]);
  const invite = rowsToObjects(inviteResult)[0];

  if (!invite) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }

  // Проверяем срок действия
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Срок действия приглашения истёк' });
  }

  // Проверяем лимит использований
  if (invite.max_uses && invite.uses >= invite.max_uses) {
    return res.status(400).json({ error: 'Лимит использований приглашения исчерпан' });
  }

  // Проверяем, не является ли пользователь уже участником
  const existingMember = db.exec(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
    [invite.project_id, userId]
  );
  if (rowsToObjects(existingMember).length > 0) {
    return res.status(400).json({ error: 'Вы уже являетесь участником этого проекта' });
  }

  // Добавляем пользователя в проект
  db.run(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
    [invite.project_id, userId, invite.role]
  );

  const memberResult = db.exec('SELECT last_insert_rowid() as id')[0];
  const memberId = memberResult.values[0][0] as number;

  // Создаём права по умолчанию
  if (invite.role === 'viewer') {
    db.run(
      'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 0, 0, 0)',
      [memberId]
    );
  } else if (invite.role === 'member') {
    db.run(
      'INSERT INTO permissions (project_member_id, status_id, can_read, can_create, can_edit, can_delete) VALUES (?, NULL, 1, 1, 1, 0)',
      [memberId]
    );
  }

  // Увеличиваем счётчик использований
  db.run('UPDATE project_invites SET uses = uses + 1 WHERE id = ?', [invite.id]);
  saveDb();

  res.json({ 
    message: 'Вы успешно присоединились к проекту',
    project_id: invite.project_id,
    project_name: invite.project_name,
    role: invite.role
  });
});

// Получить информацию о приглашении (без авторизации для превью)
router.get('/invite-info/:code', (req, res) => {
  const { code } = req.params;

  const result = db.exec(`
    SELECT i.role, i.expires_at, i.max_uses, i.uses, p.name as project_name, p.description as project_description
    FROM project_invites i
    INNER JOIN projects p ON i.project_id = p.id
    WHERE i.code = ?
  `, [code]);
  const invite = rowsToObjects(result)[0];

  if (!invite) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }

  // Проверяем валидность
  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const isExhausted = invite.max_uses && invite.uses >= invite.max_uses;

  res.json({
    project_name: invite.project_name,
    project_description: invite.project_description,
    role: invite.role,
    is_valid: !isExpired && !isExhausted,
    expires_at: invite.expires_at
  });
});

export default router;
