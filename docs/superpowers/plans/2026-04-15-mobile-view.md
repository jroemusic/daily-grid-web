# Mobile View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add responsive mobile support — single-person view on phones, compressed grid on tablets, bottom sheets for modals.

**Architecture:** A `useIsMobile()` hook drives conditional rendering in the editor page. Narrow viewports get a new `MobileScheduleView` component (person tabs + vertical time slot list). Wide viewports get the existing `ScheduleGrid` with responsive Tailwind classes. All modals render as `BottomSheet` on mobile.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, existing Supabase backend

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/hooks.ts` | Create | `useIsMobile()` and `useLastPerson()` hooks |
| `components/BottomSheet.tsx` | Create | Reusable bottom sheet wrapper with slide-up, drag handle, swipe-to-dismiss |
| `components/MobileScheduleView.tsx` | Create | Single-person schedule with person tabs, time slot list, bottom toolbar |
| `components/ScheduleGrid.tsx` | Modify | Add responsive Tailwind classes for md breakpoint |
| `components/DropModal.tsx` | Modify | Render as bottom sheet on mobile |
| `app/editor/[date]/page.tsx` | Modify | Conditional rendering + mobile header/toolbar |

---

### Task 1: Create hooks (`lib/hooks.ts`)

**Files:**
- Create: `lib/hooks.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
// lib/hooks.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);

    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

const STORAGE_KEY = 'dg-last-person';
const DEFAULT_PERSON = 'Jason';

export function useLastPerson(): [string, (person: string) => void] {
  const [person, setPersonState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PERSON;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PERSON;
  });

  const setPerson = useCallback((p: string) => {
    setPersonState(p);
    localStorage.setItem(STORAGE_KEY, p);
  }, []);

  return [person, setPerson];
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit lib/hooks.ts 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add lib/hooks.ts
git commit -m "feat: add useIsMobile and useLastPerson hooks for responsive layout"
```

---

### Task 2: Create BottomSheet component

**Files:**
- Create: `components/BottomSheet.tsx`

- [ ] **Step 1: Create the BottomSheet component**

```tsx
// components/BottomSheet.tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  children: ReactNode;
  onClose: () => void;
}

