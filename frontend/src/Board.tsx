import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { tasks as tasksApi, statuses as statusesApi, search as searchApi, auth as authApi } from './api';
import Column from './Column';
import ProjectSettings from './ProjectSettings';
import Checklist from './Checklist';
import Attachments from './Attachments';
import Comments from './Comments';
import { User, Project, Task, Status, PRIORITY_LABELS, ROLE_LABELS } from './types';

interface BoardProps {
  user: User;
  project: Project;
  onLogout: () => void;
  onBack: () => void;
}

// Фигуры для анимированного фона
const SHAPES = [
  { x: 10, y: 10, size: 120, type: 'circle', delay: 0 },
  { x: 80, y: 20, size: 100, type: 'square', delay: -5 },
  { x: 25, y: 60, size: 80, type: 'triangle', delay: -10 },
  { x: 50, y: 50, size: 90, type: 'diamond', delay: -15 },
  { x: 75, y: 75, size: 110, type: 'circle', delay: -20 },
  { x: 15, y: 85, size: 70, type: 'square', delay: -25 },
  { x: 60, y: 15, size: 95, type: 'triangle', delay: -30 },
  { x: 35, y: 35, size: 85, type: 'diamond', delay: -35 },
  { x: 90, y: 45, size: 75, type: 'circle', delay: -40 },
  { x: 5, y: 40, size: 100, type: 'square', delay: -45 },
  { x: 70, y: 90, size: 80, type: 'triangle', delay: -50 },
  { x: 45, y: 80, size: 90, type: 'diamond', delay: -55 },
  { x: 20, y: 30, size: 60, type: 'dollar', delay: -60 },
  { x: 85, y: 60, size: 65, type: 'ruble', delay: -65 },
  { x: 40, y: 70, size: 70, type: 'bitcoin', delay: -70 },
  { x: 65, y: 25, size: 55, type: 'usdt', delay: -75 },
];

