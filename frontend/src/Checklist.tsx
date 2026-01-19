interface ChecklistItem {
  text: string;
  completed: boolean;
  _id?: string;
}

interface ChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}

export default function Checklist({ items, onChange, readOnly = false }: ChecklistProps) {
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
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Чеклист</span>
        {total > 0 && (
          <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">{completed}/{total}</span>
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
            {readOnly ? (
              <span className={`flex-1 px-2 py-1 text-sm text-white ${item.completed ? 'line-through text-amber-200/40' : ''}`}>
                {item.text}
              </span>
            ) : (
              <input
                type="text"
                value={item.text}
                onChange={(e) => updateText(index, e.target.value)}
                className={`flex-1 px-2 py-1 bg-transparent border-none text-sm text-white focus:outline-none ${
                  item.completed ? 'line-through text-amber-200/40' : ''
                }`}
              />
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-red-400 hover:text-red-300 text-sm px-1"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            id="checklist-input"
            placeholder="Добавить пункт..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
            className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:border-amber-400 transition-all"
          />
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('checklist-input') as HTMLInputElement;
              if (input?.value) {
                addItem(input.value);
                input.value = '';
              }
            }}
            className="px-3 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-400 transition-all font-bold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
