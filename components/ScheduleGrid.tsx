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
  currentTime: string;
  onActivityUpdate: (index: number, updates: Partial<Activity>) => void;
  onActivityAdd: (start: string, end: string, person: string) => void;
  onActivityRemove: (index: number) => void;
  onToggleComplete: (index: number) => void;
  onCalendarEventOverride: (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => void;
  editMode: boolean;
  triggerNewActivity?: number;
}

interface DragState {
  activity: Activity;
  person: string;
  fromRowStart: string;
  fromRowEnd: string;
  pointerId: number;
  currentX: number;
  currentY: number;
  overPerson: string | null;
  overRowStart: string | null;
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

  const [dragState, setDragState] = useState<DragState | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const isDraggingRef = useRef(false);

  // Non-passive touchmove listener to prevent scrolling during drag/long-press.
  // Uses a ref to avoid stale closure — the handler always reads the current value.
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (isDraggingRef.current || longPressStartRef.current) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  // Keep isDraggingRef in sync with dragState
  useEffect(() => {
    isDraggingRef.current = dragState !== null;
  }, [dragState]);

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

  function getEventPeople(event: CalendarEvent): string[] {
    if (event.overridePeople) return event.overridePeople;
    if (event.people) return event.people;
    if (event.person) return [event.person];
    return ['Jason'];
  }

  const calEventRows = new Map<string, CalendarEvent>();
  for (const event of schedule.calendarEvents || []) {
    if (event.enabled === false) continue;
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

  /** Find which cell (person + row) is at a given x,y position */
  function findCellAtPosition(x: number, y: number): { person: string; rowStart: string; rowEnd: string } | null {
    if (!tableRef.current) return null;
    const rows = tableRef.current.querySelectorAll('tbody tr');
    for (const row of Array.from(rows)) {
      const cells = row.querySelectorAll('td');
      // cells[0] is time, cells[1..4] are people
      for (let i = 1; i < cells.length; i++) {
        const rect = cells[i].getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          const person = PEOPLE[i - 1];
          const timeCell = cells[0];
          const text = timeCell.textContent || '';
          // Find row start/end from the data
          const rowEl = row as HTMLTableRowElement;
          // Use uniqueRows to find matching row
          const rowIdx = Array.from(rows).indexOf(row);
          if (rowIdx >= 0 && rowIdx < uniqueRows.length) {
            return { person, rowStart: uniqueRows[rowIdx].start, rowEnd: uniqueRows[rowIdx].end };
          }
        }
      }
    }
    return null;
  }

