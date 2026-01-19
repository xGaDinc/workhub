import express from 'express';
import multer from 'multer';
import path from 'path';
import { Task } from './db.js';
import { authMiddleware, AuthRequest } from './middleware.js';
import mongoose from 'mongoose';
import { unlink } from 'fs/promises';

const router = express.Router();

// Настройка multer
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  }
});

// Загрузка файла к задаче
router.post('/:id/attachments', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  try {
    const task = await Task.findById(id);
    
    if (!task) {
      // Удаляем загруженный файл если задача не найдена
      await unlink(req.file.path);
      return res.status(404).json({ error: 'Task not found' });
    }

    const attachment = {
      filename: req.file.filename,
      original_name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      uploaded_at: new Date()
    };

    task.attachments.push(attachment);
    await task.save();

    res.status(201).json(attachment);
  } catch (error) {
    console.error('Upload attachment error:', error);
    // Удаляем файл при ошибке
    if (req.file) {
      await unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Удаление вложения
router.delete('/:id/attachments/:attachmentId', authMiddleware, async (req: AuthRequest, res) => {
  const { id, attachmentId } = req.params;

  try {
    const task = await Task.findById(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const attachment = task.attachments.find((a: any) => a._id?.toString() === attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Удаляем файл с диска
    const filePath = path.join('uploads', attachment.filename);
    await unlink(filePath).catch(() => {});

    // Удаляем из БД
    task.attachments = task.attachments.filter((a: any) => a._id?.toString() !== attachmentId);
    await task.save();

    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
