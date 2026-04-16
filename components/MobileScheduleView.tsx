// components/MobileScheduleView.tsx
'use client';

import { useState } from 'react';
import {
  Schedule,
  Activity,
  ActivityType,
  ACTIVITY_COLORS,
} from '@/lib/types';
import {
  timeToMinutes,
  minutesToTime,
  formatTimeDisplay,
} from '@/lib/time';
import BottomSheet from './BottomSheet';

const PEOPLE = ['Jason', 'Kay', 'Emma', 'Toby'];
const PERSON_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  Jason: { bg: '#dbeafe', border: '#3b82f6', dot: '#2563eb' },
  Kay: { bg: '#fce7f3', border: '#ec4899', dot: '#db2777' },
  Emma: { bg: '#dcfce7', border: '#22c55e', dot: '#16a34a' },
  Toby: { bg: '#ffedd5', border: '#f97316', dot: '#ea580c' },
};
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});
const TYPE_LABELS: Record<ActivityType, string> = {
  routine: 'Routine', meal: 'Meal', personal: 'Personal', work: 'Work',
  family: 'Family', school: 'School', activity: 'Activity', break: 'Break', other: 'Other',
};

interface MobileScheduleViewProps {
  schedule: Schedule;
  currentTime: string;
  onActivityUpdate: (index: number, updates: Partial<Activity>) => void;
  onActivityAdd: (start: string, end: string, person: string) => void;
  onActivityRemove: (index: number) => void;
  onToggleComplete: (index: number) => void;
  selectedPerson: string;
  onPersonChange: (person: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  onAddActivity: () => void;
  templates: { name: string; displayName: string }[];
  onLoadTemplate: (name: string) => void;
  onRefreshCalendar: () => void;
  onPrint: () => void;
  onSaveAsTemplate: () => void;
}

export default function MobileScheduleView({
  schedule,
  currentTime,
  onActivityUpdate,
  onActivityAdd,
  onActivityRemove,
  onToggleComplete,
  selectedPerson,
  onPersonChange,
  onUndo,
  canUndo,
  onAddActivity,
  templates,
  onLoadTemplate,
  onRefreshCalendar,
  onPrint,
  onSaveAsTemplate,
}: MobileScheduleViewProps) {
  const [editState, setEditState] = useState<{
    active: boolean;
    activityIndex: number;
    isNew: boolean;
    defaults: { start: string; end: string; person: string } | null;
  }>({ active: false, activityIndex: -1, isNew: false, defaults: null });
  const [moreMenu, setMoreMenu] = useState(false);

  // Get activities for the selected person
  const personActivities = schedule.activities.filter(
    (a) => a.people.includes(selectedPerson)
  );

  // Find activity at a given time slot
  function getActivityAtSlot(slot: string): Activity | null {
    const slotMins = timeToMinutes(slot);
    return personActivities.find((a) => {
      const start = timeToMinutes(a.start);
      const end = timeToMinutes(a.end);
      return slotMins >= start && slotMins < end;
    }) || null;
  }

  // Check if this slot is the start of an activity
  function isSlotStart(slot: string, activity: Activity): boolean {
    return activity.start === slot;
  }

  function handleSlotTap(slot: string) {
    const activity = getActivityAtSlot(slot);
    if (activity) {
      const idx = schedule.activities.indexOf(activity);
      setEditState({ active: true, activityIndex: idx, isNew: false, defaults: null });
    } else {
      const nextSlot = minutesToTime(timeToMinutes(slot) + 60);
      onActivityAdd(slot, nextSlot, selectedPerson);
      const newIdx = schedule.activities.length;
      setTimeout(() => {
        onActivityUpdate(newIdx, {
          title: 'New Activity',
          type: 'other',
          color: ACTIVITY_COLORS.other,
          people: [selectedPerson],
        });
      }, 50);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Person tabs — sticky */}
      <div className="flex bg-white border-b border-stone-200 flex-shrink-0">
        {PEOPLE.map((person) => {
          const isActive = selectedPerson === person;
          return (
            <button
              key={person}
              onClick={() => onPersonChange(person)}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                isActive
                  ? 'text-stone-900 border-b-2'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
              style={{
                borderBottomColor: isActive ? PERSON_COLORS[person].border : 'transparent',
                touchAction: 'manipulation',
              }}
            >
              {person}
            </button>
          );
        })}
      </div>

      {/* Schedule list — scrollable */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TIME_SLOTS.map((slot) => {
          const slotMins = timeToMinutes(slot);
          const activity = getActivityAtSlot(slot);
          const isCurrent = currentTime >= slot && currentTime < minutesToTime(slotMins + 60);
          const isPast = currentTime >= minutesToTime(slotMins + 60);

          // Skip slots that are part of a multi-hour activity (not the start)
          if (activity && !isSlotStart(slot, activity)) return null;

          const typeColor = activity ? ACTIVITY_COLORS[activity.type] || '#ffffff' : null;
          const personBorder = PERSON_COLORS[selectedPerson]?.border || '#d1d5db';

          return (
            <div
              key={slot}
              className={`flex items-stretch border-b border-stone-100 ${
                isCurrent ? 'bg-orange-50' : isPast ? 'opacity-40' : ''
              }`}
              style={{ minHeight: 48 }}
            >
              {/* Time label */}
              <div
                className={`w-12 flex-shrink-0 flex flex-col items-center justify-center text-xs font-semibold pr-2 ${
                  isCurrent ? 'text-orange-600' : 'text-stone-400'
                }`}
              >
                <span>{formatTimeDisplay(slot).replace(':00', '').replace(' ', '').toLowerCase()}</span>
                {isCurrent && (
                  <span className="text-[8px] font-bold text-orange-500">NOW</span>
                )}
              </div>

              {/* Activity card or empty slot */}
              {activity ? (
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2 cursor-pointer"
                  style={{
                    backgroundColor: activity.completed ? '#f5f5f4' : typeColor || '#fff',
                    borderLeft: `3px solid ${personBorder}`,
                    minHeight: 48,
                  }}
                  onClick={() => {
                    const idx = schedule.activities.indexOf(activity);
                    setEditState({ active: true, activityIndex: idx, isNew: false, defaults: null });
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const idx = schedule.activities.indexOf(activity);
                      onToggleComplete(idx);
                    }}
                    className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                      activity.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-white/60 border border-stone-300'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {activity.completed && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm font-medium leading-tight flex-1 ${activity.completed ? 'line-through text-stone-400' : ''}`}>
                    {activity.title}
                  </span>
                  <span className="text-[10px] text-stone-400 flex-shrink-0">
                    {formatTimeDisplay(activity.start).replace(':00 ', '')}-{formatTimeDisplay(activity.end).replace(':00 ', '')}
                  </span>
                </div>
              ) : (
                <div
                  className="flex-1 flex items-center justify-center px-3 py-2 cursor-pointer text-stone-300 hover:bg-stone-50"
                  style={{ borderLeft: `3px solid ${personBorder}33`, minHeight: 48, touchAction: 'manipulation' }}
                  onClick={() => handleSlotTap(slot)}
                >
                  <span className="text-lg">+</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom toolbar — fixed */}
      <div className="flex-shrink-0 bg-white border-t border-stone-200 px-4 py-2 flex items-center gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex-1 ${
            canUndo
              ? 'bg-orange-500 text-white active:scale-95'
              : 'bg-stone-100 text-stone-300 cursor-not-allowed'
          }`}
          style={{ touchAction: 'manipulation', minHeight: 48 }}
        >
          Undo
        </button>
        <button
          onClick={onAddActivity}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex-1 hover:bg-emerald-700 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: 48 }}
        >
          + Add
        </button>
        <div className="relative">
          <button
            onClick={() => setMoreMenu(!moreMenu)}
            className="bg-stone-200 text-stone-600 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-stone-300 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: 48, minWidth: 48 }}
          >
            &bull;&bull;&bull;
          </button>
          {moreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreMenu(false)} />
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 w-48 overflow-hidden">
                {templates.length > 0 && (
                  <div className="border-b border-stone-100">
                    <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-stone-400">Templates</div>
                    {templates.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => { onLoadTemplate(t.name); setMoreMenu(false); }}
                        className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                        style={{ touchAction: 'manipulation', minHeight: 44 }}
                      >
                        {t.displayName}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { onRefreshCalendar(); setMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors" style={{ touchAction: 'manipulation', minHeight: 44 }}>Sync Calendar</button>
                <button onClick={() => { onPrint(); setMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors" style={{ touchAction: 'manipulation', minHeight: 44 }}>Print</button>
                <button onClick={() => { onSaveAsTemplate(); setMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 border-t border-stone-100 transition-colors" style={{ touchAction: 'manipulation', minHeight: 44 }}>Save as Template</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Activity edit bottom sheet */}
      {editState.active && (
        <MobileEditSheet
          schedule={schedule}
          editState={editState}
          onUpdate={onActivityUpdate}
          onRemove={onActivityRemove}
          onClose={() => setEditState({ active: false, activityIndex: -1, isNew: false, defaults: null })}
          selectedPerson={selectedPerson}
        />
      )}
    </div>
  );
}

// Inline edit sheet for mobile
function MobileEditSheet({
  schedule,
  editState,
  onUpdate,
  onRemove,
  onClose,
  selectedPerson,
}: {
  schedule: Schedule;
  editState: { active: boolean; activityIndex: number; isNew: boolean; defaults: { start: string; end: string; person: string } | null };
  onUpdate: (index: number, updates: Partial<Activity>) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
  selectedPerson: string;
}) {
  const existing = !editState.isNew && editState.activityIndex >= 0 ? schedule.activities[editState.activityIndex] : null;
  const [title, setTitle] = useState(existing?.title || '');
  const [start, setStart] = useState(existing?.start || editState.defaults?.start || '07:00');
  const [end, setEnd] = useState(existing?.end || editState.defaults?.end || '08:00');
  const [type, setType] = useState<ActivityType>(existing?.type || 'other');
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    existing?.people || [selectedPerson]
  );
  const [notes, setNotes] = useState(existing?.notes || '');

  function togglePerson(person: string) {
    setSelectedPeople((prev) => {
      if (prev.includes(person)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== person);
      }
      return [...prev, person];
    });
  }

  function handleSave() {
    if (!title.trim()) return;
    onUpdate(editState.activityIndex, {
      title: title.trim(),
      start,
      end,
      type,
      color: ACTIVITY_COLORS[type],
      people: selectedPeople,
      notes,
    });
    onClose();
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-4 pb-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">
          {editState.isNew ? 'New Activity' : 'Edit Activity'}
        </h2>

        {/* Title */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm focus:border-stone-500 outline-none"
            placeholder="What's happening?"
            autoFocus
            style={{ touchAction: 'manipulation', fontSize: 16 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) handleSave(); }}
          />
        </div>

        {/* Time */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1">Time</label>
          <div className="flex gap-2 items-center">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1 border border-stone-300 rounded-xl px-3 py-2.5 text-sm text-center" style={{ fontSize: 16 }} />
            <span className="text-stone-300 font-medium">to</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="flex-1 border border-stone-300 rounded-xl px-3 py-2.5 text-sm text-center" style={{ fontSize: 16 }} />
          </div>
        </div>

        {/* Who — 2x2 grid */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1">Who</label>
          <div className="grid grid-cols-2 gap-2">
            {PEOPLE.map((person) => {
              const isActive = selectedPeople.includes(person);
              return (
                <button
                  key={person}
                  onClick={() => togglePerson(person)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                    isActive
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-stone-400 border-stone-200'
                  }`}
                  style={{
                    touchAction: 'manipulation',
                    ...(isActive ? { backgroundColor: PERSON_COLORS[person]?.dot || '#666' } : {}),
                  }}
                >
                  {person}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type — horizontal scroll */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1">Type</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(Object.entries(ACTIVITY_COLORS) as [ActivityType, string][]).map(([t, color]) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border-2 flex-shrink-0 ${
                  type === t ? 'border-stone-600 shadow-sm' : 'border-transparent opacity-60'
                }`}
                style={{ backgroundColor: color, touchAction: 'manipulation' }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm focus:border-stone-500 outline-none"
            placeholder="Optional notes..."
            style={{ touchAction: 'manipulation', fontSize: 16 }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 bg-stone-800 text-white py-3 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40"
            style={{ touchAction: 'manipulation', minHeight: 48 }}
          >
            {editState.isNew ? 'Add Activity' : 'Save Changes'}
          </button>
          {!editState.isNew && (
            <button
              onClick={() => { onRemove(editState.activityIndex); onClose(); }}
              className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
              style={{ touchAction: 'manipulation', minHeight: 48 }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
