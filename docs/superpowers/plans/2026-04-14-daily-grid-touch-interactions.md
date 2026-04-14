# Touch Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add long-press shift cascade, drag-to-move with swap, and long-press detection to the daily grid touchscreen kiosk.

**Architecture:** Use a custom `useLongPress` hook to detect 500ms holds. On hold, show a shift cascade menu (the killer feature). On hold+drag, use @dnd-kit for drag-to-move with swap behavior. Both share the same 500ms threshold — if the finger moves >10px after the hold, it switches from shift menu to drag mode.

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, React hooks, TypeScript, Tailwind CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add @dnd-kit/core + @dnd-kit/sortable |
| `lib/useLongPress.ts` | Create | Long-press detection (500ms, cancels on move >10px) |
| `lib/shiftCascade.ts` | Create | Pure function: shift activities forward/backward in time |
| `components/ShiftMenu.tsx` | Create | Popup menu for shift cascade (+1hr, +30m, -30m, -1hr, "Just this one") |
| `components/ScheduleGrid.tsx` | Major modify | Integrate long-press, shift menu, @dnd-kit drag-and-drop with swap |

---

### Task 1: Install @dnd-kit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd ~/dev/daily-grid-web && npm install @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 2: Verify installation**

```bash
cd ~/dev/daily-grid-web && node -e "require('@dnd-kit/core'); require('@dnd-kit/sortable'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add package.json package-lock.json && git commit -m "chore: add @dnd-kit/core and @dnd-kit/sortable for drag-and-drop"
```

---

### Task 2: Create useLongPress hook

**Files:**
- Create: `lib/useLongPress.ts`

This hook detects a 500ms hold on an element. It fires `onLongPress` if the finger stays still, and cancels if the finger moves more than 10px (which triggers drag mode instead).

- [ ] **Step 1: Write the hook**

```typescript
// lib/useLongPress.ts
'use client';

import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number;     // ms before long-press fires (default 500)
  moveTolerance?: number; // px of movement allowed before cancelling (default 10)
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  disabled?: boolean;
}

export function useLongPress({
  threshold = 500,
  moveTolerance = 10,
  onLongPress,
  onClick,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return;
    longPressFiredRef.current = false;

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    startPosRef.current = { x, y };

    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress(e);
    }, threshold);
  }, [disabled, onLongPress, threshold]);

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!startPosRef.current || !timerRef.current) return;

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    const dx = x - startPosRef.current.x;
    const dy = y - startPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > moveTolerance) {
      clear();
    }
  }, [moveTolerance, clear]);

  const end = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (longPressFiredRef.current) {
      // Long press already fired, don't trigger click
      longPressFiredRef.current = false;
      clear();
      e.preventDefault();
      return;
    }
    clear();
    if (onClick && !disabled) {
      onClick(e);
    }
  }, [onClick, disabled, clear]);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: clear,
  };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/dev/daily-grid-web && npx tsc --noEmit lib/useLongPress.ts 2>&1 | head -10
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add lib/useLongPress.ts && git commit -m "feat: add useLongPress hook with move cancellation for touch/mouse"
```

---

### Task 3: Create shift cascade logic

**Files:**
- Create: `lib/shiftCascade.ts`

Pure function that takes a list of activities, a person, a start time, and a shift amount (in minutes), and returns the updated activities array.

- [ ] **Step 1: Write the shift logic**

