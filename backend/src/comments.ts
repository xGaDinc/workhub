import express from 'express';
import { Comment } from './db.js';
import { authMiddleware, AuthRequest } from './middleware.js';
import mongoose from 'mongoose';

const router = express.Router();

// Получить все комментарии задачи
router.get('/:id/comments', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const comments = await Comment.find({ task_id: new mongoose.Types.ObjectId(id) })
      .populate('user_id', 'name email')
      .sort({ created_at: 1 });

    const result = comments.map(c => {
      const user = c.user_id as any;
      return {
        id: c._id,
        task_id: c.task_id,
        user_id: user._id,
        user_name: user.name,
        text: c.text,
        created_at: c.created_at,
        updated_at: c.updated_at
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать комментарий
router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const comment = await Comment.create({
      task_id: new mongoose.Types.ObjectId(id),
      user_id: new mongoose.Types.ObjectId(req.user!.id),
      text: text.trim()
    });

    const populated = await Comment.findById(comment._id).populate('user_id', 'name email');
    const user = populated!.user_id as any;

    res.status(201).json({
      id: populated!._id,
      task_id: populated!.task_id,
      user_id: user._id,
      user_name: user.name,
      text: populated!.text,
      created_at: populated!.created_at,
      updated_at: populated!.updated_at
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Редактировать комментарий
router.patch('/comments/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const comment = await Comment.findById(id);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user_id.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Not your comment' });
    }

    comment.text = text.trim();
    comment.updated_at = new Date();
    await comment.save();

    const populated = await Comment.findById(id).populate('user_id', 'name email');
    const user = populated!.user_id as any;

    res.json({
      id: populated!._id,
      task_id: populated!.task_id,
      user_id: user._id,
      user_name: user.name,
      text: populated!.text,
      created_at: populated!.created_at,
      updated_at: populated!.updated_at
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Удалить комментарий
router.delete('/comments/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const comment = await Comment.findById(id);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user_id.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Not your comment' });
    }

    await Comment.findByIdAndDelete(id);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
