import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { projects as projectsApi } from './api';
import { Project, ProjectMember, Status, ROLE_LABELS } from './types';

interface ProjectSettingsProps {
  project: Project;
  statuses: Status[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function ProjectSettings({ project, statuses, onClose, onUpdate }: ProjectSettingsProps) {
  const [tab, setTab] = useState<'members' | 'permissions' | 'notifications'>('members');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', name: '', password: '', role: 'member' });
  const [telegramToken, setTelegramToken] = useState(project.telegram_bot_token || '');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data } = await projectsApi.getMembers(project.id);
      setMembers(data);
    } catch (error) {
      toast.error('Ошибка загрузки участников');
    }
  };

  const loadPermissions = async (memberId: string) => {
    try {
      const { data } = await projectsApi.getMemberPermissions(project.id, memberId);
      setPermissions(data.permissions || []);
    } catch (error) {
      toast.error('Ошибка загрузки прав');
    }
  };

  const handleAddMember = async () => {
    if (!newMember.email || !newMember.name || !newMember.password) {
      toast.error('Заполните все поля');
      return;
    }
    try {
      await projectsApi.createAndAddMember(project.id, {
        email: newMember.email,
        name: newMember.name,
        password: newMember.password,
        role: newMember.role
      });
      toast.success('Участник создан и добавлен');
      setShowAddMember(false);
      setNewMember({ email: '', name: '', password: '', role: 'member' });
      loadMembers();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка создания');
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      await projectsApi.updateMember(project.id, memberId, { role });
      toast.success('Роль обновлена');
      loadMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка обновления');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Удалить участника из проекта?')) return;
    try {
      await projectsApi.removeMember(project.id, memberId);
      toast.success('Участник удалён');
      loadMembers();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const handleSelectMember = async (member: ProjectMember) => {
    setSelectedMember(member);
    await loadPermissions(member.id);
    setTab('permissions');
  };

  const handleSavePermissions = async () => {
    if (!selectedMember) return;
    try {
      await projectsApi.setMemberPermissions(project.id, selectedMember.id, permissions);
      toast.success('Права сохранены');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const updatePermission = (statusId: string | null, field: string, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.status_id === statusId);
      if (existing) {
        return prev.map(p => p.status_id === statusId ? { ...p, [field]: value } : p);
      } else {
        return [...prev, { status_id: statusId, can_read: false, can_create: false, can_edit: false, can_delete: false, [field]: value }];
      }
    });
  };

  const getPermission = (statusId: string | null, field: string): boolean => {
    const perm = permissions.find(p => p.status_id === statusId);
    return perm ? !!perm[field] : false;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900/95 border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:w-[600px] max-h-[90vh] md:max-h-[80vh] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-lg md:text-xl font-bold text-white">Настройки проекта</h2>
            <button onClick={onClose} className="text-amber-200/60 hover:text-white text-xl">✕</button>
          </div>
          <div className="flex gap-2 mt-4 overflow-x-auto">
            <button onClick={() => { setTab('members'); setSelectedMember(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${tab === 'members' ? 'bg-amber-500/20 text-amber-400' : 'text-amber-200/60 hover:bg-white/5'}`}>
              Участники
            </button>
            {selectedMember && selectedMember.role !== 'owner' && selectedMember.role !== 'admin' && (
              <button onClick={() => setTab('permissions')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${tab === 'permissions' ? 'bg-amber-500/20 text-amber-400' : 'text-amber-200/60 hover:bg-white/5'}`}>
                Права: {selectedMember.name}
              </button>
            )}
            <button onClick={() => setTab('notifications')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${tab === 'notifications' ? 'bg-amber-500/20 text-amber-400' : 'text-amber-200/60 hover:bg-white/5'}`}>
              🔔 Уведомления
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-5 overflow-y-auto max-h-[70vh] md:max-h-[60vh]">
          {tab === 'notifications' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-amber-200">
                  Укажите токен Telegram бота для отправки уведомлений участникам при назначении задач и смене статусов.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Токен бота</label>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:border-amber-400 transition-all"
                />
                <p className="text-xs text-amber-200/50 mt-2">Получите токен у @BotFather в Telegram</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await projectsApi.update(project.id, { telegram_bot_token: telegramToken });
                    toast.success('Токен сохранён');
                    onUpdate();
                  } catch (error) {
                    toast.error('Ошибка сохранения');
                  }
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-400 hover:to-orange-400 transition-all"
              >
                Сохранить
              </button>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-3">
              {/* Add Member Button */}
              {!showAddMember ? (
                <button onClick={() => setShowAddMember(true)}
                  className="w-full px-4 py-3 border-2 border-dashed border-white/20 rounded-xl text-amber-200/60 hover:border-amber-500/50 hover:text-amber-400 transition-all flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Добавить участника
                </button>
              ) : (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                  <div className="text-sm text-amber-200/80 mb-2">Создать аккаунт для нового участника:</div>
                  <input 
                    type="text" 
                    placeholder="Имя" 
                    value={newMember.name} 
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-amber-200/30"
                  />
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={newMember.email} 
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-amber-200/30"
                  />
                  <input 
                    type="text" 
                    placeholder="Пароль" 
                    value={newMember.password} 
                    onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-amber-200/30"
                  />
                  <select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-amber-100">
                    <option value="admin">Администратор</option>
                    <option value="member">Участник</option>
                    <option value="viewer">Наблюдатель</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddMember(false)} className="flex-1 px-4 py-2 bg-white/5 text-amber-200 rounded-xl">Отмена</button>
                    <button onClick={handleAddMember} className="flex-1 px-4 py-2 bg-amber-500 text-slate-900 rounded-xl font-bold">Создать</button>
                  </div>
                </div>
              )}

              {/* Members List */}
              {members.map((member) => (
                <div key={member.id} className={`p-4 bg-white/5 rounded-xl border transition-all ${selectedMember?.id === member.id ? 'border-amber-500/50' : 'border-white/10'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm font-bold text-white">
                        {member.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{member.name}</div>
                        <div className="text-sm text-amber-200/60">{member.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === 'owner' ? (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm">{ROLE_LABELS.owner}</span>
                      ) : (
                        <>
                          <select value={member.role} onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-amber-100">
                            <option value="admin">Администратор</option>
                            <option value="member">Участник</option>
                            <option value="viewer">Наблюдатель</option>
                          </select>
                          {(member.role === 'member' || member.role === 'viewer') && (
                            <button onClick={() => handleSelectMember(member)}
                              className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30">
                              Права
                            </button>
                          )}
                          <button onClick={() => handleRemoveMember(member.id)}
                            className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'permissions' && selectedMember && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-amber-200">
                  Настройте права для <span className="font-bold text-white">{selectedMember.name}</span> по каждому статусу.
                  Права "Все статусы" применяются ко всем столбцам, если не указаны конкретные.
                </p>
              </div>

              {/* Global permissions */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="font-medium text-white mb-3">📋 Все статусы (по умолчанию)</div>
                <div className="grid grid-cols-4 gap-2">
                  {['can_read', 'can_create', 'can_edit', 'can_delete'].map(field => (
                    <label key={field} className="flex items-center gap-2 text-sm text-amber-200/80">
                      <input type="checkbox" checked={getPermission(null, field)} onChange={(e) => updatePermission(null, field, e.target.checked)}
                        className="w-4 h-4 rounded bg-white/10 border-white/20 text-amber-500 focus:ring-amber-500" />
                      {field === 'can_read' ? 'Читать' : field === 'can_create' ? 'Создавать' : field === 'can_edit' ? 'Редактировать' : 'Удалять'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Per-status permissions */}
              {statuses.map(status => (
                <div key={status.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-medium text-white mb-3">{status.icon} {status.title}</div>
                  <div className="grid grid-cols-4 gap-2">
                    {['can_read', 'can_create', 'can_edit', 'can_delete'].map(field => (
                      <label key={field} className="flex items-center gap-2 text-sm text-amber-200/80">
                        <input type="checkbox" checked={getPermission(status.id, field)} onChange={(e) => updatePermission(status.id, field, e.target.checked)}
                          className="w-4 h-4 rounded bg-white/10 border-white/20 text-amber-500 focus:ring-amber-500" />
                        {field === 'can_read' ? 'Читать' : field === 'can_create' ? 'Создавать' : field === 'can_edit' ? 'Редактировать' : 'Удалять'}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setTab('members'); setSelectedMember(null); }}
                  className="flex-1 px-4 py-2.5 bg-white/5 text-amber-200 rounded-xl hover:bg-white/10">Назад</button>
                <button onClick={handleSavePermissions}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 rounded-xl font-bold">
                  Сохранить права
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
