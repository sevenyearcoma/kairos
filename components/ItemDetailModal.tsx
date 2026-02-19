
import React, { useState, useEffect, useMemo } from 'react';
import { Event, Task, Language } from '../types';
import { getT } from '../translations';

interface ItemDetailModalProps {
  item: Event | Task | null;
  onClose: () => void;
  onEdit?: (id: string, updates: any) => void;
  onDelete?: (id: string) => void;
  language: Language;
  initialEditMode?: boolean;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose, onEdit, onDelete, language, initialEditMode = false }) => {
  const t = useMemo(() => getT(language), [language]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const DAYS_OF_WEEK = useMemo(() => t.common.weekDays.map((label, index) => {
    // Correct mapping for JS getDay(): Sunday is 0, Monday is 1...
    const value = index === 6 ? 0 : index + 1;
    return { label, value };
  }), [t]);

  const TODAY = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (item) {
      setFormData({ 
        ...item, 
        date: item.date || TODAY,
        daysOfWeek: item.daysOfWeek || [],
        dayOfMonth: item.dayOfMonth || (item.date ? new Date(item.date).getDate() : new Date().getDate())
      });
      setIsEditing(initialEditMode);
    }
  }, [item, initialEditMode, TODAY]);

  if (!item) return null;

  const isEvent = 'startTime' in item;
  const isGoogleSynced = isEvent && (item as Event).source === 'google';

  const handleSave = () => {
    if (onEdit) {
      onEdit(item.id, formData);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(t.common.delete + '?')) {
      onDelete(item.id);
      onClose();
    }
  };

  const toggleDay = (dayValue: number) => {
    const current = formData.daysOfWeek || [];
    if (current.includes(dayValue)) {
      setFormData({ ...formData, daysOfWeek: current.filter((d: number) => d !== dayValue) });
    } else {
      setFormData({ ...formData, daysOfWeek: [...current, dayValue] });
    }
  };

  const renderDescription = (text?: string) => {
    if (!text) return <p className="text-charcoal/30 italic">{t.modal.noNotes}</p>;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all font-bold">{part}</a>;
      }
      return part;
    });
  };

  const getRecurrenceLabel = () => {
    if (!formData.recurrence || formData.recurrence === 'none') return t.recurrence.none;
    if (formData.recurrence === 'specific_days') {
      const selectedLabels = [...(formData.daysOfWeek || [])]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d: number) => DAYS_OF_WEEK.find(day => day.value === d)?.label)
        .filter(Boolean)
        .join(', ');
      return t.recurrence.weeklyLabel(selectedLabels);
    }
    return t.recurrence[formData.recurrence as keyof typeof t.recurrence] || formData.recurrence;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="px-8 pt-8 pb-6 border-b border-charcoal/5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  {isEvent ? t.modal.calendarEvent : t.modal.agendaTask}
                </span>
                {isGoogleSynced && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                    <span className="material-symbols-outlined text-[10px]">cloud_done</span>
                    {t.modal.synced}
                  </span>
                )}
              </div>
              {isEditing ? (
                <input 
                  className="text-2xl font-display font-extrabold text-charcoal leading-tight w-full bg-beige-soft border-none rounded-xl focus:ring-2 focus:ring-primary"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              ) : (
                <h2 className="text-2xl font-display font-extrabold text-charcoal leading-tight">{item.title}</h2>
              )}
            </div>
            <div className="flex gap-2">
              {!isEditing && onDelete && (
                <button onClick={handleDelete} title={t.common.delete} className="p-2 bg-red-50 text-red-400 rounded-full hover:bg-red-100 transition-colors">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
              {!isEditing && onEdit && (
                <button onClick={() => setIsEditing(true)} className="p-2 bg-charcoal/5 rounded-full hover:bg-charcoal/10 transition-colors">
                  <span className="material-symbols-outlined text-charcoal/40">edit</span>
                </button>
              )}
              <button onClick={onClose} className="p-2 bg-charcoal/5 rounded-full hover:bg-charcoal/10 transition-colors">
                <span className="material-symbols-outlined text-charcoal/40">close</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-hide">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-charcoal/30">{t.modal.startDate}</span>
              {isEditing ? (
                <input 
                  type="date"
                  className="text-sm font-bold text-charcoal w-full bg-beige-soft border-none rounded-lg"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              ) : (
                <p className="text-sm font-bold text-charcoal">
                  {new Date(item.date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-charcoal/30">
                {isEvent ? t.modal.timeframe : t.modal.category}
              </span>
              {isEditing ? (
                isEvent ? (
                  <div className="flex gap-1">
                    <input type="time" className="text-[10px] w-1/2 bg-beige-soft border-none rounded-lg" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
                    <input type="time" className="text-[10px] w-1/2 bg-beige-soft border-none rounded-lg" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
                  </div>
                ) : (
                  <input className="text-sm font-bold text-charcoal w-full bg-beige-soft border-none rounded-lg" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                )
              ) : (
                <p className="text-sm font-bold text-charcoal">
                  {isEvent ? `${formData.startTime} — ${formData.endTime}` : (item as Task).category}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-charcoal/5">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-charcoal/30">{t.modal.recurrence}</span>
                {isEditing ? (
                  <select 
                    className="text-xs font-bold text-charcoal w-full bg-beige-soft border-none rounded-lg"
                    value={formData.recurrence || 'none'}
                    onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                  >
                    <option value="none">{t.recurrence.none}</option>
                    <option value="daily">{t.recurrence.daily}</option>
                    <option value="weekdays">{t.recurrence.weekdays}</option>
                    <option value="weekly">{t.recurrence.weekly}</option>
                    <option value="specific_days">{t.recurrence.specific_days}</option>
                    <option value="monthly">{t.recurrence.monthly}</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">sync</span>
                    <p className="text-sm font-bold text-charcoal uppercase">{getRecurrenceLabel()}</p>
                  </div>
                )}
              </div>
              
              {isEditing && formData.recurrence === 'monthly' && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-charcoal/30">{t.modal.dayOfMonth}</span>
                  <input 
                    type="number" min="1" max="31"
                    className="text-sm font-bold text-charcoal w-full bg-beige-soft border-none rounded-lg"
                    value={formData.dayOfMonth}
                    onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                  />
                </div>
              )}
            </div>

            {isEditing && formData.recurrence === 'specific_days' && (
              <div className="space-y-2 p-4 bg-beige-soft rounded-2xl animate-in fade-in slide-in-from-top-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-charcoal/30">{t.modal.chooseDays}</span>
                <div className="flex justify-between">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`size-8 rounded-full text-[10px] font-bold transition-all ${
                        formData.daysOfWeek?.includes(day.value)
                          ? 'bg-primary text-charcoal shadow-md scale-110'
                          : 'bg-white text-charcoal/20 hover:text-charcoal/40'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-charcoal/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-charcoal/30">{t.modal.notes}</span>
            {isEditing ? (
              <textarea 
                className="w-full bg-beige-soft border-none rounded-2xl p-5 text-sm text-charcoal focus:ring-2 focus:ring-primary min-h-[100px]"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t.modal.notesPlaceholder}
              />
            ) : (
              <div className="bg-beige-soft p-5 rounded-2xl text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">
                {renderDescription(item.description)}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 bg-beige-soft/50 border-t border-charcoal/5 flex gap-4">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="flex-1 py-4 border border-charcoal/10 text-charcoal rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all">{t.common.cancel}</button>
              <button onClick={handleSave} className="flex-1 py-4 bg-primary text-charcoal rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg hover:brightness-110 active:scale-95 transition-all">{t.modal.update}</button>
            </>
          ) : (
            <button 
              onClick={onClose}
              className="w-full py-4 bg-charcoal text-cream rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg hover:bg-charcoal/90 active:scale-95 transition-all"
            >
              {t.modal.acknowledged}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;
