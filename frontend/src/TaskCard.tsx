import { useDraggable } from '@dnd-kit/core';
import { Task } from './types';

interface TaskCardProps {
  task: Task;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  permissions: {
    can_read: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
}

export default function TaskCard({ task, onDelete, onEdit, onView, permissions }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !permissions.can_edit,
  });

  const priorityColors = {
    low: 'border-l-green-500',
    medium: 'border-l-yellow-500',
    high: 'border-l-red-500',
  };

  // Скрываем оригинал при перетаскивании
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="bg-slate-800/30 p-3 rounded-xl border-l-4 border-l-transparent border border-dashed border-amber-500/30 opacity-50"
        style={{ height: 'auto', minHeight: '60px' }}
      >
        <div className="invisible">
          <h4 className="font-medium text-white text-sm">{task.title}</h4>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...(permissions.can_edit ? { ...attributes, ...listeners } : {})}
      className={`bg-slate-800/50 p-3 rounded-xl border-l-4 ${priorityColors[task.priority]} border border-white/10 hover:border-amber-500/30 transition-all group ${permissions.can_edit ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onClick={() => onView(task)}
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-medium text-white text-sm flex-1">{task.title}</h4>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {permissions.can_edit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {permissions.can_delete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="w-6 h-6 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-amber-200/50 mt-1 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
          task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
        </span>

        {task.assigned_name && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {task.assigned_name}
          </span>
        )}

        {task.due_date && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
