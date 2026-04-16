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
} from '@/lib/time';
import { shiftActivitiesFrom, shiftSingleActivity } from '@/lib/shiftCascade';
import ShiftMenu from './ShiftMenu';
import DropModal, { type PendingDrop } from './DropModal';

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
  onActivitiesUpdate: (updates: { index: number; updates: Partial<Activity> }[]) => void;
  onActivityAdd: (start: string, end: string, person: string) => void;
  onActivityCreate: (activity: Activity) => void;
  onActivityRemove: (index: number) => void;
  onToggleComplete: (index: number) => void;
  onCalendarEventOverride: (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => void;
  editMode: boolean;
  triggerNewActivity?: number;
}

export default function ScheduleGrid({
  schedule,
  currentTime,
  onActivityUpdate,
  onActivitiesUpdate,
  onActivityAdd,
  onActivityCreate,
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

  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const justDraggedRef = useRef(false);

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

  function executeSwap() {
    if (!pendingDrop) return;
    const { srcActivity, srcPerson, srcTime, destActivity, destPerson, destTime, destEndTime } = pendingDrop;
    if (!destActivity) {
      executeMove();
      return;
    }

    const sourceIdx = schedule.activities.findIndex(a => a.id === srcActivity.id);
    const destIdx = schedule.activities.findIndex(a => a.id === destActivity.id);
    const destDuration = timeToMinutes(destActivity.end) - timeToMinutes(destActivity.start);

    // Source activity: move to dest time, swap people
    const newSrcPeople = srcActivity.people.filter(p => p !== srcPerson);
    if (!newSrcPeople.includes(destPerson)) newSrcPeople.push(destPerson);

    // Destination activity: move to source time, swap people
    const newDestPeople = destActivity.people.filter(p => p !== destPerson);
    if (!newDestPeople.includes(srcPerson)) newDestPeople.push(srcPerson);

    onActivitiesUpdate([
      {
        index: sourceIdx,
        updates: {
          start: destTime,
          end: destEndTime,
          people: newSrcPeople,
        },
      },
      {
        index: destIdx,
        updates: {
          start: srcActivity.start,
          end: srcActivity.end,
          people: newDestPeople,
        },
      },
    ]);
    setPendingDrop(null);
  }

  function executeCopy() {
    if (!pendingDrop) return;
    const { srcActivity, destPerson, destTime, destEndTime } = pendingDrop;

    onActivityCreate({
      id: `act-${Date.now()}`,
      title: srcActivity.title,
      start: destTime,
      end: destEndTime,
      people: [destPerson],
      type: srcActivity.type,
      color: srcActivity.color,
      notes: srcActivity.notes,
    });
    setPendingDrop(null);
  }

  function executeMove() {
    if (!pendingDrop) return;
    const { srcActivity, srcPerson, destPerson, destTime, destEndTime } = pendingDrop;

    const sourceIdx = schedule.activities.findIndex(a => a.id === srcActivity.id);

    // Remove source person, add dest person
    const newPeople = srcActivity.people.filter(p => p !== srcPerson);
    if (!newPeople.includes(destPerson)) newPeople.push(destPerson);

    onActivityUpdate(sourceIdx, {
      start: destTime,
      end: destEndTime,
      people: newPeople,
    });
    setPendingDrop(null);
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

  // =========================================================
  // Pointer-events drag-and-drop
  // =========================================================

  // Refs for data the drag effect needs — avoids re-running the effect when data changes.
  // This is the critical fix: the useEffect used to depend on schedule.activities,
  // uniqueRows, and getCellContent, which are recreated every render. That caused the
  // effect to re-run mid-drag, resetting all local state (timer, dragging, ghost, etc.)
  // and destroying the drag operation. Now we use refs so the effect only runs once.
  const uniqueRowsRef = useRef(uniqueRows);
  uniqueRowsRef.current = uniqueRows;
  const getCellContentRef = useRef(getCellContent);
  getCellContentRef.current = getCellContent;
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const tableEl = scrollEl?.querySelector('table');
    if (!scrollEl || !tableEl) return;

    const HOLD_MS = 150;
    const MOVE_PX = 10;
    const GHOST_OFFSET_Y = 70;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let dragging = false;
    let activePointerId = -1;
    let sourceCell: HTMLElement | null = null;
    let sourceKey = '';
    let sourcePerson = '';
    let sourceSlot = '';
    let sourceActivity: Activity | null = null;
    let sourceIndex = -1;
    let ghost: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;
    let hoveredCell: HTMLElement | null = null;

    function closestCell(el: Element | null): HTMLElement | null {
      let node: Element | null = el;
      while (node && node.tagName !== 'TABLE') {
        if (node.tagName === 'TD' && (node as HTMLElement).dataset.cellkey) {
          return node as HTMLElement;
        }
        node = node.parentElement;
      }
      return null;
    }

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (ghost) { ghost.remove(); ghost = null; }
      if (sourceCell) {
        sourceCell.style.opacity = '';
        sourceCell.style.outline = '';
        sourceCell.style.outlineOffset = '';
      }
      if (hoveredCell) {
        hoveredCell.style.outline = '';
        hoveredCell = null;
      }
      dragging = false;
      activePointerId = -1;
      sourceCell = null;
      sourceActivity = null;
      sourceIndex = -1;
    }

    function createGhost(cell: HTMLElement) {
      const rect = cell.getBoundingClientRect();
      ghost = document.createElement('div');
      ghost.textContent = sourceActivity?.title || '';
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top - GHOST_OFFSET_Y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: '9999',
        pointerEvents: 'none',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: '#fff',
        color: '#1c1917',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 8px 25px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
        opacity: '0.92',
        willChange: 'transform',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: `4px solid ${PERSON_COLORS[sourcePerson]?.border || '#78716c'}`,
      });
      document.body.appendChild(ghost);
    }

    function moveGhost(cx: number, cy: number) {
      if (!ghost) return;
      ghost.style.transform = `translate3d(${cx - startX}px, ${cy - startY - GHOST_OFFSET_Y}px, 0)`;
    }

    function highlightTarget(cx: number, cy: number) {
      if (hoveredCell) {
        hoveredCell.style.outline = '';
        hoveredCell = null;
      }
      if (!ghost) return;

      ghost.style.display = 'none';
      const el = document.elementFromPoint(cx, cy);
      ghost.style.display = '';

      const cell = closestCell(el);
      if (cell && cell !== sourceCell) {
        cell.style.outline = '2px solid #60a5fa';
        hoveredCell = cell;
      }
    }

    function doDrop(cx: number, cy: number) {
      if (!ghost) return;

      ghost.style.display = 'none';
      const el = document.elementFromPoint(cx, cy);
      ghost.style.display = '';

      const destCell = closestCell(el);
      if (!destCell || !destCell.dataset.cellkey) return;
      if (destCell === sourceCell) return;

      const destKey = destCell.dataset.cellkey;
      const [destPerson, destSlot] = destKey.split('::');
      if (!destPerson || !destSlot) return;

      // Use refs to read current data instead of closing over render-time values
      const rows = uniqueRowsRef.current;
      const destRow = rows.find(r => r.start === destSlot);
      const destRowEnd = destRow ? destRow.end : minutesToTime(timeToMinutes(destSlot) + 60);
      const destCellData = getCellContentRef.current(destPerson, destSlot, destRowEnd);

      if (!sourceActivity) return;
      const srcDuration = timeToMinutes(sourceActivity.end) - timeToMinutes(sourceActivity.start);
      const destEndTime = minutesToTime(timeToMinutes(destSlot) + srcDuration);

      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);

      const destRect = destCell.getBoundingClientRect();
      const dropX = destRect.left + destRect.width / 2 - 130;
      const dropY = destRect.top;

      setPendingDrop({
        srcActivity: sourceActivity,
        srcPerson: sourcePerson,
        srcTime: sourceSlot,
        destActivity: destCellData?.activity ?? null,
        destPerson,
        destTime: destSlot,
        destEndTime,
        dropPosition: { x: dropX, y: dropY },
      });
    }

    // Block browser scrolling during active drag via touchmove preventDefault.
    // This is the ONLY reliable way to stop an in-progress touch scroll —
    // CSS touch-action is read once at pointerdown and cannot be changed mid-gesture.
    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      e.preventDefault();
    }

    function onPointerDown(e: PointerEvent) {
      if (!editModeRef.current) return;
      if (activePointerId !== -1) return; // Already tracking a pointer
      const cell = closestCell(e.target as Element);
      if (!cell?.dataset.cellkey) return;

      const [person, slot] = cell.dataset.cellkey.split('::');
      if (!person || !slot) return;

      const rows = uniqueRowsRef.current;
      const row = rows.find(r => r.start === slot);
      const rowEnd = row ? row.end : minutesToTime(timeToMinutes(slot) + 60);
      const cellData = getCellContentRef.current(person, slot, rowEnd);
      if (!cellData) return;

      startX = e.clientX;
      startY = e.clientY;
      sourceCell = cell;
      sourceKey = cell.dataset.cellkey;
      sourcePerson = person;
      sourceSlot = slot;
      sourceActivity = cellData.activity;
      sourceIndex = cellData.index;
      activePointerId = e.pointerId;

      // During the hold-to-drag window, the browser scrolls freely (touchAction: pan-y).
      // If the hold timer fires, we commit to drag and block scrolling via touchmove preventDefault.
      const pointerId = e.pointerId;
      timer = setTimeout(() => {
        if (!sourceCell) return;
        timer = null;
        dragging = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        sourceCell.style.opacity = '0.35';
        sourceCell.style.outline = '2px dashed #999';
        sourceCell.style.outlineOffset = '-2px';
        sourceCell.setPointerCapture(pointerId);
        createGhost(sourceCell);
        moveGhost(startX, startY);
      }, HOLD_MS);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return;
      if (timer && !dragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_PX) {
          clearTimeout(timer);
          timer = null;
          sourceCell = null;
          sourceActivity = null;
          sourceIndex = -1;
          activePointerId = -1;
        }
        return;
      }
      if (!dragging) return;

      moveGhost(e.clientX, e.clientY);
      highlightTarget(e.clientX, e.clientY);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== activePointerId && !dragging) {
        cleanup();
        return;
      }
      if (!dragging) {
        cleanup();
        return;
      }
      doDrop(e.clientX, e.clientY);
      cleanup();
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 300);
    }

    function onPointerCancel() { cleanup(); }

    tableEl.addEventListener('pointerdown', onPointerDown);
    tableEl.addEventListener('pointermove', onPointerMove);
    tableEl.addEventListener('pointerup', onPointerUp);
    tableEl.addEventListener('pointercancel', onPointerCancel);
    // touchmove with passive:false lets us call preventDefault to block scrolling during drag
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      cleanup();
      tableEl.removeEventListener('pointerdown', onPointerDown);
      tableEl.removeEventListener('pointermove', onPointerMove);
      tableEl.removeEventListener('pointerup', onPointerUp);
      tableEl.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div
        ref={scrollContainerRef}
        className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-auto flex-1"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <table className="w-full border-collapse md:min-w-[540px]">
          <thead>
            <tr className="sticky top-0 z-10">
              <th className="bg-stone-800 text-stone-300 px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase w-28 md:w-20 sticky top-0">
                Time
              </th>
              {PEOPLE.map(person => (
                <th key={person} className="px-3 py-3 md:py-2 text-center text-sm md:text-[10px] font-semibold tracking-wider uppercase sticky top-0"
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
                  className={`border-b border-stone-100 last:border-0 ${
                    isPast ? 'opacity-40' :
                    isCurrent ? 'bg-orange-50' :
                    rowIdx % 2 === 1 ? 'bg-stone-50/50' : ''
                  }`}
                >
                  <td
                    className={`px-3 py-3 md:w-20 text-center text-sm font-semibold align-middle whitespace-nowrap ${isCurrent ? 'text-orange-600' : 'text-stone-400'}`}
                    style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: isCurrent ? '#fff7ed' : rowIdx % 2 === 1 ? '#fafaf9' : '#ffffff' }}
                  >
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
                    const cellKey = `${person}::${row.start}`;

                    // Calendar events are read-only, not draggable
                    if (calEvent) {
                      return (
                        <td
                          key={person}
                          className="px-3 py-3 text-center text-sm align-middle"
                          style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
                        >
                          <span className="leading-tight block font-semibold">{calEvent.summary}</span>
                        </td>
                      );
                    }

                    // Activity cell — plain <td> with data-cellkey
                    if (cellData) {
                      const { activity, index } = cellData;
                      const typeColor = ACTIVITY_COLORS[activity.type] || '#ffffff';
                      const personBorder = PERSON_COLORS[person]?.border || '#d1d5db';

                      return (
                        <td
                          key={person}
                          data-cellkey={cellKey}
                          className="px-0 py-0 align-middle"
                          style={{ borderLeft: `3px solid ${personBorder}`, userSelect: 'none', WebkitUserSelect: 'none' }}
                          onClick={() => {
                            if (justDraggedRef.current) return;
                            if (editMode) handleCellClick(person, row.start, row.end);
                          }}
                          onContextMenu={e => e.preventDefault()}
                        >
                          <div
                            className={`px-3 py-3 text-center text-sm ${
                              activity.completed ? 'opacity-40' : ''
                            } ${editMode ? 'cursor-pointer' : ''}`}
                            style={{
                              backgroundColor: activity.completed
                                ? '#f5f5f4'
                                : typeColor,
                              color: activity.completed ? '#a8a29e' : getTypeTextColor(activity.type),
                              userSelect: 'none',
                              WebkitUserSelect: 'none',
                              minHeight: 44,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              pointerEvents: 'none',
                            }}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); onToggleComplete(index); }}
                              className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                                activity.completed
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white/60 border border-stone-300'
                              }`}
                              title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                              style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
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
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                const rect = (e.currentTarget.closest('td') as HTMLElement).getBoundingClientRect();
                                setShiftMenu({ activity, person, position: { x: rect.left, y: rect.top } });
                              }}
                              className="ml-auto hidden lg:flex opacity-40 hover:opacity-100 text-stone-400 hover:text-orange-500 touch-show transition-opacity"
                              title="Shift times"
                              style={{ touchAction: 'manipulation', pointerEvents: 'auto', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 8l4-4 4 4M4 12l4-4 4 4" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      );
                    }

                    // Empty cell — plain <td> with data-cellkey
                    return (
                      <td
                        key={person}
                        data-cellkey={cellKey}
                        className="px-0 py-0 align-middle"
                        style={{ borderLeft: `3px solid ${PERSON_COLORS[person]?.border || '#e7e5e4'}33`, userSelect: 'none', WebkitUserSelect: 'none' }}
                        onClick={() => {
                          if (justDraggedRef.current) return;
                          if (editMode) handleCellClick(person, row.start, row.end);
                        }}
                        onContextMenu={e => e.preventDefault()}
                      >
                        <div
                          className={`px-3 py-3 text-center ${
                            editMode ? 'cursor-pointer' : ''
                          }`}
                          style={{
                            minHeight: 44,
                            pointerEvents: 'none',
                          }}
                        >
                          {editMode && (
                            <span className="text-stone-300 text-lg leading-none touch-show" style={{ opacity: 0.5 }}>+</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
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

      {/* Drop choice modal */}
      {pendingDrop && (
        <DropModal
          pending={pendingDrop}
          allActivities={schedule.activities}
          onSwap={executeSwap}
          onCopy={executeCopy}
          onMove={executeMove}
          onClose={() => setPendingDrop(null)}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
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