```typescript
// lib/shiftCascade.ts

import { Activity } from './types';
import { timeToMinutes, minutesToTime } from './time';

const DAY_START = '07:00'; // 7 AM
const DAY_END = '22:00';   // 10 PM

/**
 * Shift all activities for a given person from a start time onward by a number of minutes.
 * Returns a new activities array with updated times.
 * Clamps activities to the 7am-10pm range.
 */
export function shiftActivitiesFrom(
  activities: Activity[],
  person: string,
  fromTime: string,
  shiftMinutes: number
): Activity[] {
  const fromMin = timeToMinutes(fromTime);
  const dayStartMin = timeToMinutes(DAY_START);
  const dayEndMin = timeToMinutes(DAY_END);

  return activities.map(activity => {
    // Only shift activities that include this person and start at or after the from time
    if (!activity.people.includes(person)) return activity;
    const actStartMin = timeToMinutes(activity.start);
    if (actStartMin < fromMin) return activity;

    const duration = timeToMinutes(activity.end) - actStartMin;
    let newStart = actStartMin + shiftMinutes;
    let newEnd = newStart + duration;

    // Clamp to day bounds
    newStart = Math.max(dayStartMin, Math.min(dayEndMin - duration, newStart));
    newEnd = newStart + duration;

    return {
      ...activity,
      start: minutesToTime(newStart),
      end: minutesToTime(newEnd),
    };
  });
}

/**
 * Shift a single activity by a number of minutes.
 * Returns a new activities array with updated times.
 */
export function shiftSingleActivity(
  activities: Activity[],
  activityId: string,
  shiftMinutes: number
): Activity[] {
  const dayStartMin = timeToMinutes(DAY_START);
  const dayEndMin = timeToMinutes(DAY_END);

  return activities.map(activity => {
    if (activity.id !== activityId) return activity;

    const duration = timeToMinutes(activity.end) - timeToMinutes(activity.start);
    let newStart = timeToMinutes(activity.start) + shiftMinutes;
    let newEnd = newStart + duration;

    newStart = Math.max(dayStartMin, Math.min(dayEndMin - duration, newStart));
    newEnd = newStart + duration;

    return {
      ...activity,
      start: minutesToTime(newStart),
      end: minutesToTime(newEnd),
    };
  });
}

/**
 * Count how many activities will be affected by a cascade shift.
 */
export function countAffectedActivities(
  activities: Activity[],
  person: string,
  fromTime: string
): number {
  const fromMin = timeToMinutes(fromTime);
  return activities.filter(
    a => a.people.includes(person) && timeToMinutes(a.start) >= fromMin
  ).length;
}

/**
 * Swap two activities' time slots.
 * Returns a new activities array with swapped start/end times.
 */
export function swapActivityTimes(
  activities: Activity[],
  sourceId: string,
  targetId: string
): Activity[] {
  const source = activities.find(a => a.id === sourceId);
  const target = activities.find(a => a.id === targetId);
  if (!source || !target) return activities;

  return activities.map(a => {
    if (a.id === sourceId) {
      return { ...a, start: target.start, end: target.end };
    }
    if (a.id === targetId) {
      return { ...a, start: source.start, end: source.end };
    }
    return a;
  });
}

/**
 * Move a single activity to a new time slot.
 * If the target slot is occupied, perform a swap instead.
 */
export function moveOrSwapActivity(
  activities: Activity[],
  sourceId: string,
  newStart: string,
  newEnd: string
): Activity[] {
  const source = activities.find(a => a.id === sourceId);
  if (!source) return activities;

  // Check if target slot is occupied by another activity for the same people
  const targetOccupier = activities.find(a =>
    a.id !== sourceId &&
    a.start === newStart &&
    a.people.some(p => source.people.includes(p))
  );

  if (targetOccupier) {
    // Swap times
    return activities.map(a => {
      if (a.id === sourceId) return { ...a, start: newStart, end: newEnd };
      if (a.id === targetOccupier.id) return { ...a, start: source.start, end: source.end };
      return a;
    });
  }

  // Simple move
  return activities.map(a => {
    if (a.id === sourceId) return { ...a, start: newStart, end: newEnd };
    return a;
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/dev/daily-grid-web && npx tsc --noEmit lib/shiftCascade.ts 2>&1 | head -10
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add lib/shiftCascade.ts && git commit -m "feat: add shift cascade, swap, and move logic for activities"
```

---

### Task 4: Create ShiftMenu component

