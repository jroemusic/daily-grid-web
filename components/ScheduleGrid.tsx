'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Schedule,
  Activity,
  ActivityType,
  ACTIVITY_COLORS,
  CalendarEvent
} from '@/lib/types';
import {
  timeToMinutes,
  minutesToTime,
  formatTimeDisplay,
  sortActivitiesByTime
} from '@/lib/time';
import { shiftActivitiesFrom, shiftSingleActivity } from '@/lib/shiftCascade';
import ShiftMenu from './ShiftMenu';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';

const PEOPLE = ['Jason', 'Kay', 'Emma', 'Toby'];
const PERSON_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  Jason: { bg: '#dbeafe', border: '#3b82f6', dot: '#2563eb' },
  Kay: { bg: '#fce7f3', border: '#ec4899', dot: '#db2777' },
  Emma: { bg: '#dcfce7', border: '#22c55e', dot: '#16a34a' },
  Toby: { bg: '#ffedd5', border: '#f97316', dot: '#ea580c' }
};
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

interface ScheduleGridProps {
  schedule: Schedule;
  currentTime: string; // passed from parent
  onActivityUpdate: (index: number, updates: Partial<Activity>) => void;
  onActivityAdd: (start: string, end: string, person: string) => void;
  onActivityRemove: (index: number) => void;
  onToggleComplete: (index: number) => void;
  onCalendarEventOverride: (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => void;
  editMode: boolean;
  triggerNewActivity?: number; // increment to open new activity modal
}

export default function ScheduleGrid({
  schedule,
  currentTime,
  onActivityUpdate,
  onActivityAdd,
  onActivityRemove,
  onToggleComplete,
  onCalendarEventOverride,
  editMode,
  triggerNewActivity
}: ScheduleGridProps) {
  const [editState, setEditState] = useState<{
    active: boolean;
    activityIndex: number;
    isNew: boolean;
    defaults: { start: string; end: string; person: string } | null;
  }>({ active: false, activityIndex: -1, isNew: false, defaults: null });

  const [shiftMenu, setShiftMenu] = useState<{
    activity: Activity;
    person: string;
    position: { x: number; y: number };
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    })
  );

  // Respond to external "new activity" trigger
  useEffect(() => {
    if (triggerNewActivity && triggerNewActivity > 0) {
      setEditState({ active: true, activityIndex: -1, isNew: true, defaults: { start: '07:00', end: '08:00', person: 'Jason' } });
    }
  }, [triggerNewActivity]);

  function isoToHHMM(iso: string): string {
    if (!iso.includes('T')) return iso;
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  const timeSlotMap = new Map<string, Map<string, { activity: Activity; index: number }>>();
  for (let i = 0; i < schedule.activities.length; i++) {
    const activity = schedule.activities[i];
    const timeKey = `${activity.start}-${activity.end}`;
    if (!timeSlotMap.has(timeKey)) {
      timeSlotMap.set(timeKey, new Map());
    }
    for (const person of activity.people) {
      timeSlotMap.get(timeKey)!.set(person, { activity, index: i });
    }
  }

  // Helper: get resolved people for a calendar event (override > default)
  function getEventPeople(event: CalendarEvent): string[] {
    if (event.overridePeople) return event.overridePeople;
    if (event.people) return event.people;
    if (event.person) return [event.person];
    return ['Jason'];
  }

  const calEventRows = new Map<string, CalendarEvent>();
  for (const event of schedule.calendarEvents || []) {
    if (event.enabled === false) continue; // disabled via override
    const evtStart = timeToMinutes(isoToHHMM(event.start));
    const evtEnd = timeToMinutes(isoToHHMM(event.end));
    const eventPeople = getEventPeople(event);
    for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
      const slotStart = timeToMinutes(TIME_SLOTS[i]);
      const slotEnd = timeToMinutes(TIME_SLOTS[i + 1]);
      const overlap = Math.min(evtEnd, slotEnd) - Math.max(evtStart, slotStart);
      if (overlap >= 15) {
        for (const person of eventPeople) {
          calEventRows.set(`${TIME_SLOTS[i]}-${TIME_SLOTS[i + 1]}-${person}`, event);
        }
      }
    }
  }

  const baseRows: { start: string; end: string }[] = [];
  for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
    baseRows.push({ start: TIME_SLOTS[i], end: TIME_SLOTS[i + 1] });
  }

  const allRows = [...baseRows];
  for (const activity of schedule.activities) {
    const startMin = timeToMinutes(activity.start);
    const endMin = timeToMinutes(activity.end);
    if (startMin % 60 !== 0 || endMin % 60 !== 0) {
      const key = `${activity.start}-${activity.end}`;
      if (!allRows.some(r => `${r.start}-${r.end}` === key)) {
        allRows.push({ start: activity.start, end: activity.end });
      }
    }
  }

  allRows.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const seenSlots = new Set<string>();
  const uniqueRows = allRows.filter(r => {
    const key = `${r.start}-${r.end}`;
    if (seenSlots.has(key)) return false;
    seenSlots.add(key);
    return true;
  });

  function getCellContent(person: string, rowStart: string, rowEnd: string) {
    const timeKey = `${rowStart}-${rowEnd}`;
    const personMap = timeSlotMap.get(timeKey);
    if (personMap) {
      const entry = personMap.get(person);
      if (entry) return entry;
    }
    for (let i = 0; i < schedule.activities.length; i++) {
      const act = schedule.activities[i];
      const actStart = timeToMinutes(act.start);
      const actEnd = timeToMinutes(act.end);
      const rowStartMin = timeToMinutes(rowStart);
      const rowEndMin = timeToMinutes(rowEnd);
      if (actStart <= rowStartMin && actEnd >= rowEndMin && act.people.includes(person)) {
        return { activity: act, index: i };
      }
    }
    return null;
  }

  function getCalEvent(person: string, rowStart: string, rowEnd: string): CalendarEvent | null {
    return calEventRows.get(`${rowStart}-${rowEnd}-${person}`) || null;
  }

  function handleCellClick(person: string, rowStart: string, rowEnd: string) {
    if (!editMode) return;
    const existing = getCellContent(person, rowStart, rowEnd);
    if (existing) {
      setEditState({ active: true, activityIndex: existing.index, isNew: false, defaults: null });
    } else {
      setEditState({ active: true, activityIndex: -1, isNew: true, defaults: { start: rowStart, end: rowEnd, person } });
    }
  }

  /** Called from parent to open modal for new activity */
  function openNewActivityModal() {
    setEditState({ active: true, activityIndex: -1, isNew: true, defaults: { start: '07:00', end: '08:00', person: 'Jason' } });
  }

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleCellPointerDown(e: React.TouchEvent | React.MouseEvent, activity: Activity, person: string) {
    e.preventDefault(); // Prevent browser's native long-press menu
    e.stopPropagation();

    let x: number, y: number;
    if ('touches' in e) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    else { x = e.clientX; y = e.clientY; }
    longPressStartRef.current = { x, y };

    longPressTimerRef.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setShiftMenu({ activity, person, position: { x: rect.left, y: rect.top } });
    }, 500);
  }

  function handleCellPointerMove(e: React.TouchEvent | React.MouseEvent) {
    if (!longPressStartRef.current || !longPressTimerRef.current) return;
    let x: number, y: number;
    if ('touches' in e) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    else { x = e.clientX; y = e.clientY; }
    const dx = x - longPressStartRef.current.x;
    const dy = y - longPressStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleCellPointerUp(e: React.TouchEvent | React.MouseEvent, person: string, rowStart: string, rowEnd: string) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (editMode) handleCellClick(person, rowStart, rowEnd);
    }
    longPressStartRef.current = null;
  }

  function handleCellPointerCancel() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

  function handleShift(shiftMinutes: number, cascade: boolean) {
    if (!shiftMenu) return;
    const { activity, person } = shiftMenu;

    if (cascade && shiftMinutes !== 0) {
      const updated = shiftActivitiesFrom(schedule.activities, person, activity.start, shiftMinutes);
      for (let i = 0; i < updated.length; i++) {
        if (JSON.stringify(updated[i]) !== JSON.stringify(schedule.activities[i])) {
          onActivityUpdate(i, updated[i]);
        }
      }
    } else if (!cascade && shiftMinutes !== 0) {
      const updated = shiftSingleActivity(schedule.activities, activity.id, shiftMinutes);
      for (let i = 0; i < updated.length; i++) {
        if (JSON.stringify(updated[i]) !== JSON.stringify(schedule.activities[i])) {
          onActivityUpdate(i, updated[i]);
        }
      }
    }

    setShiftMenu(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const sourceId = active.id as string;
    const targetKey = over.id as string;

    const sourceActivity = schedule.activities.find(a => a.id === sourceId);
    if (!sourceActivity) return;

    const parts = targetKey.split('-');
    if (parts.length < 3) return;
    const targetPerson = parts[0];
    const targetStart = parts[1];

    const duration = timeToMinutes(sourceActivity.end) - timeToMinutes(sourceActivity.start);

    // Find if target cell has an activity for this person
    const targetActivity = schedule.activities.find(a =>
      a.id !== sourceId &&
      a.people.includes(targetPerson) &&
      a.start === targetStart
    );

    // Move source to target
    const sourceIdx = schedule.activities.findIndex(a => a.id === sourceId);
    if (sourceIdx >= 0) {
      onActivityUpdate(sourceIdx, {
        start: targetStart,
        end: minutesToTime(timeToMinutes(targetStart) + duration),
        people: [targetPerson],
      });
    }

    // Swap target to source position
    if (targetActivity) {
      const targetIdx = schedule.activities.findIndex(a => a.id === targetActivity.id);
      if (targetIdx >= 0) {
        const targetDuration = timeToMinutes(targetActivity.end) - timeToMinutes(targetActivity.start);
        onActivityUpdate(targetIdx, {
          start: sourceActivity.start,
          end: minutesToTime(timeToMinutes(sourceActivity.start) + targetDuration),
        });
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-auto flex-1">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10">
              <th className="bg-stone-800 text-stone-300 px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase w-28 sticky top-0">
                Time
              </th>
              {PEOPLE.map(person => (
                <th key={person} className="px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase sticky top-0"
                  style={{ backgroundColor: PERSON_COLORS[person].bg, color: PERSON_COLORS[person].dot }}>
                  {person}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueRows.map((row, rowIdx) => {
              const isCurrent = currentTime >= row.start && currentTime < row.end;
              const isPast = currentTime >= row.end;
              return (
                <tr
                  key={`${row.start}-${row.end}`}
                  className={`border-b border-stone-100 last:border-0 transition-opacity ${
                    isPast ? 'opacity-40' :
                    isCurrent ? 'bg-orange-50' :
                    rowIdx % 2 === 1 ? 'bg-stone-50/50' : ''
                  }`}
                >
                  <td className={`px-3 py-3 text-center text-sm font-semibold align-middle whitespace-nowrap ${isCurrent ? 'text-orange-600' : 'text-stone-400'}`}>
                    <div>
                      {formatTimeDisplay(row.start).replace(':00', '').replace(' ', '').toLowerCase()}
                      <span className="text-stone-300 mx-0.5">-</span>
                      {formatTimeDisplay(row.end).replace(':00', '').replace(' ', '').toLowerCase()}
                    </div>
                    {isCurrent && (
                      <span className="inline-block mt-0.5 bg-orange-500 text-white px-1.5 py-px rounded-full text-[9px] font-bold tracking-wide animate-pulse">
                        NOW
                      </span>
                    )}
                  </td>
                  {PEOPLE.map(person => {
                    const cellData = getCellContent(person, row.start, row.end);
                    const calEvent = getCalEvent(person, row.start, row.end);
                    // Calendar events take priority
                    if (calEvent) {
                      return (
                        <td
                          key={person}
                          className="px-3 py-2.5 text-center text-sm align-middle"
                          style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
                          title={`${calEvent.summary}${calEvent.location ? ' @ ' + calEvent.location : ''}`}
                        >
                          <span className="leading-tight block font-semibold">{calEvent.summary}</span>
                        </td>
                      );
                    }
                    if (cellData) {
                      const { activity, index } = cellData;
                      const typeColor = ACTIVITY_COLORS[activity.type] || '#ffffff';
                      const personBorder = PERSON_COLORS[person]?.border || '#d1d5db';
                      return (
                        <DraggableActivityCell
                          key={person}
                          activity={activity}
                          person={person}
                          rowStart={row.start}
                          rowEnd={row.end}
                          editMode={editMode}
                          typeColor={typeColor}
                          personBorder={personBorder}
                          onToggleComplete={() => onToggleComplete(index)}
                          onPointerDown={e => handleCellPointerDown(e, activity, person)}
                          onPointerMove={e => handleCellPointerMove(e)}
                          onPointerUp={e => handleCellPointerUp(e, person, row.start, row.end)}
                          onPointerCancel={handleCellPointerCancel}
                        />
                      );
                    }
                    return (
                      <DroppableCell
                        key={person}
                        person={person}
                        rowStart={row.start}
                        rowEnd={row.end}
                        editMode={editMode}
                        personBorderColor={PERSON_COLORS[person]?.border || '#e7e5e4'}
                        onClick={() => handleCellClick(person, row.start, row.end)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </DndContext>
      </div>

      {/* Activity Modal */}
      {editState.active && (
        <ActivityModal
          schedule={schedule}
          editState={editState}
          onUpdate={onActivityUpdate}
          onAdd={onActivityAdd}
          onRemove={onActivityRemove}
          onClose={() => setEditState({ active: false, activityIndex: -1, isNew: false, defaults: null })}
        />
      )}

      {/* Shift cascade menu */}
      {shiftMenu && (
        <ShiftMenu
          activity={shiftMenu.activity}
          person={shiftMenu.person}
          allActivities={schedule.activities}
          position={shiftMenu.position}
          onShift={handleShift}
          onClose={() => setShiftMenu(null)}
        />
      )}
    </div>
  );
}

function getTypeTextColor(type: ActivityType): string {
  const textColors: Record<ActivityType, string> = {
    routine: '#1b5e20', meal: '#f57f17', personal: '#0d47a1', work: '#4a148c',
    family: '#e65100', school: '#004d40', activity: '#880e4f', break: '#424242', other: '#212121'
  };
  return textColors[type] || '#212121';
}

const TYPE_LABELS: Record<ActivityType, string> = {
  routine: 'Routine', meal: 'Meal', personal: 'Personal', work: 'Work',
  family: 'Family', school: 'School', activity: 'Activity', break: 'Break', other: 'Other'
};

function DraggableActivityCell({
  activity, person, rowStart, rowEnd, editMode, typeColor, personBorder,
  onToggleComplete, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
}: {
  activity: Activity;
  person: string;
  rowStart: string;
  rowEnd: string;
  editMode: boolean;
  typeColor: string;
  personBorder: string;
  onToggleComplete: () => void;
  onPointerDown: (e: any) => void;
  onPointerMove: (e: any) => void;
  onPointerUp: (e: any) => void;
  onPointerCancel: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: activity.id,
    disabled: !editMode,
  });

  return (
    <td
      ref={setNodeRef}
      className={`px-3 py-2.5 text-center text-sm align-middle transition-all ${
        activity.completed ? 'opacity-40' : ''
      } ${isDragging ? 'opacity-60 shadow-lg ring-2 ring-orange-400 scale-105' : ''} ${
        editMode ? 'cursor-pointer hover:brightness-95' : ''
      }`}
      style={{
        backgroundColor: activity.completed ? '#f5f5f4' : typeColor,
        color: activity.completed ? '#a8a29e' : getTypeTextColor(activity.type),
        borderLeft: `3px solid ${personBorder}`,
        position: 'relative' as const,
      }}
      onTouchStart={(e: any) => { onPointerDown(e); (listeners as any).onTouchStart?.(e); }}
      onTouchMove={(e: any) => { onPointerMove(e); (listeners as any).onTouchMove?.(e); }}
      onTouchEnd={(e: any) => { onPointerUp(e); (listeners as any).onTouchEnd?.(e); }}
      onTouchCancel={(e: any) => { onPointerCancel(); (listeners as any).onTouchCancel?.(e); }}
      onMouseDown={(e: any) => { onPointerDown(e); (listeners as any).onMouseDown?.(e); }}
      onMouseMove={(e: any) => { onPointerMove(e); (listeners as any).onMouseMove?.(e); }}
      onMouseUp={(e: any) => { onPointerUp(e); (listeners as any).onMouseUp?.(e); }}
      onMouseLeave={(e: any) => { onPointerCancel(); (listeners as any).onMouseLeave?.(e); }}
      onContextMenu={e => e.preventDefault()}
      {...attributes}
    >
      <div className="flex items-center gap-1.5 justify-center">
        <button
          onClick={e => { e.stopPropagation(); onToggleComplete(); }}
          className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center transition-all ${
            activity.completed
              ? 'bg-green-500 text-white'
              : 'bg-white/60 border border-stone-300 hover:border-green-400 hover:bg-green-50'
          }`}
          title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {activity.completed && (
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>
        <span className={`leading-tight ${activity.completed ? 'line-through' : 'font-medium'}`}>
          {activity.title}
        </span>
      </div>
    </td>
  );
}

function DroppableCell({
  person, rowStart, rowEnd, editMode, personBorderColor, onClick,
}: {
  person: string;
  rowStart: string;
  rowEnd: string;
  editMode: boolean;
  personBorderColor: string;
  onClick: () => void;
}) {
  const cellKey = `${person}-${rowStart}-${rowEnd}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellKey });

  return (
    <td
      ref={setNodeRef}
      className={`px-3 py-3 text-center align-middle transition-all ${
        isOver ? 'bg-orange-50 ring-2 ring-orange-300 ring-inset' : ''
      } ${editMode ? 'cursor-pointer hover:bg-stone-50' : ''}`}
      style={{ borderLeft: `3px solid ${personBorderColor}33` }}
      onClick={onClick}
    >
      {editMode && (
        <span className="text-stone-200 text-xs opacity-0 hover:opacity-100 transition-opacity text-lg leading-none">+</span>
      )}
    </td>
  );
}

function ActivityModal({
  schedule,
  editState,
  onUpdate,
  onAdd,
  onRemove,
  onClose
}: {
  schedule: Schedule;
  editState: { active: boolean; activityIndex: number; isNew: boolean; defaults: { start: string; end: string; person: string } | null };
  onUpdate: (index: number, updates: Partial<Activity>) => void;
  onAdd: (start: string, end: string, person: string) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}) {
  const existing = !editState.isNew && editState.activityIndex >= 0 ? schedule.activities[editState.activityIndex] : null;

  const [title, setTitle] = useState(existing?.title || '');
  const [start, setStart] = useState(existing?.start || editState.defaults?.start || '07:00');
  const [end, setEnd] = useState(existing?.end || editState.defaults?.end || '08:00');
  const [type, setType] = useState<ActivityType>(existing?.type || 'other');
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    existing?.people || (editState.defaults?.person ? [editState.defaults.person] : ['Jason'])
  );
  const [notes, setNotes] = useState(existing?.notes || '');

  function togglePerson(person: string) {
    setSelectedPeople(prev => {
      if (prev.includes(person)) {
        if (prev.length === 1) return prev; // must keep at least 1
        return prev.filter(p => p !== person);
      }
      return [...prev, person];
    });
  }

  function handleSave() {
    if (!title.trim()) return;
    if (editState.isNew) {
      onAdd(start, end, selectedPeople[0] || 'Jason');
      // After adding, update with full details
      // The add creates a basic activity, then we update the last one
      const newIdx = schedule.activities.length; // will be the new index
      setTimeout(() => {
        onUpdate(newIdx, {
          title: title.trim(), start, end, type,
          color: ACTIVITY_COLORS[type],
          people: selectedPeople,
          notes
        });
      }, 50);
    } else {
      onUpdate(editState.activityIndex, {
        title: title.trim(), start, end, type,
        color: ACTIVITY_COLORS[type],
        people: selectedPeople,
        notes
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-stone-800">{editState.isNew ? 'New Activity' : 'Edit Activity'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Title</label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-300 outline-none"
            placeholder="What's happening?"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSave(); if (e.key === 'Escape') onClose(); }}
          />
        </div>

        {/* Time */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Time</label>
          <div className="flex gap-2 items-center">
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-sm focus:border-stone-500 outline-none text-center" />
            <span className="text-stone-300 font-medium">to</span>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-sm focus:border-stone-500 outline-none text-center" />
          </div>
        </div>

        {/* Who */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Who</label>
          <div className="flex gap-2">
            {PEOPLE.map(person => {
              const isActive = selectedPeople.includes(person);
              return (
                <button
                  key={person}
                  onClick={() => togglePerson(person)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
                    isActive
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'
                  }`}
                  style={isActive ? { backgroundColor: PERSON_COLORS[person]?.dot || '#666' } : {}}
                >
                  {person}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Type</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(ACTIVITY_COLORS) as [ActivityType, string][]).map(([t, color]) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border-2 ${
                  type === t ? 'border-stone-600 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: color, color: getTypeTextColor(t) }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Notes</label>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:border-stone-500 outline-none"
            placeholder="Optional notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 bg-stone-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-700 transition disabled:opacity-40"
          >
            {editState.isNew ? 'Add Activity' : 'Save Changes'}
          </button>
          {!editState.isNew && (
            <button
              onClick={() => { onRemove(editState.activityIndex); onClose(); }}
              className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
