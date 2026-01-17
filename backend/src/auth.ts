import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { saveDb, rowsToObjects } from './db.js';
import { authMiddleware, AuthRequest, globalAdminOnly } from './middleware.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ============================================
// РЕГИСТРАЦИЯ
// ============================================

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password and name are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Первый пользователь становится глобальным админом
    const usersCount = db.exec('SELECT COUNT(*) as count FROM users')[0];
    const isFirstUser = usersCount.values[0][0] === 0;
    
    db.run(
      'INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, isFirstUser ? 1 : 0]
    );
    saveDb();

    const result = db.exec('SELECT last_insert_rowid() as id')[0];
    const id = result.values[0][0];

    res.status(201).json({ 
      id, 
      email, 
      name, 
      is_admin: isFirstUser 
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ВХОД
// ============================================

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = db.exec('SELECT * FROM users WHERE email = ?', [email]);
  const user = rowsToObjects(result)[0];
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, is_admin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: !!user.is_admin
    }
  });
});

// ============================================
// ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
// ============================================

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  const result = db.exec('SELECT id, email, name, is_admin FROM users WHERE id = ?', [req.user!.id]);
  const user = rowsToObjects(result)[0];
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    ...user,
    is_admin: !!user.is_admin
  });
});

// ============================================
// СПИСОК ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (для приглашений)
// ============================================

router.get('/users', authMiddleware, (req: AuthRequest, res) => {
  const result = db.exec('SELECT id, email, name, is_admin FROM users ORDER BY name');
  const users = rowsToObjects(result).map(u => ({
    ...u,
    is_admin: !!u.is_admin
  }));
  res.json(users);
});

// ============================================
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только глобальный админ)
// ============================================

router.patch('/users/:id', authMiddleware, globalAdminOnly, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, is_admin, password } = req.body;

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (is_admin !== undefined) {
    updates.push('is_admin = ?');
    values.push(is_admin ? 1 : 0);
  }
  if (password) {
    updates.push('password = ?');
    values.push(await bcrypt.hash(password, 10));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDb();

  const result = db.exec('SELECT id, email, name, is_admin FROM users WHERE id = ?', [id]);
  const user = rowsToObjects(result)[0];
  res.json({ ...user, is_admin: !!user.is_admin });
});

router.delete('/users/:id', authMiddleware, globalAdminOnly, (req: AuthRequest, res) => {
  const { id } = req.params;
  
  // Нельзя удалить себя
  if (parseInt(id) === req.user!.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  db.run('DELETE FROM users WHERE id = ?', [id]);
  saveDb();
  res.status(204).send();
});

export default router;