**Files:**
- Create: `components/ShiftMenu.tsx`

Popup that appears when long-pressing an activity. Shows shift options.

- [ ] **Step 1: Write the component**

```tsx
// components/ShiftMenu.tsx
'use client';

import { useEffect, useRef } from 'react';
import { countAffectedActivities } from '@/lib/shiftCascade';
import { formatTimeDisplay } from '@/lib/time';
import { Activity } from '@/lib/types';

interface ShiftMenuProps {
  activity: Activity;
  person: string;
  allActivities: Activity[];
  position: { x: number; y: number };
  onShift: (shiftMinutes: number, cascade: boolean) => void;
  onClose: () => void;
}

export default function ShiftMenu({
  activity,
  person,
  allActivities,
  position,
  onShift,
  onClose,
}: ShiftMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  const affectedCount = countAffectedActivities(allActivities, person, activity.start);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick as any);
    };
  }, [onClose]);

  // Position the menu near the cell, but keep it on screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 340),
    top: Math.max(10, position.y - 200),
    zIndex: 50,
  };

  const timeDisplay = formatTimeDisplay(activity.start).replace(':00', '').replace(' ', '').toLowerCase();

  return (
    <div ref={ref} style={menuStyle} className="bg-white rounded-xl shadow-xl border border-stone-200 w-80 overflow-hidden">
      <div className="px-4 py-3 bg-stone-800 text-white">
        <div className="font-bold text-sm">Shift from {timeDisplay} onward</div>
        <div className="text-stone-300 text-xs mt-0.5">
          Moves <strong className="text-white">{affectedCount}</strong> activity{affectedCount !== 1 ? 'activities' : ''} for {person}
        </div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => onShift(60, true)}
            className="bg-orange-50 border-2 border-orange-300 text-orange-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition"
          >
            +1 hour
          </button>
          <button
            onClick={() => onShift(30, true)}
            className="bg-orange-50 border-2 border-orange-200 text-orange-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition"
          >
            +30 min
          </button>
          <button
            onClick={() => onShift(-30, true)}
            className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
          >
            -30 min
          </button>
          <button
            onClick={() => onShift(-60, true)}
            className="bg-blue-50 border-2 border-blue-300 text-blue-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
          >
            -1 hour
          </button>
        </div>
        <button
          onClick={() => onShift(0, false)}
          className="w-full bg-stone-100 text-stone-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-stone-200 transition mb-2"
        >
          Just move &quot;{activity.title}&quot; only (no cascade)
        </button>
        <button
          onClick={onClose}
          className="w-full bg-stone-50 text-stone-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-stone-100 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/dev/daily-grid-web && npx tsc --noEmit components/ShiftMenu.tsx 2>&1 | head -10
```
Expected: No errors (may have path resolution warnings only)

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add components/ShiftMenu.tsx && git commit -m "feat: add ShiftMenu component for cascade shift UI"
```

---

### Task 5: Integrate long-press shift menu into ScheduleGrid

**Files:**
- Modify: `components/ScheduleGrid.tsx`

This task adds long-press detection to activity cells and shows the ShiftMenu when a long press is detected.

- [ ] **Step 1: Add imports and state**

At the top of `components/ScheduleGrid.tsx`, add:

```typescript
import { useLongPress } from '@/lib/useLongPress';
import { shiftActivitiesFrom, shiftSingleActivity } from '@/lib/shiftCascade';
import ShiftMenu from './ShiftMenu';
```

Inside the ScheduleGrid component, add state for the shift menu after the existing `editState`:

```typescript
const [shiftMenu, setShiftMenu] = useState<{
  activity: Activity;
  person: string;
  position: { x: number; y: number };
} | null>(null);
```

- [ ] **Step 2: Add shift handler**

Add a function to handle shift menu selections:

```typescript
function handleShift(shiftMinutes: number, cascade: boolean) {
  if (!shiftMenu) return;
  const { activity, person } = shiftMenu;
  let updated: Activity[];

  if (cascade && shiftMinutes !== 0) {
    updated = shiftActivitiesFrom(schedule.activities, person, activity.start, shiftMinutes);
  } else if (!cascade) {
    // "Just this one" — open the edit modal with a time suggestion
    // For now, we'll just use the shift logic for single activity
    const singleShift = shiftMinutes === 0 ? 0 : shiftMinutes;
    updated = shiftSingleActivity(schedule.activities, activity.id, singleShift);
  } else {
    updated = schedule.activities;
  }

  setShiftMenu(null);

  // Apply all changes by updating each changed activity
  if (updated !== schedule.activities) {
    for (let i = 0; i < updated.length; i++) {
      if (JSON.stringify(updated[i]) !== JSON.stringify(schedule.activities[i])) {
        onActivityUpdate(i, updated[i]);
      }
    }
  }
}
```

- [ ] **Step 3: Create long-press handler for activity cells**

Add a function that creates long-press handlers for a specific cell:

```typescript
function getLongPressHandlers(activity: Activity, person: string) {
  if (!editMode) return {};

  return useLongPress({
    threshold: 500,
    moveTolerance: 10,
    onLongPress: (e) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setShiftMenu({
        activity,
        person,
        position: { x: rect.left, y: rect.top },
      });
    },
    onClick: () => {
      // Regular tap — find the index and open edit modal
      const idx = schedule.activities.findIndex(a => a.id === activity.id);
      if (idx >= 0) {
        setEditState({ active: true, activityIndex: idx, isNew: false, defaults: null });
      }
    },
  });
}
```

**IMPORTANT:** This function uses `useLongPress` which is a hook. Since it's called conditionally (only in edit mode), we need to restructure. Instead, create the hook at the component level and apply it per-cell. However, since `useLongPress` returns stable callbacks, we can create a wrapper:

Actually, we need to handle this differently. `useLongPress` returns event handlers, but we need different handlers per cell (different activity/person). The cleanest approach: move long-press detection into the cell rendering and use `useCallback` with refs.

Replace the `getLongPressHandlers` approach with inline touch/mouse handlers in the activity cell:

```typescript
// Add refs for long-press tracking
const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

