// components/MobileScheduleView.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
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
import DropModal, { PendingDrop } from './DropModal';

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
  onActivitiesUpdate: (updates: { index: number; updates: Partial<Activity> }[]) => void;
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
  onActivitiesUpdate,
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
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const justDraggedRef = useRef(false);

  // Refs for drag effect — avoids re-running effect on data changes
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const selectedPersonRef = useRef(selectedPerson);
  selectedPersonRef.current = selectedPerson;
  const onActivityUpdateRef = useRef(onActivityUpdate);
  onActivityUpdateRef.current = onActivityUpdate;
  const onActivityAddRef = useRef(onActivityAdd);
  onActivityAddRef.current = onActivityAdd;

  // Drag-and-drop effect
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const HOLD_MS = 150;
    const MOVE_PX = 10;
    const GHOST_OFFSET_Y = 70;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let dragging = false;
    let activePointerId = -1;
    let sourceEl: HTMLElement | null = null;
    let sourceActivity: Activity | null = null;
    let sourceIndex = -1;
    let ghost: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;
    let hoveredEl: HTMLElement | null = null;

    function closestSlotRow(el: Element | null): HTMLElement | null {
      let node: Element | null = el;
      while (node && node !== listEl) {
        if ((node as HTMLElement).dataset.slot) return node as HTMLElement;
        node = node.parentElement;
      }
      return null;
    }

    function findActivityCard(el: Element | null): HTMLElement | null {
      let node: Element | null = el;
      while (node && node !== listEl) {
        if ((node as HTMLElement).dataset.activityIdx !== undefined) return node as HTMLElement;
        node = node.parentElement;
      }
      return null;
    }

    function createGhost(title: string) {
      ghost = document.createElement('div');
      ghost.textContent = title;
      Object.assign(ghost.style, {
        position: 'fixed',
        left: '16px',
        top: `${startY - GHOST_OFFSET_Y}px`,
        width: `${window.innerWidth - 32}px`,
        height: '48px',
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
        borderLeft: `4px solid ${PERSON_COLORS[selectedPersonRef.current]?.border || '#78716c'}`,
      });
      document.body.appendChild(ghost);
    }

    function moveGhost(cx: number, cy: number) {
      if (!ghost) return;
      ghost.style.transform = `translate3d(${cx - startX}px, ${cy - startY - GHOST_OFFSET_Y}px, 0)`;
    }

    function highlightTarget(cx: number, cy: number) {
      if (hoveredEl) {
        hoveredEl.style.boxShadow = '';
        hoveredEl = null;
      }
      if (!ghost) return;
      ghost.style.display = 'none';
      const el = document.elementFromPoint(cx, cy);
      ghost.style.display = '';
      const row = closestSlotRow(el);
      if (row && row !== sourceEl) {
        row.style.boxShadow = 'inset 0 0 0 2px #60a5fa';
        hoveredEl = row;
      }
    }

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (ghost) { ghost.remove(); ghost = null; }
      if (sourceEl) {
        sourceEl.style.opacity = '';
        sourceEl.style.boxShadow = '';
      }
      if (hoveredEl) {
        hoveredEl.style.boxShadow = '';
        hoveredEl = null;
      }
      dragging = false;
      activePointerId = -1;
      sourceEl = null;
      sourceActivity = null;
      sourceIndex = -1;
    }

    function doDrop(cx: number, cy: number) {
      if (!ghost) return;
      ghost.style.display = 'none';
      const el = document.elementFromPoint(cx, cy);
      ghost.style.display = '';
      const destRow = closestSlotRow(el);
      if (!destRow || !destRow.dataset.slot || destRow === sourceEl) return;
      if (!sourceActivity) return;

      const destSlot = destRow.dataset.slot;
      const person = selectedPersonRef.current;
      const srcDuration = timeToMinutes(sourceActivity.end) - timeToMinutes(sourceActivity.start);
      const destEndTime = minutesToTime(timeToMinutes(destSlot) + srcDuration);

      // Check for existing activity at destination
      const destActivity = personActivitiesRef.current.find(a => {
        const s = timeToMinutes(a.start);
        const e = timeToMinutes(a.end);
        const d = timeToMinutes(destSlot);
        return d >= s && d < e;
      }) || null;

      if (navigator.vibrate) navigator.vibrate(30);

      if (!destActivity) {
        // Empty slot — direct move
        onActivityUpdateRef.current(sourceIndex, { start: destSlot, end: destEndTime });
      } else {
        // Occupied — show drop modal
        setPendingDrop({
          srcActivity: sourceActivity,
          srcPerson: person,
          srcTime: sourceActivity.start,
          destActivity,
          destPerson: person,
          destTime: destSlot,
          destEndTime,
          dropPosition: { x: window.innerWidth / 2, y: 100 },
        });
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (activePointerId !== -1) return;
      const card = findActivityCard(e.target as Element);
      if (!card) return;
      const idx = parseInt(card.dataset.activityIdx || '-1', 10);
      if (idx < 0) return;
      const act = scheduleRef.current.activities[idx];
      if (!act) return;
      const row = closestSlotRow(card);
      if (!row) return;

      startX = e.clientX;
      startY = e.clientY;
      sourceEl = row;
      sourceActivity = act;
      sourceIndex = idx;
      activePointerId = e.pointerId;

      const pointerId = e.pointerId;
      timer = setTimeout(() => {
        if (!sourceEl) return;
        timer = null;
        dragging = true;
        if (navigator.vibrate) navigator.vibrate(50);
        sourceEl.style.opacity = '0.35';
        sourceEl.style.boxShadow = 'inset 0 0 0 2px #999';
        createGhost(act.title);
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
          cleanup();
        }
        return;
      }
      if (!dragging) return;
      moveGhost(e.clientX, e.clientY);
      highlightTarget(e.clientX, e.clientY);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== activePointerId && !dragging) { cleanup(); return; }
      if (!dragging) { cleanup(); return; }
      doDrop(e.clientX, e.clientY);
      cleanup();
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 300);
    }

    function onPointerCancel() { cleanup(); }

    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      e.preventDefault();
    }

    listEl.addEventListener('pointerdown', onPointerDown);
    listEl.addEventListener('pointermove', onPointerMove);
    listEl.addEventListener('pointerup', onPointerUp);
    listEl.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      cleanup();
      listEl.removeEventListener('pointerdown', onPointerDown);
      listEl.removeEventListener('pointermove', onPointerMove);
      listEl.removeEventListener('pointerup', onPointerUp);
      listEl.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Drop operations
  function executeSwap() {
    if (!pendingDrop) return;
    const srcIdx = schedule.activities.findIndex(a => a.id === pendingDrop.srcActivity.id);
    const destIdx = schedule.activities.findIndex(a => a.id === pendingDrop.destActivity!.id);
    if (srcIdx < 0 || destIdx < 0) return;
    const srcDur = timeToMinutes(pendingDrop.srcActivity.end) - timeToMinutes(pendingDrop.srcActivity.start);
    const destDur = timeToMinutes(pendingDrop.destActivity!.end) - timeToMinutes(pendingDrop.destActivity!.start);
    onActivitiesUpdate([
      { index: srcIdx, updates: { start: pendingDrop.destTime, end: minutesToTime(timeToMinutes(pendingDrop.destTime) + srcDur) } },
      { index: destIdx, updates: { start: pendingDrop.srcTime, end: minutesToTime(timeToMinutes(pendingDrop.srcTime) + destDur) } },
    ]);
    setPendingDrop(null);
  }

  function executeCopy() {
    if (!pendingDrop) return;
    onActivityAdd(pendingDrop.destTime, pendingDrop.destEndTime, pendingDrop.destPerson);
    const newIdx = schedule.activities.length;
    setTimeout(() => {
      onActivityUpdate(newIdx, {
        title: pendingDrop!.srcActivity.title,
        type: pendingDrop!.srcActivity.type,
        color: pendingDrop!.srcActivity.color,
        people: [pendingDrop!.destPerson],
        notes: pendingDrop!.srcActivity.notes,
      });
    }, 50);
    setPendingDrop(null);
  }

  function executeMove() {
    if (!pendingDrop) return;
    const srcIdx = schedule.activities.findIndex(a => a.id === pendingDrop.srcActivity.id);
    if (srcIdx < 0) return;
    onActivityUpdate(srcIdx, { start: pendingDrop.destTime, end: pendingDrop.destEndTime });
    setPendingDrop(null);
  }

  // Get activities for the selected person
  const personActivities = schedule.activities.filter(
    (a) => a.people.includes(selectedPerson)
  );
  const personActivitiesRef = useRef(personActivities);
  personActivitiesRef.current = personActivities;

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
      <div ref={listRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
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
              data-slot={slot}
              className={`flex items-stretch border-b border-stone-100 ${
                isCurrent ? 'bg-orange-50' : isPast ? 'opacity-55' : ''
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
                  data-activity-idx={schedule.activities.indexOf(activity)}
                  className="flex-1 flex items-center gap-2 px-3 py-2 cursor-pointer"
                  style={{
                    backgroundColor: typeColor || '#fff',
                    borderLeft: `3px solid ${personBorder}`,
                    minHeight: 48,
                    ...(activity.completed ? { opacity: 0.65 } : {}),
                  }}
                  onClick={() => {
                    if (justDraggedRef.current) return;
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
                  <span className={`text-sm font-medium leading-tight flex-1 ${activity.completed ? 'line-through text-stone-500' : ''}`}>
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

      {/* Drop modal for occupied-slot drops */}
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
