import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from './TaskCard';
import { Task, Status } from './types';

interface ColumnProps {
  status: Status;
  tasks: Task[];
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onEditColumn: (column: Status) => void;
  onDeleteColumn: (id: number) => void;
  canManage: boolean;
  isDragging?: boolean;
}

export default function Column({ status, tasks, onDelete, onEdit, onView, onEditColumn, onDeleteColumn, canManage, isDragging }: ColumnProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: status.id });
  
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: `column-${status.id}`,
    disabled: !canManage,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Combine refs
  const setRefs = (node: HTMLDivElement | null) => {
    setDroppableRef(node);
    setSortableRef(node);
  };

  // Helper to darken hex color for gradient
  const adjustColor = (hex: string, amount: number): string => {
    if (!hex.startsWith('#')) return hex;
    let color = hex.slice(1);
    if (color.length === 3) {
      color = color.split('').map(c => c + c).join('');
    }
    const num = parseInt(color, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  // Determine header style - support both old Tailwind format and new hex format
  const getHeaderStyle = () => {
    if (status.color.startsWith('#')) {
      return { background: `linear-gradient(to right, ${status.color}, ${adjustColor(status.color, -20)})` };
    }
    return {};
  };

  const headerClassName = status.color.startsWith('#') 
    ? '' 
    : `bg-gradient-to-r ${status.color}`;

  return (
    <div
      ref={setRefs}
      style={style}
      className={`bg-slate-900/80 rounded-2xl border transition-all ${
        isOver ? 'border-amber-500/50 bg-amber-900/30' : 'border-white/10'
      } ${isSortableDragging || isDragging ? 'opacity-50 scale-[0.98]' : ''}`}
    >
      {/* Header - draggable handle */}
      <div 
        className={`p-4 border-b border-white/10 rounded-t-2xl ${headerClassName} ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={getHeaderStyle()}
        {...(canManage ? { ...attributes, ...listeners } : {})}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{status.icon}</span>
            <h3 className="font-semibold text-white">{status.title}</h3>
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white/80">{tasks.length}</span>
          </div>
          {canManage && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEditColumn(status)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button onClick={() => onDeleteColumn(status.id)}
                className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="p-3 space-y-2 min-h-[200px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDelete={onDelete}
            onEdit={onEdit}
            onView={onView}
            permissions={status.permissions}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-amber-200/40 text-sm">
            Нет задач
          </div>
        )}
      </div>
    </div>
  );
}
