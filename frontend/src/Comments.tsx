import { useState, useEffect } from 'react';
import { tasks as tasksApi } from './api';
import toast from 'react-hot-toast';
import { Comment } from './types';

interface CommentsProps {
  taskId: string;
  currentUserId: string;
}

export default function Comments({ taskId, currentUserId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    try {
      const { data } = await tasksApi.getComments(taskId);
      setComments(data);
    } catch (error) {
      console.error('Load comments error:', error);
    }
  };

  const handleCreate = async () => {
    if (!newComment.trim()) return;
    try {
      await tasksApi.createComment(taskId, newComment);
      setNewComment('');
      loadComments();
      toast.success('Комментарий добавлен');
    } catch (error) {
      toast.error('Ошибка добавления');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editText.trim()) return;
    try {
      await tasksApi.updateComment(id, editText);
      setEditingId(null);
      loadComments();
      toast.success('Комментарий обновлен');
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.deleteComment(id);
      loadComments();
      toast.success('Комментарий удален');
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-200">Комментарии</span>
        {comments.length > 0 && (
          <span className="text-xs text-amber-200/60">{comments.length}</span>
        )}
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400">
                  {comment.user_name[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-amber-200">{comment.user_name}</span>
                <span className="text-xs text-amber-200/40">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
              </div>
              {comment.user_id === currentUserId && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditText(comment.text);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {editingId === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-lg text-sm text-white resize-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(comment.id)}
                    className="px-3 py-1 bg-amber-500 text-slate-900 rounded text-xs font-medium"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 bg-slate-700 text-amber-200 rounded text-xs"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white whitespace-pre-wrap">{comment.text}</p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Написать комментарий..."
            className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-white placeholder-amber-200/30 resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleCreate();
              }
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!newComment.trim()}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Отправить
          </button>
        </div>
    </div>
  );
}
