interface ChecklistItem {
  text: string;
  completed: boolean;
  _id?: string;
}

interface ChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export default function Checklist({ items, onChange }: ChecklistProps) {
  const addItem = (text: string) => {
    if (!text.trim()) return;
    onChange([...items, { text: text.trim(), completed: false }]);
  };

  const toggleItem = (index: number) => {
    const updated = items.map((item, i) => 
      i === index ? { ...item, completed: !item.completed } : item
    );
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateText = (index: number, text: string) => {
    const updated = items.map((item, i) => 
      i === index ? { ...item, text } : item
    );
    onChange(updated);
  };

  const completed = items.filter(i => i.completed).length;
  const total = items.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-200">Чеклист</span>
        {total > 0 && (
          <span className="text-xs text-amber-200/60">{completed}/{total}</span>
        )}
      </div>

      {total > 0 && (
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-amber-500 to-yellow-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2 group">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleItem(index)}
              className="mt-1 w-4 h-4 rounded bg-slate-700 border-white/20 text-amber-500"
            />
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateText(index, e.target.value)}
              className={`flex-1 px-2 py-1 bg-transparent border-none text-sm text-white focus:outline-none ${
                item.completed ? 'line-through text-amber-200/40' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Добавить пункт..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          className="flex-1 px-3 py-2 bg-slate-800 border border-white/10 rounded-xl text-sm text-white placeholder-amber-200/30"
        />
      </div>
    </div>
  );
}