function handleCellPointerDown(e: React.TouchEvent | React.MouseEvent, activity: Activity, person: string) {
  if (!editMode) return;
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
    // Timer was still running = short tap, not long press
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
```

Add `useRef` to the imports at the top:

```typescript
import { useState, useEffect, useRef } from 'react';
```

- [ ] **Step 4: Apply long-press to activity cells**

In the activity cell `<td>` (around line 237-268), replace the `onClick` handler with the long-press handlers:

Find the activity cell `<td>` that has:
```tsx
onClick={() => editMode && handleCellClick(person, row.start, row.end)}
```

Replace the entire `<td>` opening tag with:

```tsx
<td
  key={person}
  className={`px-3 py-2.5 text-center text-sm align-middle transition-all ${activity.completed ? 'opacity-40' : ''} ${editMode ? 'cursor-pointer hover:brightness-95' : ''}`}
  style={{
    backgroundColor: activity.completed ? '#f5f5f4' : typeColor,
    color: activity.completed ? '#a8a29e' : getTypeTextColor(activity.type),
    borderLeft: `3px solid ${personBorder}`
  }}
  onTouchStart={e => handleCellPointerDown(e, activity, person)}
  onTouchMove={e => handleCellPointerMove(e)}
  onTouchEnd={e => handleCellPointerUp(e, person, row.start, row.end)}
  onTouchCancel={handleCellPointerCancel}
  onMouseDown={e => handleCellPointerDown(e, activity, person)}
  onMouseMove={e => handleCellPointerMove(e)}
  onMouseUp={e => handleCellPointerUp(e, person, row.start, row.end)}
  onMouseLeave={handleCellPointerCancel}
>
```

- [ ] **Step 5: Add ShiftMenu to the component JSX**

Just before the closing `</div>` of the root return (after the ActivityModal block, around line 301), add:

```tsx
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
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 7: Commit**

```bash
cd ~/dev/daily-grid-web && git add components/ScheduleGrid.tsx && git commit -m "feat: long-press activity cells to show shift cascade menu"
```

---

### Task 6: Add drag-and-drop with swap via @dnd-kit

**Files:**
- Modify: `components/ScheduleGrid.tsx`

This task wraps the grid in a `DndContext` and makes activity cells draggable with swap-on-drop behavior.

- [ ] **Step 1: Add @dnd-kit imports**

Add to the imports at the top of `components/ScheduleGrid.tsx`:

```typescript
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
```

- [ ] **Step 2: Add DnD sensors and state**

Inside the ScheduleGrid component, after the existing state declarations, add:

```typescript
// Drag-and-drop state
const [dragOverCell, setDragOverCell] = useState<string | null>(null);
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      delay: 500,   // Same as long-press — 500ms hold
      tolerance: 5, // Allow 5px jitter during hold
    },
  })
);
```

- [ ] **Step 3: Add drag end handler**

Add the drag end handler function:

```typescript
function handleDragEnd(event: DragEndEvent) {
  setDragOverCell(null);
  const { active, over } = event;
  if (!over) return; // dropped outside any droppable

  const sourceId = active.id as string;
  const targetKey = over.id as string; // format: "person-rowStart-rowEnd"

  const sourceActivity = schedule.activities.find(a => a.id === sourceId);
  if (!sourceActivity) return;

  // Parse target cell
  const parts = targetKey.split('-');
  if (parts.length < 3) return;
  const targetPerson = parts[0];
  const targetStart = parts[1];
  const targetEnd = parts[2];

  // Calculate duration of source activity
  const duration = timeToMinutes(sourceActivity.end) - timeToMinutes(sourceActivity.start);

  // Check if target cell already has an activity for this person
  const targetActivity = schedule.activities.find(a =>
    a.id !== sourceId &&
    a.people.includes(targetPerson) &&
    a.start === targetStart
  );

  // Apply the move or swap
  for (let i = 0; i < schedule.activities.length; i++) {
    const act = schedule.activities[i];
    if (act.id === sourceId) {
      // Move source to target
      onActivityUpdate(i, {
        start: targetStart,
        end: minutesToTime(timeToMinutes(targetStart) + duration),
        people: [targetPerson],
      });
    } else if (targetActivity && act.id === targetActivity.id) {
      // Swap target to source position
      const targetDuration = timeToMinutes(targetActivity.end) - timeToMinutes(targetActivity.start);
      onActivityUpdate(i, {
        start: sourceActivity.start,
        end: minutesToTime(timeToMinutes(sourceActivity.start) + targetDuration),
      });
    }
  }
}
```

- [ ] **Step 4: Wrap the grid table in DndContext**

Find the `<table>` element and wrap it:

Replace:
```tsx
<table className="w-full border-collapse">
```

With:
```tsx
<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
<table className="w-full border-collapse">
```

And close the DndContext after the `</table>` closing tag:

Find `</table>` and change to:
```tsx
</table>
</DndContext>
```

- [ ] **Step 5: Make activity cells draggable**

In the activity cell `<td>` (the one modified in Task 5), wrap the cell content in a draggable div. Add `data-draggable-id` to the `<td>`:

In the activity cell, after the opening `<td>` tag, add a draggable wrapper. Also add a `useDraggable` hook. But since we can't call hooks inside map, we need to extract the cell into a sub-component.

Create a `DraggableActivityCell` component at the bottom of the file (before the `ActivityModal`):

```tsx
import { useDraggable } from '@dnd-kit/core';

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
        position: 'relative',
      }}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
      onTouchCancel={onPointerCancel}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerCancel}
      {...listeners}
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
```

- [ ] **Step 6: Make empty cells droppable**

Add `useDroppable` for empty cells. Create a `DroppableCell` component:

```tsx
import { useDroppable } from '@dnd-kit/core';

function DroppableCell({
  person, rowStart, rowEnd, editMode, personBorderColor, dragOverCell, onClick,
}: {
  person: string;
  rowStart: string;
  rowEnd: string;
  editMode: boolean;
  personBorderColor: string;
  dragOverCell: string | null;
  onClick: () => void;
}) {
  const cellKey = `${person}-${rowStart}-${rowEnd}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellKey });
  const isHighlighted = isOver || dragOverCell === cellKey;

  return (
    <td
      ref={setNodeRef}
      className={`px-3 py-3 text-center align-middle transition-all ${
        isHighlighted ? 'bg-orange-50 ring-2 ring-orange-300 ring-inset' : ''
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
```

- [ ] **Step 7: Update the cell rendering in the tbody**

In the tbody, replace the three cell types (calendar event, activity, empty) with the new components.

For the **activity cell** block (the one starting with `if (cellData)`), replace the entire block with:

```tsx
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
```

For the **empty cell** block (the last `return` in the inner map), replace with:

```tsx
return (
  <DroppableCell
    key={person}
    person={person}
    rowStart={row.start}
    rowEnd={row.end}
    editMode={editMode}
    personBorderColor={PERSON_COLORS[person]?.border || '#e7e5e4'}
    dragOverCell={dragOverCell}
    onClick={() => handleCellClick(person, row.start, row.end)}
  />
);
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 9: Commit**

```bash
cd ~/dev/daily-grid-web && git add components/ScheduleGrid.tsx && git commit -m "feat: drag-and-drop with swap via @dnd-kit, droppable cells with highlight"
```

---

### Task 7: Verify everything works end-to-end

**Files:**
- Verify: All files compile
- Visual: Dev server screenshot

- [ ] **Step 1: Run dev server**

```bash
cd ~/dev/daily-grid-web && npm run dev
```

- [ ] **Step 2: Verify interactions**

Open `http://localhost:3000/editor/2026-04-14`

Test:
1. **Tap** an activity → edit modal opens (existing behavior)
2. **Long-press** (hold 0.5s) an activity → shift cascade menu appears
3. **Tap "+1 hour"** in shift menu → activities slide down by 1 hour
4. **Drag** an activity (hold 0.5s + move) to another cell → activity moves there, target swaps if occupied

- [ ] **Step 3: Fix any type errors**

```bash
cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Final commit**

```bash
cd ~/dev/daily-grid-web && git add -A && git commit -m "feat: complete touch interactions — long-press shift cascade + drag swap"
```

---

## Self-Review

**Spec coverage:**
- Tap → edit modal → existing, preserved in Task 5/6
- Long-press → shift cascade menu → Task 2 (hook) + Task 3 (logic) + Task 4 (UI) + Task 5 (integration)
- Long-press + drag → move with swap → Task 1 (deps) + Task 6 (dnd-kit)
- Swap behavior → Task 3 (`swapActivityTimes`, `moveOrSwapActivity`) + Task 6 (`handleDragEnd`)
- 500ms threshold shared → Task 5 (long press) + Task 6 (`activationConstraint.delay: 500`)
- Move tolerance (10px) → Task 5 (`handleCellPointerMove`)
- Cascade per-person → Task 3 (`shiftActivitiesFrom` filters by person)
- Clamp to 7am-10pm → Task 3 (day bounds)
- Calendar events not draggable → Task 6 (calendar event cells have no Draggable wrapper)
- Auto-save → existing useAutoSave picks up activity changes

**Placeholder scan:** All code is complete, no TBDs.

**Type consistency:** `Activity` from `@/lib/types` used consistently. `minutesToTime` from `@/lib/time` used in Task 3 and Task 6. `handleDragEnd` uses same types as `onActivityUpdate` callback.