  function handleCellPointerDown(
    e: React.PointerEvent,
    activity: Activity,
    person: string,
    rowStart: string,
    rowEnd: string
  ) {
    const { pointerId, clientX: x, clientY: y } = e;
    longPressStartRef.current = { x, y, pointerId };
    longPressFiredRef.current = false;

    // Capture the pointer so we keep receiving move/up even if finger leaves the cell
    (e.currentTarget as HTMLElement).setPointerCapture(pointerId);

    // Capture element position now (currentTarget nullified after handler returns)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = { x: rect.left, y: rect.top };

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setShiftMenu({ activity, person, position: pos });
    }, 500);
  }

  function handleCellPointerMove(
    e: React.PointerEvent,
    sourceActivity: Activity,
    sourcePerson: string,
    sourceRowStart: string,
    sourceRowEnd: string
  ) {
    if (!longPressStartRef.current) return;
    const { clientX: x, clientY: y } = e;
    const dx = x - longPressStartRef.current.x;
    const dy = y - longPressStartRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Threshold crossed for the first time — cancel long-press timer and start drag
    if (dist > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;

      // If the shift menu was already showing, dismiss it
      if (longPressFiredRef.current) {
        setShiftMenu(null);
        longPressFiredRef.current = false;
      }

      const target = findCellAtPosition(x, y);
      setDragState({
        activity: sourceActivity,
        person: sourcePerson,
        fromRowStart: sourceRowStart,
        fromRowEnd: sourceRowEnd,
        pointerId: longPressStartRef.current.pointerId,
        currentX: x,
        currentY: y,
        overPerson: target?.person || null,
        overRowStart: target?.rowStart || null,
      });
    } else if (dist > 10 && !longPressTimerRef.current && !longPressFiredRef.current) {
      // Already dragging — just update position
      const target = findCellAtPosition(x, y);
      setDragState(prev => prev ? {
        ...prev,
        currentX: x,
        currentY: y,
        overPerson: target?.person || null,
        overRowStart: target?.rowStart || null,
      } : null);
    }
  }

  function handleCellPointerUp(person: string, rowStart: string, rowEnd: string) {
    // If a drag is active, perform the drop (swap)
    if (dragState && dragState.overPerson && dragState.overRowStart) {
      const sourceActivity = dragState.activity;
      const targetPerson = dragState.overPerson;
      const targetStart = dragState.overRowStart;

      // Don't drop on same position
      if (!(targetPerson === dragState.person && targetStart === dragState.fromRowStart)) {
        const duration = timeToMinutes(sourceActivity.end) - timeToMinutes(sourceActivity.start);

        // Find target activity (if any) for swap
        const targetActivity = schedule.activities.find(a =>
          a.id !== sourceActivity.id &&
          a.people.includes(targetPerson) &&
          a.start === targetStart
        );

        // Move source to target
        const sourceIdx = schedule.activities.findIndex(a => a.id === sourceActivity.id);
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
      setDragState(null);
      longPressStartRef.current = null;
      return;
    }

    // Normal tap (short press, no move) → open edit modal
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (editMode && !longPressFiredRef.current) handleCellClick(person, rowStart, rowEnd);
    }
    longPressStartRef.current = null;
    setDragState(null);
  }

  function handleCellPointerCancel() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
    setDragState(null);
    setShiftMenu(null);
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

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-auto flex-1">
        <table ref={tableRef} className="w-full border-collapse" onContextMenu={e => e.preventDefault()}>
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
              const isDragTarget = dragState?.overRowStart === row.start;
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
                    const isDragSource = dragState?.activity?.id === cellData?.activity?.id;
                    const isDragOver = dragState?.overPerson === person && dragState?.overRowStart === row.start;

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
                        <td
                          key={person}
                          className={`px-3 py-2.5 text-center text-sm align-middle transition-all ${
                            activity.completed ? 'opacity-40' : ''
                          } ${isDragSource ? 'opacity-40 ring-2 ring-orange-400' : ''} ${
                            isDragOver && !isDragSource ? 'ring-2 ring-orange-300 ring-inset bg-orange-50' : ''
                          } ${editMode ? 'cursor-pointer hover:brightness-95' : ''}`}
                          style={{
                            backgroundColor: activity.completed ? '#f5f5f4' : typeColor,
                            color: activity.completed ? '#a8a29e' : getTypeTextColor(activity.type),
                            borderLeft: `3px solid ${personBorder}`,
                            position: 'relative' as const,
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            WebkitTouchCallout: 'none',
                            touchAction: 'none',
                          }}
                          onPointerDown={e => handleCellPointerDown(e, activity, person, row.start, row.end)}
                          onPointerMove={e => handleCellPointerMove(e, activity, person, row.start, row.end)}
                          onPointerUp={() => handleCellPointerUp(person, row.start, row.end)}
                          onPointerCancel={handleCellPointerCancel}
                          onContextMenu={e => e.preventDefault()}
                        >
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              onClick={e => { e.stopPropagation(); onToggleComplete(index); }}
                              className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center transition-all ${
                                activity.completed
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white/60 border border-stone-300 hover:border-green-400 hover:bg-green-50'
                              }`}
                              title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                              onPointerDown={e => e.stopPropagation()}
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
                    return (
                      <td
                        key={person}
                        className={`px-3 py-3 text-center align-middle transition-all ${
                          isDragOver ? 'bg-orange-50 ring-2 ring-orange-300 ring-inset' : ''
                        } ${editMode ? 'cursor-pointer hover:bg-stone-50' : ''}`}
                        style={{ borderLeft: `3px solid ${PERSON_COLORS[person]?.border || '#e7e5e4'}33` }}
                        onClick={() => handleCellClick(person, row.start, row.end)}
                      >
                        {editMode && (
                          <span className="text-stone-200 text-xs opacity-0 hover:opacity-100 transition-opacity text-lg leading-none">+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drag ghost overlay */}
      {dragState && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-2 rounded-xl shadow-2xl ring-2 ring-orange-400 opacity-80"
          style={{
            left: dragState.currentX,
            top: dragState.currentY - 20,
            transform: 'translate(-50%, -50%)',
            backgroundColor: ACTIVITY_COLORS[dragState.activity.type] || '#fff',
            color: getTypeTextColor(dragState.activity.type),
            whiteSpace: 'nowrap',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {dragState.activity.title}
        </div>
      )}

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
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== person);
      }
      return [...prev, person];
    });
  }

  function handleSave() {
    if (!title.trim()) return;
    if (editState.isNew) {
      onAdd(start, end, selectedPeople[0] || 'Jason');
      const newIdx = schedule.activities.length;
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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-stone-800">{editState.isNew ? 'New Activity' : 'Edit Activity'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
        </div>
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
        <div className="mb-5">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Notes</label>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:border-stone-500 outline-none"
            placeholder="Optional notes..."
          />
        </div>
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