export default function BottomSheet({ children, onClose }: BottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Dismiss on escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  // Swipe-to-dismiss via touch
  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || !sheetRef.current) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function onTouchEnd() {
    if (!dragging.current || !sheetRef.current) return;
    dragging.current = false;
    const delta = currentY.current - startY.current;
    // Dismiss if swiped down more than 30% of sheet height
    if (delta > (sheetRef.current.offsetHeight * 0.3)) {
      handleClose();
    } else {
      sheetRef.current.style.transform = '';
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-200"
        style={{
          maxHeight: '85vh',
          overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          touchAction: 'pan-y',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3 cursor-grab" onClick={handleClose}>
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add components/BottomSheet.tsx
git commit -m "feat: add BottomSheet component with swipe-to-dismiss"
```

---

### Task 3: Create MobileScheduleView component

**Files:**
- Create: `components/MobileScheduleView.tsx`

This is the largest task. The component renders person tabs at the top, a vertical time slot list in the middle, and a fixed bottom toolbar.

- [ ] **Step 1: Create MobileScheduleView**

```tsx
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
import ShiftMenu from './ShiftMenu';
import DropModal, { type PendingDrop } from './DropModal';

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
  const [shiftMenu, setShiftMenu] = useState<{
    activity: Activity;
    person: string;
    position: { x: number; y: number };
  } | null>(null);

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
            •••
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
```

- [ ] **Step 2: Verify build compiles**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (may need to fix import paths if types don't match exactly)

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add components/MobileScheduleView.tsx
git commit -m "feat: add MobileScheduleView with person tabs and bottom toolbar"
```

---

### Task 4: Add responsive classes to ScheduleGrid

**Files:**
- Modify: `components/ScheduleGrid.tsx`

- [ ] **Step 1: Add responsive Tailwind classes to the grid table**

In `components/ScheduleGrid.tsx`, modify the time column header `<th>` to shrink on md:

Find: `className="bg-stone-800 text-stone-300 px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase w-28 sticky top-0"`

Replace with: `className="bg-stone-800 text-stone-300 px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase w-28 md:w-20 sticky top-0"`

- [ ] **Step 2: Add responsive classes to person headers**

Find the person `<th>` and change:
`className="px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase sticky top-0"`

Replace with:
`className="px-3 py-3 md:py-2 text-center text-sm md:text-[10px] font-semibold tracking-wider uppercase sticky top-0"`

- [ ] **Step 3: Add sticky time column to all time-label cells**

In the time-label `<td>`, add sticky positioning and responsive width. Find the `<td>` with `text-stone-400` and `formatTimeDisplay(row.start)` and add:
- `className="... md:w-20"` to match the header
- `style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'inherit' }}` so the time column stays visible during horizontal scroll

- [ ] **Step 4: Add min-width to table for horizontal scroll**

Find: `<table className="w-full border-collapse">`

Replace with: `<table className="w-full border-collapse md:min-w-[540px]">`

- [ ] **Step 5: Add overflow-x to scroll container**

Find the scroll container `div` with `overflow-auto` and add `md:overflow-x-auto` class (it already has overflow-auto which handles both axes).

- [ ] **Step 6: Hide shift button on md, show on lg+**

In the activity cell's shift button (the `<svg>` with `w-3.5 h-3.5`), add `hidden md:hidden lg:block` to the parent button's className.

- [ ] **Step 7: Verify build and commit**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -5`

```bash
cd ~/dev/daily-grid-web && git add components/ScheduleGrid.tsx
git commit -m "feat: add responsive Tailwind classes to ScheduleGrid for tablet view"
```

---

### Task 5: Update editor page for conditional rendering

**Files:**
- Modify: `app/editor/[date]/page.tsx`

- [ ] **Step 1: Import hooks and MobileScheduleView**

Add at the top of the file:

```typescript
import { useIsMobile, useLastPerson } from '@/lib/hooks';
import MobileScheduleView from '@/components/MobileScheduleView';
```

- [ ] **Step 2: Add hooks to the EditorPage component**

Inside `EditorPage`, after the existing state declarations, add:

```typescript
const isMobile = useIsMobile();
const [lastPerson, setLastPerson] = useLastPerson();
```

- [ ] **Step 3: Replace the `<main>` section with conditional rendering**

Find the `<main>` element that renders `<ScheduleGrid>` and replace it with:

```tsx
{/* Schedule grid or mobile view — fills remaining viewport */}
<main className="max-w-6xl mx-auto px-4 py-3 flex-1 overflow-hidden">
  {isMobile ? (
    <MobileScheduleView
      schedule={schedule}
      currentTime={currentTimeForGrid}
      onActivityUpdate={handleActivityUpdate}
      onActivityAdd={handleActivityAdd}
      onActivityRemove={handleActivityRemove}
      onToggleComplete={handleToggleComplete}
      selectedPerson={lastPerson}
      onPersonChange={setLastPerson}
      onUndo={handleUndo}
      canUndo={canUndo}
      onAddActivity={() => setTriggerNewActivity((n) => n + 1)}
      templates={templates}
      onLoadTemplate={loadTemplate}
      onRefreshCalendar={refreshCalendar}
      onPrint={() => openPrintableView(schedule)}
      onSaveAsTemplate={() => setShowSaveTemplate(true)}
    />
  ) : (
    <ScheduleGrid
      schedule={schedule}
      currentTime={currentTimeForGrid}
      onActivityUpdate={handleActivityUpdate}
      onActivitiesUpdate={handleActivitiesUpdate}
      onActivityAdd={handleActivityAdd}
      onActivityCreate={handleActivityCreate}
      onActivityRemove={handleActivityRemove}
      onToggleComplete={handleToggleComplete}
      onCalendarEventOverride={handleCalendarEventOverride}
      editMode={editMode}
      triggerNewActivity={triggerNewActivity}
    />
  )}
</main>
```

- [ ] **Step 4: Hide clock/countdown on mobile in header**

In the header's clock section, wrap the clock and countdown in a responsive hide:

Find: `<span className="text-lg font-bold text-stone-800 tabular-nums">{currentTime}</span>`

Wrap the entire clock `<div>` with: `<div className="items-center gap-4 hidden md:flex">`

- [ ] **Step 5: Verify build and test locally**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -10`

Then run dev server: `cd ~/dev/daily-grid-web && npm run dev`

Open http://localhost:3000 and test:
- Desktop: should look unchanged
- Resize browser to < 768px: should show mobile view with person tabs

- [ ] **Step 6: Commit**

```bash
cd ~/dev/daily-grid-web && git add app/editor/\[date\]/page.tsx
git commit -m "feat: conditional mobile/desktop rendering in editor page"
```

---

### Task 6: Update DropModal for mobile bottom sheet

**Files:**
- Modify: `components/DropModal.tsx`

- [ ] **Step 1: Import BottomSheet and useIsMobile**

Add to imports:
```typescript
import { useIsMobile } from '@/lib/hooks';
import BottomSheet from './BottomSheet';
```

- [ ] **Step 2: Add mobile detection and conditional rendering**

Inside `DropModal`, add:
```typescript
const isMobile = useIsMobile();
```

Then wrap the return in a conditional: on mobile, render the modal content inside `<BottomSheet>`, on desktop keep the existing fixed-position floating card.

Replace the return statement with:

```tsx
if (isMobile) {
  return (
    <BottomSheet onClose={handleClose}>
      <div className="px-4 pb-6">
        <div className="mb-3">
          <div className="font-bold text-sm">Drop &quot;{pending.srcActivity.title}&quot;?</div>
          <div className="text-stone-400 text-xs mt-0.5">
            {pending.srcPerson} {pending.srcTime} → {pending.destPerson} {pending.destTime}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onSwap(); handleClose(); }} className="w-full px-3 py-3 rounded-lg text-sm font-bold border-2 border-blue-400 bg-blue-50 text-blue-800" style={{ touchAction: 'manipulation', minHeight: 44 }}>↔ Swap</button>
          {hasDestActivity && <div className="text-[10px] text-stone-400 -mt-1 ml-1">Trades with &quot;{pending.destActivity!.title}&quot;</div>}
          {hasOverlap && <div className="text-[10px] text-amber-600 font-semibold -mt-1 ml-1">⚠ Overlaps &quot;{overlapActivity!.title}&quot;</div>}
          <button onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onCopy(); handleClose(); }} className="w-full px-3 py-3 rounded-lg text-sm font-bold border-2 border-green-400 bg-green-50 text-green-800" style={{ touchAction: 'manipulation', minHeight: 44 }}>⊕ Copy</button>
          <button onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onMove(); handleClose(); }} className="w-full px-3 py-3 rounded-lg text-sm font-bold border-2 border-orange-400 bg-orange-50 text-orange-800" style={{ touchAction: 'manipulation', minHeight: 44 }}>→ Move</button>
          <button onClick={handleClose} className="w-full bg-stone-50 text-stone-400 px-3 py-2.5 rounded-lg text-xs font-medium mt-1" style={{ touchAction: 'manipulation', minHeight: 44 }}>Cancel</button>
        </div>
      </div>
    </BottomSheet>
  );
}

// Desktop: existing floating card (unchanged)
return (
  <div ref={ref} style={menuStyle} className="bg-white rounded-xl shadow-xl border border-stone-200 w-64 overflow-hidden"
    onContextMenu={e => e.preventDefault()}>
    {/* ... existing desktop modal content unchanged ... */}
  </div>
);
```

- [ ] **Step 2: Verify build and commit**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -5`

```bash
cd ~/dev/daily-grid-web && git add components/DropModal.tsx
git commit -m "feat: render DropModal as bottom sheet on mobile"
```

---

### Task 7: Final integration test and push

- [ ] **Step 1: Run full build**

Run: `cd ~/dev/daily-grid-web && npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 2: Test on dev server at multiple widths**

Run: `cd ~/dev/daily-grid-web && npm run dev`

Test in browser:
- **Desktop (>1024px):** Grid unchanged, all features work
- **Tablet (768-1023px):** Compressed grid, smaller fonts, sticky time column
- **Phone (<768px):** Person tabs, single-person schedule, bottom toolbar, bottom sheet modals

- [ ] **Step 3: Push to main**

```bash
cd ~/dev/daily-grid-web && git push origin main
```

- [ ] **Step 4: Verify on production**

Test at grid.jandkay.com on phone and tablet. Verify:
- Person tabs switch correctly
- localStorage persists last person
- Bottom sheets slide up and dismiss
- Activity add/edit/delete works
- Compressed grid works on landscape phone/tablet
- Kiosk view unchanged
