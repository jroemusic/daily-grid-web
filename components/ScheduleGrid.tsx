'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

const DRAG_THRESHOLD = 6; // px before drag activates (prevents accidental drags)
const GHOST_OFFSET_Y = -70; // px above finger so user can see the ghost

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
  const [moveMode, setMoveMode] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag tracking — all imperative, no React state per pixel
  const dragDataRef = useRef<{
    activity: Activity;
    person: string;
    fromRowStart: string;
    fromRowEnd: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean; // becomes true after threshold
  } | null>(null);

  // Cached cell bounding rects — computed once on drag start
  const cachedRectsRef = useRef<Array<{
    person: string;
    rowStart: string;
    rowEnd: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> | null>(null);

  // Prevent scroll during drag via non-passive touchmove on table
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (dragDataRef.current) e.preventDefault();
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  // Respond to external "new activity" trigger
  useEffect(() => {
    if (triggerNewActivity && triggerNewActivity > 0) {
      setEditState({ active: true, activityIndex: -1, isNew: true, defaults: { start: '07:00', end: '08:00', person: 'Jason' } });
    }
  }, [triggerNewActivity]);

  // Add dragging-active class to container during drag for CSS transition disabling
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.toggle('dragging-active', dragState !== null);
    }
  }, [dragState]);

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

  /** Cache all cell bounding rects once (called on drag start) */
  function cacheCellRects() {
    if (!tableRef.current) return;
    const rows = tableRef.current.querySelectorAll('tbody tr');
    const rects: typeof cachedRectsRef.current = [];
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const cells = rows[rowIdx].querySelectorAll('td');
      if (rowIdx >= uniqueRows.length) continue;
      const row = uniqueRows[rowIdx];
      for (let i = 1; i < cells.length; i++) {
        const rect = cells[i].getBoundingClientRect();
        rects.push({
          person: PEOPLE[i - 1],
          rowStart: row.start,
          rowEnd: row.end,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        });
      }
    }
    cachedRectsRef.current = rects;
  }

  /** Find which cell is at position using cached rects (no DOM queries) */
  function findCellAtPosition(x: number, y: number): { person: string; rowStart: string; rowEnd: string } | null {
    const rects = cachedRectsRef.current;
    if (!rects) return null;
    for (const r of rects) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return { person: r.person, rowStart: r.rowStart, rowEnd: r.rowEnd };
      }
    }
    return null;
  }

  /** Move ghost element via imperative DOM (no React state) */
  function moveGhost(x: number, y: number) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.transform = `translate3d(${x}px, ${y + GHOST_OFFSET_Y}px, 0)`;
  }

  function showGhost(activity: Activity) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.textContent = activity.title;
    ghost.style.backgroundColor = ACTIVITY_COLORS[activity.type] || '#fff';
    ghost.style.color = getTypeTextColor(activity.type);
    ghost.style.display = 'block';
  }

  function hideGhost() {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.display = 'none';
  }

  // Highlight management — imperative DOM to avoid React re-renders
  const highlightRef = useRef<{ person: string; rowStart: string } | null>(null);

  function setHighlight(person: string | null, rowStart: string | null) {
    // Remove old highlight
    if (highlightRef.current) {
      const old = tableRef.current?.querySelector(
        `td[data-cell="${highlightRef.current.person}-${highlightRef.current.rowStart}"]`
      );
      if (old) {
        old.classList.remove('ring-2', 'ring-orange-300', 'ring-inset', 'bg-orange-50');
      }
      highlightRef.current = null;
    }
    // Add new highlight
    if (person && rowStart) {
      const cell = tableRef.current?.querySelector(`td[data-cell="${person}-${rowStart}"]`);
      if (cell) {
        cell.classList.add('ring-2', 'ring-orange-300', 'ring-inset', 'bg-orange-50');
      }
      highlightRef.current = { person, rowStart };
    }
  }

  function handleCellPointerDown(
    e: React.PointerEvent,
    activity: Activity,
    person: string,
    rowStart: string,
    rowEnd: string
  ) {
    if (!moveMode) return;
    const { pointerId, clientX: x, clientY: y } = e;

    // Capture pointer
    (e.currentTarget as HTMLElement).setPointerCapture(pointerId);

    // Prevent browser context menu on long-press
    e.preventDefault();

    // Store start data but don't activate drag yet (threshold check)
    dragDataRef.current = {
      activity,
      person,
      fromRowStart: rowStart,
      fromRowEnd: rowEnd,
      pointerId,
      startX: x,
      startY: y,
      active: false,
    };
  }

  function handleCellPointerMove(e: React.PointerEvent) {
    const drag = dragDataRef.current;
    if (!drag || !moveMode) return;

    const { clientX: x, clientY: y } = e;

    // Check threshold before activating drag
    if (!drag.active) {
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

      // Threshold crossed — activate drag
      drag.active = true;
      cacheCellRects();
      showGhost(drag.activity);

      // Set React state once for drag mode UI (source cell dimming, etc.)
      setDragState({
        activity: drag.activity,
        person: drag.person,
        fromRowStart: drag.fromRowStart,
        fromRowEnd: drag.fromRowEnd,
        pointerId: drag.pointerId,
        overPerson: drag.person,
        overRowStart: drag.fromRowStart,
      });

      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    // Move ghost imperatively (no React state)
    moveGhost(x, y);

    // Find target cell from cached rects
    const target = findCellAtPosition(x, y);

    // Update highlight imperatively
    setHighlight(target?.person || null, target?.rowStart || null);

    // Update drag state only for overPerson/overRowStart (used on drop)
    if (target) {
      dragDataRef.current = { ...drag, person: drag.person }; // keep identity, just for reference
      // Store latest target in a simple ref for drop
      (dragDataRef.current as any).lastTarget = target;
    }
  }

  function handleCellPointerUp() {
    const drag = dragDataRef.current;
    if (!drag) return;

    if (drag.active) {
      // Perform drop
      const target: { person: string; rowStart: string } | null = (drag as any).lastTarget || null;
      if (target && !(target.person === drag.person && target.rowStart === drag.fromRowStart)) {
        const sourceActivity = drag.activity;
        const duration = timeToMinutes(sourceActivity.end) - timeToMinutes(sourceActivity.start);

        // Find target activity for swap
        const targetActivity = schedule.activities.find(a =>
          a.id !== sourceActivity.id &&
          a.people.includes(target.person) &&
          a.start === target.rowStart
        );

        // Move source to target
        const sourceIdx = schedule.activities.findIndex(a => a.id === sourceActivity.id);
        if (sourceIdx >= 0) {
          onActivityUpdate(sourceIdx, {
            start: target.rowStart,
            end: minutesToTime(timeToMinutes(target.rowStart) + duration),
            people: [target.person],
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

        // Haptic on drop
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(20);
        }
      }

      hideGhost();
      setHighlight(null, null);
      cachedRectsRef.current = null;
    }

    dragDataRef.current = null;
    setDragState(null);
  }

  function handleCellPointerCancel() {
    dragDataRef.current = null;
    hideGhost();
    setHighlight(null, null);
    cachedRectsRef.current = null;
    setDragState(null);
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

  // Long-press handler for shift menu
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleActivityTouchStart(
    e: React.TouchEvent,
    activity: Activity,
    person: string,
  ) {
    if (moveMode || !editMode) return;
    const touch = e.touches[0];
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setShiftMenu({ activity, person, position: { x: rect.left, y: rect.top } });
      longPressTimerRef.current = null;
    }, 350);
  }

  function handleActivityTouchMove(e: React.TouchEvent) {
    if (!longPressTimerRef.current || !longPressStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - longPressStartRef.current.x;
    const dy = touch.clientY - longPressStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleActivityTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Move mode toggle + shift controls */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <button
          onClick={() => { setMoveMode(m => !m); setDragState(null); }}
          className={`px-4 py-2.5 rounded-md text-sm font-bold transition-colors ${
            moveMode
              ? 'bg-blue-600 text-white ring-2 ring-blue-300'
              : 'bg-stone-100 text-stone-500'
          }`}
          style={{ touchAction: 'manipulation' }}
        >
          {moveMode ? '↕ Moving ON — drag activities' : '↕ Move'}
        </button>
        {moveMode && (
          <span className="text-xs text-stone-400">Tap & drag an activity to a new slot.</span>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-auto flex-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table ref={tableRef} className="w-full border-collapse">
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
              const isDragSource = dragState?.activity?.id != null && getCellContent(dragState.person, row.start, row.end)?.activity?.id === dragState.activity.id;
              return (
                <tr
                  key={`${row.start}-${row.end}`}
                  className={`border-b border-stone-100 last:border-0 ${
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

                    if (calEvent) {
                      return (
                        <td
                          key={person}
                          className="px-3 py-3 text-center text-sm align-middle"
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
                          data-cell={`${person}-${row.start}`}
                          className={`px-3 py-3 text-center text-sm align-middle ${
                            activity.completed ? 'opacity-40' : ''
                          } ${isDragSource ? 'opacity-40 ring-2 ring-orange-400' : ''} ${
                            editMode ? (moveMode ? 'cursor-grab' : 'cursor-pointer') : ''
                          }`}
                          style={{
                            backgroundColor: activity.completed ? '#f5f5f4' : typeColor,
                            color: activity.completed ? '#a8a29e' : getTypeTextColor(activity.type),
                            borderLeft: `3px solid ${personBorder}`,
                            position: 'relative' as const,
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            ...(moveMode ? { touchAction: 'none' } : { touchAction: 'manipulation' }),
                          }}
                          onPointerDown={moveMode ? (e => handleCellPointerDown(e, activity, person, row.start, row.end)) : undefined}
                          onPointerMove={moveMode ? handleCellPointerMove : undefined}
                          onPointerUp={moveMode ? handleCellPointerUp : undefined}
                          onPointerCancel={moveMode ? handleCellPointerCancel : undefined}
                          onClick={!moveMode ? (() => handleCellClick(person, row.start, row.end)) : undefined}
                          onContextMenu={moveMode ? (e => e.preventDefault()) : undefined}
                          onTouchStart={!moveMode && editMode ? (e => handleActivityTouchStart(e, activity, person)) : undefined}
                          onTouchMove={!moveMode && editMode ? handleActivityTouchMove : undefined}
                          onTouchEnd={!moveMode && editMode ? handleActivityTouchEnd : undefined}
                        >
                          <div className="flex items-center gap-1.5 justify-center"
                            style={moveMode ? { touchAction: 'none', pointerEvents: 'none' } : {}}
                          >
                            {!moveMode && (
                              <button
                                onClick={e => { e.stopPropagation(); onToggleComplete(index); }}
                                className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                                  activity.completed
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/60 border border-stone-300'
                                }`}
                                title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                                style={{ touchAction: 'manipulation' }}
                              >
                                {activity.completed && (
                                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M2 6l3 3 5-5" />
                                  </svg>
                                )}
                              </button>
                            )}
                            <span className={`leading-tight ${activity.completed ? 'line-through' : 'font-medium'}`}>
                              {activity.title}
                            </span>
                            {!moveMode && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget.closest('td') as HTMLElement).getBoundingClientRect();
                                  setShiftMenu({ activity, person, position: { x: rect.left, y: rect.top } });
                                }}
                                className="ml-auto opacity-40 hover:opacity-100 text-stone-400 hover:text-orange-500 touch-show transition-opacity"
                                title="Shift times"
                                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 8l4-4 4 4M4 12l4-4 4 4" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={person}
                        data-cell={`${person}-${row.start}`}
                        className={`px-3 py-3 text-center align-middle ${
                          editMode ? 'cursor-pointer' : ''
                        }`}
                        style={{ borderLeft: `3px solid ${PERSON_COLORS[person]?.border || '#e7e5e4'}33`, touchAction: 'manipulation' }}
                        onClick={() => handleCellClick(person, row.start, row.end)}
                        onContextMenu={e => e.preventDefault()}
                      >
                        {editMode && (
                          <span className="text-stone-300 text-lg leading-none touch-show" style={{ opacity: 0.5 }}>+</span>
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

      {/* Drag ghost — always in DOM, positioned imperatively via transform */}
      <div
        ref={ghostRef}
        className="fixed pointer-events-none z-50 px-3 py-2 rounded-xl shadow-2xl ring-2 ring-orange-400 opacity-80 font-semibold"
        style={{
          display: 'none',
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
          whiteSpace: 'nowrap',
          fontSize: '14px',
          fontWeight: 600,
        }}
      />

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

  const backdropDownRef = useRef(false);
  const backdropStartRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Only close if click is directly on backdrop (not on modal content)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-stone-800">{editState.isNew ? 'New Activity' : 'Edit Activity'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-2 text-xl leading-none" style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
        </div>
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1.5">Title</label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-300 outline-none"
            placeholder="What's happening?"
            autoFocus
            style={{ touchAction: 'manipulation' }}
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
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                    isActive
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-stone-400 border-stone-200'
                  }`}
                  style={{ touchAction: 'manipulation', ...(isActive ? { backgroundColor: PERSON_COLORS[person]?.dot || '#666' } : {}) }}
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
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border-2 ${
                  type === t ? 'border-stone-600 shadow-sm' : 'border-transparent opacity-60'
                }`}
                style={{ backgroundColor: color, color: getTypeTextColor(t), touchAction: 'manipulation' }}
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
            style={{ touchAction: 'manipulation' }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 bg-stone-800 text-white py-3 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40"
            style={{ touchAction: 'manipulation' }}
          >
            {editState.isNew ? 'Add Activity' : 'Save Changes'}
          </button>
          {!editState.isNew && (
            <button
              onClick={() => { onRemove(editState.activityIndex); onClose(); }}
              className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
