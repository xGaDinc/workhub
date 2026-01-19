import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from './db.js';
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
    const usersCount = await User.countDocuments();
    const isFirstUser = usersCount === 0;
    
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      is_admin: isFirstUser
    });

    res.status(201).json({ 
      id: user._id, 
      email: user.email, 
      name: user.name, 
      is_admin: user.is_admin 
    });
  } catch (error: any) {
    if (error.code === 11000) {
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

  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
// ============================================

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      telegram_id: user.telegram_id
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ОБНОВИТЬ СВОЙ ПРОФИЛЬ
// ============================================

router.patch('/me', authMiddleware, async (req: AuthRequest, res) => {
  const { name, telegram_id } = req.body;

  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (telegram_id !== undefined) updateData.telegram_id = telegram_id;

    const user = await User.findByIdAndUpdate(req.user!.id, updateData, { new: true }).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      telegram_id: user.telegram_id
    });
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// СПИСОК ПОЛЬЗОВАТЕЛЕЙ
// ============================================

router.get('/users', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await User.find().select('-password').sort({ created_at: -1 });
    
    res.json(users.map(u => ({
      id: u._id,
      email: u.email,
      name: u.name,
      is_admin: u.is_admin,
      created_at: u.created_at
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ОБНОВИТЬ ПОЛЬЗОВАТЕЛЯ (только глобальный админ)
// ============================================

router.patch('/users/:id', authMiddleware, globalAdminOnly, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, email, is_admin } = req.body;

  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (is_admin !== undefined) updateData.is_admin = is_admin;

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// УДАЛИТЬ ПОЛЬЗОВАТЕЛЯ (только глобальный админ)
// ============================================

router.delete('/users/:id', authMiddleware, globalAdminOnly, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