export default function Board({ user, project, onLogout, onBack }: BoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', status_id: '', checklist: [] as { text: string; completed: boolean }[] });
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [editingColumn, setEditingColumn] = useState<Status | null>(null);
  const [newColumn, setNewColumn] = useState({ title: '', color: '#475569', icon: '📌' });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<Status | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [showColumnOrder, setShowColumnOrder] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showProfile, setShowProfile] = useState(false);
  const [telegramId, setTelegramId] = useState(user.telegram_id || '');

  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Анимированный фон
  const mousePosRef = useRef({ x: 0, y: 0 });
  const velocitiesRef = useRef<{[key: number]: {x: number, y: number, vx: number, vy: number}}>({});
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    let frameId: number;
    const animate = () => {
      SHAPES.forEach((shape, index) => {
        if (!velocitiesRef.current[index]) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.3 + Math.random() * 0.4;
          velocitiesRef.current[index] = { 
            x: (window.innerWidth * shape.x) / 100, 
            y: (window.innerHeight * shape.y) / 100, 
            vx: Math.cos(angle) * speed, 
            vy: Math.sin(angle) * speed 
          };
        }
        const vel = velocitiesRef.current[index];
        const dx = mousePosRef.current.x - vel.x;
        const dy = mousePosRef.current.y - vel.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 150 && distance > 0) {
          const force = Math.pow((150 - distance) / 150, 2) * 12;
          vel.vx -= (dx / distance) * force;
          vel.vy -= (dy / distance) * force;
        }
        vel.vx *= 0.995;
        vel.vy *= 0.995;
        const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
        if (speed < 0.3) {
          const angle = Math.atan2(vel.vy, vel.vx);
          vel.vx = Math.cos(angle) * 0.3;
          vel.vy = Math.sin(angle) * 0.3;
        }
        if (speed > 8) {
          vel.vx = (vel.vx / speed) * 8;
          vel.vy = (vel.vy / speed) * 8;
        }
        vel.x += vel.vx;
        vel.y += vel.vy;
        const padding = shape.size;
        if (vel.x < -padding) vel.x = window.innerWidth + padding;
        if (vel.x > window.innerWidth + padding) vel.x = -padding;
        if (vel.y < -padding) vel.y = window.innerHeight + padding;
        if (vel.y > window.innerHeight + padding) vel.y = -padding;
      });
      forceUpdate({});
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowFilters(false);
      setShowSort(false);
    };
    if (showFilters || showSort) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showFilters, showSort]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const canManageProject = project.my_role === 'owner' || project.my_role === 'admin';

  useEffect(() => {
    loadData();
  }, [project.id]);

  const loadData = async () => {
    try {
      const [tasksRes, statusesRes, usersRes] = await Promise.all([
        tasksApi.getAll(project.id),
        statusesApi.getAll(project.id),
        tasksApi.getUsers(project.id)
      ]);
      setTasks(tasksRes.data);
      setStatuses(statusesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = String(active.id);
    
    // Check if dragging a column (column ids start with 'column-')
    if (activeId.startsWith('column-')) {
      const columnId = activeId.replace('column-', '');
      const column = statuses.find(s => s.id === columnId);
      if (column && canManageProject) {
        setActiveColumn(column);
      }
    } else {
      // Dragging a task
      const task = tasks.find(t => t.id === activeId);
      if (task) setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Reset active states
    const wasColumn = activeColumn !== null;
    setActiveTask(null);
    setActiveColumn(null);
    
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    console.log('Drag end:', { activeId, overId, wasColumn });

    // Handle column reordering
    if (wasColumn && activeId.startsWith('column-')) {
      const activeColumnId = activeId.replace('column-', '');
      let overColumnId: string;
      
      // Over может быть либо column-X, либо просто ID (droppable зона)
      if (overId.startsWith('column-')) {
        overColumnId = overId.replace('column-', '');
      } else {
        overColumnId = overId;
      }
      
      console.log('Column reorder:', { activeColumnId, overColumnId });
      
      if (activeColumnId !== overColumnId) {
        const oldIndex = statuses.findIndex(s => s.id === activeColumnId);
        const newIndex = statuses.findIndex(s => s.id === overColumnId);
        
        console.log('Indexes:', { oldIndex, newIndex });
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newStatuses = arrayMove(statuses, oldIndex, newIndex);
          setStatuses(newStatuses);
          
          try {
            const statusList = newStatuses.map((s, idx) => ({ id: s.id, position: idx }));
            await statusesApi.reorder(project.id, statusList);
          } catch (error) {
            toast.error('Ошибка перемещения столбца');
            loadData();
          }
        }
      }
      return;
    }

    // Handle task moving
    const taskId = activeId;
    let newStatusId: string;
    
    if (overId.startsWith('column-')) {
      newStatusId = overId.replace('column-', '');
    } else {
      newStatusId = overId;
    }
    
    const task = tasks.find(t => t.id === taskId);
    
    if (!task || task.status_id === newStatusId) return;

    const targetStatus = statuses.find(s => s.id === newStatusId);
    if (!targetStatus) return;

    if (!targetStatus.permissions.can_create && !canManageProject) {
      toast.error('Нет прав на перемещение в этот статус');
      return;
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status_id: newStatusId } : t));

    try {
      await tasksApi.update(taskId, { status_id: newStatusId });
      toast.success('Задача перемещена');
    } catch (error) {
      toast.error('Ошибка перемещения');
      loadData();
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const taskData = {
        ...newTask,
        assigned_to: newTask.assigned_to || null,
        status_id: newTask.status_id || undefined,
      };
      if (editingTask) {
        await tasksApi.update(editingTask.id, taskData);
        toast.success('Задача обновлена');
      } else {
        await tasksApi.create(project.id, taskData);
        toast.success('Задача создана');
      }
      setHasUnsavedChanges(false);
      closeTaskModal();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleChecklistChange = async (checklist: any[]) => {
    setNewTask({ ...newTask, checklist });
    
    // Автосохранение в режиме просмотра
    if (editingTask && !isEditMode) {
      try {
        await tasksApi.update(editingTask.id, { checklist });
        loadData();
      } catch (error) {
        toast.error('Ошибка сохранения чеклиста');
      }
    } else {
      setHasUnsavedChanges(true);
    }
  };

  const closeTaskModal = () => {
    if (hasUnsavedChanges && isEditMode) {
      setShowConfirmClose(true);
      return;
    }
    setShowModal(false);
    setEditingTask(null);
    setNewTask({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', status_id: '', checklist: [] });
    setHasUnsavedChanges(false);
  };

  const forceCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
    setNewTask({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', status_id: '', checklist: [] });
    setHasUnsavedChanges(false);
    setShowConfirmClose(false);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      status_id: task.status_id,
      checklist: task.checklist || []
    });
    setIsEditMode(false); // Открываем в режиме просмотра
    setShowModal(true);
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await tasksApi.delete(id);
      toast.success('Задача удалена');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const handleSaveColumn = async () => {
    try {
      if (editingColumn) {
        await statusesApi.update(editingColumn.id, newColumn);
        toast.success('Столбец обновлён');
      } else {
        await statusesApi.create(project.id, newColumn);
        toast.success('Столбец создан');
      }
      setShowColumnModal(false);
      setEditingColumn(null);
      setNewColumn({ title: '', color: '#475569', icon: '📌' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleEditColumn = (column: Status) => {
    setEditingColumn(column);
    setNewColumn({ title: column.title, color: column.color, icon: column.icon });
    setShowColumnModal(true);
  };

  const handleDeleteColumn = async (id: string) => {
    if (statuses.length <= 1) {
      toast.error('Должен остаться хотя бы один столбец');
      return;
    }
    try {
      await statusesApi.delete(id);
      toast.success('Столбец удалён');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const getFilteredTasks = (statusId: string) => {
    let filtered = tasks.filter(t => t.status_id === statusId);
    if (filterPriority !== 'all') filtered = filtered.filter(t => t.priority === filterPriority);
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned') filtered = filtered.filter(t => !t.assigned_to);
      else filtered = filtered.filter(t => t.assigned_to === filterAssignee);
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return filtered;
  };

  const canCreateAnyTask = statuses.some(s => s.permissions.can_create) || canManageProject;

  // Helper to darken/lighten hex color for gradient
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

  const renderShape = (shape: any, index: number) => {
    const vel = velocitiesRef.current[index];
    if (!vel) return null;
    return (
      <div key={index} className="absolute" style={{ left: vel.x, top: vel.y, transform: 'translate(-50%, -50%)' }}>
        <svg width={shape.size} height={shape.size} viewBox={`0 0 ${shape.size} ${shape.size}`}>
          {shape.type === 'circle' && (
            <>
              <circle cx={shape.size/2} cy={shape.size/2} r={shape.size*0.35} fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.3"/>
              <circle cx={shape.size/2} cy={shape.size/2} r={shape.size*0.15} fill="#ffd700" opacity="0.2"/>
            </>
          )}
          {shape.type === 'square' && (
            <rect x={shape.size*0.2} y={shape.size*0.2} width={shape.size*0.6} height={shape.size*0.6} fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.3" rx="8"/>
          )}
          {shape.type === 'triangle' && (
            <polygon points={`${shape.size/2},${shape.size*0.15} ${shape.size*0.85},${shape.size*0.85} ${shape.size*0.15},${shape.size*0.85}`} fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.3"/>
          )}
          {shape.type === 'diamond' && (
            <path d={`M${shape.size/2} ${shape.size*0.1} L${shape.size*0.9} ${shape.size/2} L${shape.size/2} ${shape.size*0.9} L${shape.size*0.1} ${shape.size/2} Z`} fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.3"/>
          )}
          {shape.type === 'dollar' && <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={shape.size*0.6} fill="#ffd700" opacity="0.4" fontWeight="bold">$</text>}
          {shape.type === 'ruble' && <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={shape.size*0.6} fill="#ffd700" opacity="0.4" fontWeight="bold">₽</text>}
          {shape.type === 'bitcoin' && <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={shape.size*0.6} fill="#ffd700" opacity="0.4" fontWeight="bold">₿</text>}
          {shape.type === 'usdt' && <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={shape.size*0.4} fill="#ffd700" opacity="0.4" fontWeight="bold">USDT</text>}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950"></div>
      
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {SHAPES.map((shape, index) => renderShape(shape, index))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button onClick={onBack} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/5 hover:bg-white/10 text-amber-300 transition-all flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-white truncate">{project.name}</h1>
                {project.description && <p className="text-xs md:text-sm text-amber-200/60 truncate hidden sm:block">{project.description}</p>}
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3">
              {/* Filters */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setShowFilters(!showFilters); setShowSort(false); }}
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${showFilters ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-amber-300/70 hover:bg-white/10'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
                {showFilters && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 border border-white/10 rounded-2xl p-4 shadow-xl z-50">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-amber-300/80 mb-1">Приоритет</label>
                        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-slate-800 border border-white/10 rounded-xl text-amber-100">
                          <option value="all">Все</option>
                          <option value="high">🔴 Высокий</option>
                          <option value="medium">🟡 Средний</option>
                          <option value="low">🟢 Низкий</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-amber-300/80 mb-1">Исполнитель</label>
                        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-slate-800 border border-white/10 rounded-xl text-amber-100">
                          <option value="all">Все</option>
                          <option value="unassigned">Не назначено</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setShowSort(!showSort); setShowFilters(false); }}
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${showSort ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-amber-300/70 hover:bg-white/10'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </button>
                {showSort && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900/95 border border-white/10 rounded-2xl p-2 shadow-xl z-50">
                    {[{ value: 'created_at', label: '📅 По дате' }, { value: 'due_date', label: '⏰ По дедлайну' }, { value: 'priority', label: '🎯 По приоритету' }].map(opt => (
                      <button key={opt.value} onClick={() => { setSortBy(opt.value); setShowSort(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm ${sortBy === opt.value ? 'bg-amber-500/20 text-amber-300' : 'text-amber-100/70 hover:bg-white/5'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Toggle */}
              <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
                <button onClick={() => setViewMode('kanban')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${viewMode === 'kanban' ? 'bg-amber-500/20 text-amber-400' : 'text-amber-200/60 hover:text-amber-200'}`} title="Канбан">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                </button>
                <button onClick={() => setViewMode('list')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-amber-500/20 text-amber-400' : 'text-amber-200/60 hover:text-amber-200'}`} title="Список">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </button>
              </div>

              {canManageProject && (
                <button onClick={() => setShowSettings(true)} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/5 text-amber-300/70 hover:bg-white/10 hover:text-amber-300 transition-all flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
              <div onClick={() => setShowProfile(true)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-white">{user.name[0].toUpperCase()}</div>
                <span className="text-sm text-amber-100/90 hidden md:inline">{user.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 hidden lg:inline">{ROLE_LABELS[project.my_role]}</span>
              </div>
              <button onClick={onLogout} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 md:px-4 pb-4 relative z-10">
        <div className="flex flex-wrap gap-2 md:gap-3 mb-4">
          {canCreateAnyTask && (
            <button onClick={() => {
              const defaultStatus = statuses.find(s => s.permissions.can_create || canManageProject);
              setNewTask({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', status_id: defaultStatus?.id || '', checklist: [] });
              setEditingTask(null);
              setIsEditMode(true); // Создание новой задачи - режим редактирования
              setShowModal(true);
            }} className="px-5 py-2.5 text-sm bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 rounded-2xl font-bold hover:from-amber-600 hover:to-yellow-700 transition-all shadow-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">Создать задачу</span>
              <span className="sm:hidden">Создать</span>
            </button>
          )}
          {canManageProject && viewMode === 'kanban' && (
            <button onClick={() => setShowColumnModal(true)} className="px-3 md:px-5 py-2 md:py-2.5 text-sm bg-white/5 text-amber-200 rounded-2xl font-semibold hover:bg-white/10 transition-all flex items-center gap-2 border border-amber-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
              <span className="hidden sm:inline">Добавить столбец</span>
              <span className="sm:hidden">Столбец</span>
            </button>
          )}
          {canManageProject && viewMode === 'kanban' && (
            <button onClick={() => setShowColumnOrder(true)} className="md:hidden px-3 py-2 text-sm bg-white/5 text-amber-200 rounded-2xl font-semibold hover:bg-white/10 transition-all flex items-center gap-2 border border-amber-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          )}
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 p-3 bg-white/5 border-b border-white/10 text-xs font-medium text-amber-200/60 uppercase">
              <div className="col-span-5">Задача</div>
              <div className="col-span-2">Статус</div>
              <div className="col-span-2">Приоритет</div>
              <div className="col-span-2">Исполнитель</div>
              <div className="col-span-1">Дедлайн</div>
            </div>
            <div className="divide-y divide-white/5">
              {tasks.filter(t => {
                if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
                if (filterAssignee === 'unassigned' && t.assigned_to) return false;
                if (filterAssignee !== 'all' && filterAssignee !== 'unassigned' && t.assigned_to !== filterAssignee) return false;
                return true;
              }).sort((a, b) => {
                if (sortBy === 'priority') {
                  const order = { high: 0, medium: 1, low: 2 };
                  return order[a.priority] - order[b.priority];
                }
                if (sortBy === 'due_date') {
                  if (!a.due_date) return 1;
                  if (!b.due_date) return -1;
                  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                }
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }).map((task) => {
                const status = statuses.find(s => s.id === task.status_id);
                const assignee = users.find(u => u.id === task.assigned_to);
                return (
                  <div
                    key={task.id}
                    onClick={() => handleEditTask(task)}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div className="md:col-span-5">
                      <div className="font-medium text-white">{task.title}</div>
                      {task.description && <div className="text-xs text-amber-200/50 mt-1 line-clamp-1">{task.description}</div>}
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <span className="px-2 py-1 rounded-lg text-xs text-white" style={{ background: `${status?.color}50` }}>
                        {status?.icon} {status?.title}
                      </span>
                    </div>
                    <div className="md:col-span-2 flex items-center">
                      <span className="text-sm text-white">{task.priority === 'high' ? '🔴 Высокий' : task.priority === 'medium' ? '🟡 Средний' : '🟢 Низкий'}</span>
                    </div>
                    <div className="md:col-span-2 flex items-center text-sm text-amber-200/80">
                      {assignee ? assignee.name : <span className="text-amber-200/40">—</span>}
                    </div>
                    <div className="md:col-span-1 flex items-center text-sm text-amber-200/60">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                    </div>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div className="p-8 text-center text-amber-200/40">Нет задач</div>
              )}
            </div>
          </div>
        )}

        {/* Kanban View - Desktop */}
        {viewMode === 'kanban' && (
          <div className="hidden md:block">
            <DndContext collisionDetection={closestCenter} sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={statuses.map(s => `column-${s.id}`)} strategy={horizontalListSortingStrategy}>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(280px, 1fr))` }}>
                  {statuses.map((status) => (
                    <Column key={status.id} status={status} tasks={getFilteredTasks(status.id)} onDelete={handleDeleteTask} onEdit={handleEditTask} onView={handleEditTask} onEditColumn={handleEditColumn} onDeleteColumn={handleDeleteColumn} canManage={canManageProject} isDragging={activeColumn?.id === status.id} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 300, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeTask && (
                  <div className="bg-slate-800 p-3 rounded-lg border border-amber-500/50 shadow-2xl shadow-black/50">
                    <h3 className="font-semibold text-white text-sm">{activeTask.title}</h3>
                  {activeTask.description && <p className="text-xs text-amber-200/50 mt-1 line-clamp-1">{activeTask.description}</p>}
                </div>
              )}
              {activeColumn && (
                <div className="bg-slate-900/95 rounded-2xl border border-amber-500/50 shadow-2xl w-[280px] opacity-90">
                  <div 
                    className={`p-4 border-b border-white/10 rounded-t-2xl ${!activeColumn.color.startsWith('#') ? `bg-gradient-to-r ${activeColumn.color}` : ''}`}
                    style={activeColumn.color.startsWith('#') ? { background: `linear-gradient(to right, ${activeColumn.color}, ${adjustColor(activeColumn.color, -20)})` } : {}}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{activeColumn.icon}</span>
                      <h3 className="font-semibold text-white">{activeColumn.title}</h3>
                    </div>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
        )}

        {/* Mobile: Accordion layout (Kanban only) */}
        {viewMode === 'kanban' && (
          <div className="md:hidden space-y-2">
          {statuses.map((status) => {
            const statusTasks = getFilteredTasks(status.id);
            const isExpanded = expandedColumn === status.id;
            return (
              <div key={status.id} className="bg-slate-900/80 rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedColumn(isExpanded ? null : status.id)}
                  className="w-full p-3 flex items-center justify-between"
                  style={{ background: `linear-gradient(to right, ${status.color}40, transparent)` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{status.icon}</span>
                    <span className="font-semibold text-white">{status.title}</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">{statusTasks.length}</span>
                  </div>
                  <svg className={`w-5 h-5 text-amber-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="p-2 space-y-2 bg-slate-900/50">
                    {statusTasks.length === 0 ? (
                      <div className="text-center py-4 text-amber-200/40 text-sm">Нет задач</div>
                    ) : (
                      statusTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleEditTask(task)}
                          className="p-3 bg-slate-800/80 rounded-lg border border-white/5 active:bg-slate-700"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-white text-sm">{task.title}</h4>
                            <span className="text-xs">{task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}</span>
                          </div>
                          {task.description && <p className="text-xs text-amber-200/50 mt-1 line-clamp-2">{task.description}</p>}
                          {task.due_date && (
                            <div className="mt-2 text-xs text-amber-200/60">
                              📅 {new Date(task.due_date).toLocaleDateString('ru-RU')}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Column Order Modal (Mobile) */}
      {showColumnOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50" onClick={() => setShowColumnOrder(false)}>
          <div className="bg-slate-900/95 border border-white/10 rounded-t-2xl w-full max-h-[80vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Порядок колонок</h3>
              <button onClick={() => setShowColumnOrder(false)} className="text-amber-200/60 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
              {statuses.map((status, index) => (
                <div key={status.id} className="flex items-center gap-2 p-3 bg-slate-800 rounded-xl">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={async () => {
                        if (index === 0) return;
                        const newStatuses = [...statuses];
                        [newStatuses[index - 1], newStatuses[index]] = [newStatuses[index], newStatuses[index - 1]];
                        await statusesApi.reorder(project.id, newStatuses.map((s, i) => ({ id: s.id, position: i })));
                        loadData();
                      }}
                      disabled={index === 0}
                      className="w-6 h-6 flex items-center justify-center text-amber-200/60 hover:text-amber-200 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={async () => {
                        if (index === statuses.length - 1) return;
                        const newStatuses = [...statuses];
                        [newStatuses[index], newStatuses[index + 1]] = [newStatuses[index + 1], newStatuses[index]];
                        await statusesApi.reorder(project.id, newStatuses.map((s, i) => ({ id: s.id, position: i })));
                        loadData();
                      }}
                      disabled={index === statuses.length - 1}
                      className="w-6 h-6 flex items-center justify-center text-amber-200/60 hover:text-amber-200 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-lg">{status.icon}</span>
                  <span className="flex-1 text-white font-medium">{status.title}</span>
                  <span className="text-xs text-amber-200/60">{getFilteredTasks(status.id).length} задач</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50 md:p-4" onClick={closeTaskModal}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-t-3xl md:rounded-3xl w-full md:max-w-5xl max-h-[95vh] md:max-h-[90vh] shadow-2xl shadow-black/20 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header with gradient */}
            <div className="relative border-b border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-transparent to-transparent"></div>
              <div className="relative flex items-center justify-between p-5 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    {editingTask ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-white">{editingTask ? (isEditMode ? 'Редактирование' : newTask.title) : 'Новая задача'}</h2>
                    {editingTask && !isEditMode && <p className="text-xs text-amber-200/50">Нажмите для редактирования</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingTask && !isEditMode && (
                    <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-sm border border-white/10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="hidden sm:inline">Изменить</span>
                    </button>
                  )}
                  <button onClick={closeTaskModal} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-amber-200/60 hover:text-white transition-all flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column - Main Info */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6">
                <form onSubmit={handleCreateTask} className="space-y-5">
                  {isEditMode ? (
                    <div>
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Название</label>
                      <input type="text" value={newTask.title} onChange={(e) => { setNewTask({ ...newTask, title: e.target.value }); setHasUnsavedChanges(true); }} className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 text-lg font-medium focus:border-amber-400 focus:bg-white/15 transition-all" placeholder="Введите название задачи" required autoFocus />
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-white">{newTask.title}</div>
                  )}
                  
                  {isEditMode ? (
                    <div>
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Описание</label>
                      <textarea value={newTask.description} onChange={(e) => { setNewTask({ ...newTask, description: e.target.value }); setHasUnsavedChanges(true); }} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 resize-none focus:border-amber-400 focus:bg-white/15 transition-all" placeholder="Добавьте описание..." rows={3} />
                    </div>
                  ) : (
                    newTask.description && <div className="text-white/80 whitespace-pre-wrap bg-white/10 rounded-xl p-4 border border-white/10">{newTask.description}</div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Приоритет</label>
                      {isEditMode ? (
                        <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:border-amber-400 transition-all">
                          <option value="low">🟢 Низкий</option>
                          <option value="medium">🟡 Средний</option>
                          <option value="high">🔴 Высокий</option>
                        </select>
                      ) : (
                        <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white flex items-center gap-2">
                          {newTask.priority === 'low' && '🟢 Низкий'}
                          {newTask.priority === 'medium' && '🟡 Средний'}
                          {newTask.priority === 'high' && '🔴 Высокий'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Статус</label>
                      {isEditMode ? (
                        <select value={newTask.status_id} onChange={(e) => setNewTask({ ...newTask, status_id: e.target.value })} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:border-amber-400 transition-all">
                          {statuses.filter(s => s.permissions.can_create || canManageProject).map(s => (<option key={s.id} value={s.id}>{s.icon} {s.title}</option>))}
                        </select>
                      ) : (
                        <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white">
                          {statuses.find(s => s.id === newTask.status_id)?.icon} {statuses.find(s => s.id === newTask.status_id)?.title}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Исполнитель</label>
                      {isEditMode ? (
                        <select value={newTask.assigned_to} onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:border-amber-400 transition-all">
                          <option value="">Не назначено</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      ) : (
                        <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white">
                          {newTask.assigned_to ? users.find(u => u.id === newTask.assigned_to)?.name : 'Не назначено'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Дедлайн</label>
                      {isEditMode ? (
                        <input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:border-amber-400 transition-all" />
                      ) : (
                        <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white">
                          {newTask.due_date ? new Date(newTask.due_date).toLocaleDateString('ru-RU') : 'Не указан'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-white/10 pt-5 mt-2">
                    <Checklist 
                      items={newTask.checklist} 
                      onChange={handleChecklistChange}
                      readOnly={!isEditMode}
                    />
                  </div>

                  {editingTask && (
                    <div className="border-t border-white/5 pt-5">
                      <Attachments 
                        taskId={editingTask.id}
                        attachments={editingTask.attachments || []}
                        onUpdate={loadData}
                      />
                    </div>
                  )}

                  {/* Comments on mobile */}
                  {editingTask && (
                    <div className="border-t border-white/5 pt-5 md:hidden">
                      <Comments 
                        taskId={editingTask.id}
                        currentUserId={user.id}
                      />
                    </div>
                  )}

                  {isEditMode && (
                    <div className="flex gap-3 pt-5 -mx-5 px-5 pb-5 -mb-5 border-t border-white/10">
                      <button type="button" onClick={closeTaskModal} className="flex-1 px-4 py-3.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/20 font-medium">Отмена</button>
                      <button type="submit" className="flex-1 px-4 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/30">{editingTask ? 'Сохранить' : 'Создать задачу'}</button>
                    </div>
                  )}
                </form>
              </div>

              {/* Right Column - Comments & Activity (desktop only) */}
              {editingTask && (
                <div className="hidden md:block w-96 border-l border-white/5 bg-slate-900/50 overflow-y-auto p-6">
                  <Comments
                    taskId={editingTask.id}
                    currentUserId={user.id}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Column Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowColumnModal(false); setEditingColumn(null); setNewColumn({ title: '', color: '#475569', icon: '📌' }); }}>
          <div className="bg-slate-900/95 border border-white/10 p-5 rounded-2xl w-[380px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">{editingColumn ? 'Редактировать столбец' : 'Новый столбец'}</h2>
            <div className="space-y-3">
              <input type="text" value={newColumn.title} onChange={(e) => setNewColumn({ ...newColumn, title: e.target.value })} className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-amber-200/30" placeholder="Название" autoFocus />
              <input type="text" value={newColumn.icon} onChange={(e) => setNewColumn({ ...newColumn, icon: e.target.value })} className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white" placeholder="Иконка (emoji)" />
              
              {/* Color Picker */}
              <div>
                <label className="block text-xs text-amber-300/80 mb-2">Цвет заголовка</label>
                <div className="flex gap-3 items-center">
                  <input 
                    type="color" 
                    value={newColumn.color.startsWith('#') ? newColumn.color : '#475569'} 
                    onChange={(e) => setNewColumn({ ...newColumn, color: e.target.value })} 
                    className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white/20 bg-transparent"
                  />
                  <div className="flex-1 space-y-1">
                    <input 
                      type="text" 
                      value={newColumn.color} 
                      onChange={(e) => setNewColumn({ ...newColumn, color: e.target.value })} 
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm font-mono"
                      placeholder="#475569"
                    />
                    <div className="flex gap-1">
                      {['#475569', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColumn({ ...newColumn, color: c })}
                          className={`w-6 h-6 rounded-md transition-all ${newColumn.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : 'hover:scale-110'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Preview */}
                <div className="mt-3 p-3 rounded-xl" style={{ background: `linear-gradient(to right, ${newColumn.color}, ${adjustColor(newColumn.color, -20)})` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{newColumn.icon || '📌'}</span>
                    <span className="font-semibold text-white">{newColumn.title || 'Превью'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowColumnModal(false); setEditingColumn(null); }} className="flex-1 px-4 py-2.5 bg-white/5 text-amber-200 rounded-xl hover:bg-white/10">Отмена</button>
                <button onClick={handleSaveColumn} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 rounded-xl font-bold">{editingColumn ? 'Сохранить' : 'Создать'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && <ProjectSettings project={project} onClose={() => setShowSettings(false)} statuses={statuses} onUpdate={loadData} />}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowProfile(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Профиль</h2>
              <button onClick={() => setShowProfile(false)} className="text-amber-200/60 hover:text-white text-xl">✕</button>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl font-bold text-white">
                {user.name[0].toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{user.name}</div>
                <div className="text-sm text-amber-200/60">{user.email}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Telegram ID</label>
                <input
                  type="text"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  placeholder="123456789"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:border-amber-400 transition-all"
                />
                <p className="text-xs text-amber-200/50 mt-2">
                  {project.telegram_bot_token 
                    ? 'Напишите /start боту проекта, он пришлёт ваш ID' 
                    : 'Узнайте свой ID у @userinfobot в Telegram'}
                </p>
              </div>
              
              <button
                onClick={async () => {
                  try {
                    await authApi.updateMe({ telegram_id: telegramId });
                    toast.success('Профиль обновлён');
                    setShowProfile(false);
                  } catch (error) {
                    toast.error('Ошибка сохранения');
                  }
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-400 hover:to-orange-400 transition-all"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmClose && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md">
            <h3 className="text-lg font-bold text-white mb-2">Несохраненные изменения</h3>
            <p className="text-amber-200/80 mb-4">У вас есть несохраненные изменения. Закрыть без сохранения?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmClose(false)} className="flex-1 px-4 py-2 bg-white/5 text-amber-200 rounded-xl hover:bg-white/10">
                Отмена
              </button>
              <button onClick={forceCloseModal} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600">
                Закрыть без сохранения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
