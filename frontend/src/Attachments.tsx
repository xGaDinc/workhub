import { useState } from 'react';
import { tasks as tasksApi } from './api';
import toast from 'react-hot-toast';
import { Attachment } from './types';

interface AttachmentsProps {
  taskId: string;
  attachments: Attachment[];
  onUpdate: () => void;
}

export default function Attachments({ taskId, attachments, onUpdate }: AttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await tasksApi.uploadAttachment(taskId, file);
      toast.success('Файл загружен');
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await tasksApi.deleteAttachment(taskId, attachmentId);
      toast.success('Файл удален');
      onUpdate();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📝';
    if (mimetype.includes('zip')) return '📦';
    return '📎';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-200">Вложения</span>
        {attachments.length > 0 && (
          <span className="text-xs text-amber-200/60">{attachments.length}</span>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att._id} className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg group">
              {att.mimetype.startsWith('image/') ? (
                <img 
                  src={`http://localhost:3000${att.url}`} 
                  alt={att.original_name}
                  className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                  onClick={() => setPreview(`http://localhost:3000${att.url}`)}
                />
              ) : (
                <span className="text-xl">{getFileIcon(att.mimetype)}</span>
              )}
              <div className="flex-1 min-w-0">
                <a 
                  href={`http://localhost:3000${att.url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-amber-200 hover:text-amber-100 truncate block"
                >
                  {att.original_name}
                </a>
                <span className="text-xs text-amber-200/40">{formatSize(att.size)}</span>
              </div>
              {taskId && (
                <button
                  onClick={() => handleDelete(att._id!)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-sm px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
            disabled={uploading}
          />
          <label
            htmlFor="file-upload"
            className={`flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-sm text-amber-200 hover:bg-slate-700 cursor-pointer transition-all ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Загрузка...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Прикрепить файл
              </>
            )}
          </label>
        </div>

      {preview && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <img 
            src={preview} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full text-white text-xl"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
