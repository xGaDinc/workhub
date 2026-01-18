import express from 'express';
import { Task, ProjectMember } from './db.js';
import { authMiddleware, AuthRequest } from './middleware.js';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  const { q, projectId } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    let projectIds: mongoose.Types.ObjectId[] = [];

    if (projectId) {
      projectIds = [new mongoose.Types.ObjectId(projectId as string)];
    } else {
      // Поиск по всем проектам пользователя
      const memberships = await ProjectMember.find({ 
        user_id: new mongoose.Types.ObjectId(req.user!.id) 
      });
      projectIds = memberships.map(m => m.project_id);
    }

    const tasks = await Task.find({
      $text: { $search: q },
      project_id: { $in: projectIds }
    })
    .populate('status_id', 'title slug')
    .populate('created_by', 'name')
    .limit(20)
    .sort({ score: { $meta: 'textScore' } });

    const result = tasks.map(task => {
      const status = task.status_id as any;
      const creator = task.created_by as any;
      return {
        id: task._id,
        project_id: task.project_id,
        title: task.title,
        description: task.description,
        status_title: status.title,
        status_slug: status.slug,
        creator_name: creator.name,
        created_at: task.created_at
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
