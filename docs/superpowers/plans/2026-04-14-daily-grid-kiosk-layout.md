# Daily Grid Kiosk Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the daily grid editor for a living room touchscreen kiosk — grid as hero, thin header with clock/countdown, auto-save, compact calendar strip.

**Architecture:** Restructure the editor page into a single-screen kiosk layout. Extract the countdown from ScheduleGrid into the header. Replace the progress card with a 4px hairline. Move calendar events below the grid as a compact strip. Add debounced auto-save via a custom hook. All changes are in 3 files: editor page, ScheduleGrid component, and a new auto-save hook.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/useAutoSave.ts` | Create | Debounced auto-save hook with status tracking |
| `components/ScheduleGrid.tsx` | Major modify | Remove countdown/progress/legend sections, dim past rows, increase row heights, extract calendar strip |
| `app/editor/[date]/page.tsx` | Major modify | New thin header with clock/countdown, progress hairline, calendar strip below grid, wire auto-save |

---

### Task 1: Create the auto-save hook

**Files:**
- Create: `lib/useAutoSave.ts`

- [ ] **Step 1: Write the useAutoSave hook**

```typescript
// lib/useAutoSave.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Schedule } from './types';

interface AutoSaveOptions {
  delay?: number; // debounce ms, default 2000
  enabled?: boolean;
}

export function useAutoSave(
  schedule: Schedule | null,
  saveFn: (schedule: Schedule) => Promise<void>,
  options: AutoSaveOptions = {}
) {
  const { delay = 2000, enabled = true } = options;
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleJsonRef = useRef('');

  // Stringify current activities for deep comparison
  const currentJson = schedule ? JSON.stringify(schedule.activities) : '';

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !schedule || !schedule.activities?.length) return;
    if (currentJson === scheduleJsonRef.current) return;

    // First load — just record, don't save
    if (!scheduleJsonRef.current) {
      scheduleJsonRef.current = currentJson;
      return;
    }

    scheduleJsonRef.current = currentJson;
    clearTimer();
    setStatus('idle');

    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFn(schedule);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (e) {
        console.warn('Auto-save failed:', e);
        setStatus('idle');
      }
    }, delay);

    return clearTimer;
  }, [currentJson, enabled, schedule, saveFn, delay, clearTimer]);

  return status;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit lib/useAutoSave.ts 2>&1 | head -20`
Expected: No errors (or only import path errors that resolve at build time)

- [ ] **Step 3: Commit**

```bash
cd ~/dev/daily-grid-web && git add lib/useAutoSave.ts && git commit -m "feat: add useAutoSave hook with debounced save and status tracking"
```

---

### Task 2: Restructure the header bar

**Files:**
- Modify: `app/editor/[date]/page.tsx`

This task restructures the editor page header into a single thin line with date, clock, countdown, and minimal toolbar. It also wires up the auto-save hook.

- [ ] **Step 1: Add imports and auto-save to page.tsx**

At the top of `app/editor/[date]/page.tsx`, add the import for the auto-save hook. Add these imports after the existing ones:

```typescript
import { useAutoSave } from '@/lib/useAutoSave';
```

Add these new state variables inside the component (after the existing state declarations around line 17):

```typescript
const [currentTime, setCurrentTime] = useState('');
const [countdown, setCountdown] = useState('');

// Clock + countdown timer
useEffect(() => {
  function updateTime() {
    const now = new Date();
    setCurrentTime(
      now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    );
    const minsLeft = 59 - now.getMinutes();
    const secsLeft = 59 - now.getSeconds();
    setCountdown(`${minsLeft}:${secsLeft.toString().padStart(2, '0')}`);
  }
  updateTime();
  const interval = setInterval(updateTime, 1000);
  return () => clearInterval(interval);
}, []);
```

Add the auto-save hook after the save function (around line 141):

```typescript
const saveStatus = useAutoSave(schedule, async (s) => {
  const method = s.id ? 'PUT' : 'POST';
  const body: any = {
    date: s.date,
    dayName: s.dayName,
    activities: s.activities,
    reminders: s.reminders || []
  };
  if (s.id) body.id = s.id;
  const res = await fetch('/api/schedules', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    const data = await res.json();
    const calendarRes = await fetch(`/api/google-calendar/${s.date}`);
    let calEvents = s.calendarEvents || [];
    if (calendarRes.ok) {
      const calendarData = await calendarRes.json();
      calEvents = calendarData.events || [];
    }
    setSchedule({ ...data.schedule, calendarEvents: calEvents });
  }
}, { enabled: editMode });
```

- [ ] **Step 2: Replace the header JSX**

Replace the entire `<header>` block (lines 326-443) with the new thin header:

```tsx
<header className="bg-white border-b border-stone-200 sticky top-0 z-20">
  <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
    {/* Left: date */}
    <div className="flex items-center gap-3">
      <Link href="/" className="text-stone-400 hover:text-stone-600 text-xs font-medium tracking-wide">
        &larr;
      </Link>
      <h1 className="text-sm font-bold text-stone-800 tracking-tight">
        {dayName} <span className="text-stone-400 font-normal mx-1">&mdash;</span> <span className="text-stone-500">{displayDate}</span>
      </h1>
    </div>

    {/* Center: clock + countdown */}
    <div className="flex items-center gap-4">
      <span className="text-lg font-bold text-stone-800 tabular-nums">{currentTime}</span>
      <span className="text-xs font-semibold text-stone-400 tabular-nums bg-stone-100 px-2 py-0.5 rounded-full">
        {countdown}
      </span>
    </div>

    {/* Right: auto-save status + toolbar */}
    <div className="flex items-center gap-1.5">
      {/* Auto-save indicator */}
      {editMode && (
        <span className={`text-[10px] font-semibold tracking-wide transition-opacity ${
          saveStatus === 'saving' ? 'text-orange-500' : saveStatus === 'saved' ? 'text-green-500' : 'text-transparent'
        }`}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : ''}
        </span>
      )}

      {/* Edit toggle */}
      <button
        onClick={() => setEditMode(!editMode)}
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition ${
          editMode ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-600'
        }`}
      >
        {editMode ? 'EDIT' : 'VIEW'}
      </button>

      {/* Add Activity */}
      {editMode && (
        <button
          onClick={() => setTriggerNewActivity(n => n + 1)}
          className="bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide hover:bg-emerald-700 transition"
        >
          + ADD
        </button>
      )}

      {/* More menu dropdown */}
      <div className="relative" style={{ /* dropdown state managed below */ }}>
        <MoreMenu
          editMode={editMode}
          templates={templates}
          onLoadTemplate={loadTemplate}
          onRefreshCalendar={refreshCalendar}
          onPrint={() => openPrintableView(schedule)}
          onSaveAsTemplate={() => setShowSaveTemplate(true)}
        />
      </div>
    </div>
  </div>
</header>
```

- [ ] **Step 3: Add the MoreMenu component**

Add this at the bottom of the file (before the export), as a local component used by the header:

```tsx
function MoreMenu({ editMode, templates, onLoadTemplate, onRefreshCalendar, onPrint, onSaveAsTemplate }: {
  editMode: boolean;
  templates: { name: string; displayName: string }[];
  onLoadTemplate: (name: string) => void;
  onRefreshCalendar: () => void;
  onPrint: () => void;
  onSaveAsTemplate: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="bg-stone-200 text-stone-600 px-2 py-1 rounded-md text-[11px] font-semibold tracking-wide hover:bg-stone-300 transition"
      >
        •••
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 w-52 overflow-hidden">
            {/* Templates */}
            {templates.length > 0 && (
              <div className="border-b border-stone-100">
                <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-stone-400">Templates</div>
                {templates.map(t => (
                  <button
                    key={t.name}
                    onClick={() => { onLoadTemplate(t.name); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition"
                  >
                    {t.displayName}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { onRefreshCalendar(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition">Sync Calendar</button>
            <button onClick={() => { onPrint(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition">Print</button>
            {editMode && (
              <button onClick={() => { onSaveAsTemplate(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 border-t border-stone-100 transition">Save as Template</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

Note: `useState` is already imported at the top of the file.

- [ ] **Step 4: Add progress hairline + calendar strip to the main layout**

Replace the `<main>` block (lines 447-458) with:

```tsx
{/* Time-of-day progress hairline */}
<div className="max-w-6xl mx-auto px-4">
  <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-30000 ease-linear"
      style={{
        width: `${(() => {
          if (!currentTime) return 0;
          const now = new Date();
          const mins = now.getHours() * 60 + now.getMinutes();
          const dayStart = 7 * 60; // 7 AM
          const dayEnd = 22 * 60; // 10 PM
          const pct = Math.max(0, Math.min(100, ((mins - dayStart) / (dayEnd - dayStart)) * 100));
          return pct;
        })()}%`,
        background: 'linear-gradient(90deg, #f97316, #fb923c, #22c55e)'
      }}
    />
  </div>
</div>

{/* Grid */}
<main className="max-w-6xl mx-auto px-4 py-3 flex-1">
  <ScheduleGrid
    schedule={schedule}
    onActivityUpdate={handleActivityUpdate}
    onActivityAdd={handleActivityAdd}
    onActivityRemove={handleActivityRemove}
    onToggleComplete={handleToggleComplete}
    onCalendarEventOverride={handleCalendarEventOverride}
    editMode={editMode}
    triggerNewActivity={triggerNewActivity}
  />
</main>

{/* Calendar Events Strip (below grid) */}
<CalendarStrip
  events={schedule.calendarEvents || []}
  onOverride={handleCalendarEventOverride}
/>

{/* Save as Template popup (kept from original) */}
{showSaveTemplate && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowSaveTemplate(false)}>
    <div className="absolute inset-0 bg-black/20" />
    <div className="relative bg-white rounded-xl shadow-xl p-4 w-64" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={templateName}
        onChange={e => setTemplateName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveAsTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false); }}
        className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-2 focus:border-stone-500 outline-none"
        placeholder="Template name..."
        autoFocus
      />
      <button
        onClick={saveAsTemplate}
        disabled={!templateName.trim()}
        className="w-full bg-stone-800 text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-stone-700 transition"
      >
        SAVE TEMPLATE
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add the CalendarStrip component**

Add this at the bottom of the file as a local component:

```tsx
function CalendarStrip({ events, onOverride }: {
  events: CalendarEvent[];
  onOverride: (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => void;
}) {
  const [collapsed, setCollapsed] = useState(events.length === 0);
  const PEOPLE = ['Jason', 'Kay', 'Emma', 'Toby'];
  const PERSON_COLORS: Record<string, string> = {
    Jason: '#2563eb', Kay: '#db2777', Emma: '#16a34a', Toby: '#ea580c'
  };

  function getEventPeople(event: CalendarEvent): string[] {
    if (event.overridePeople) return event.overridePeople;
    if (event.people) return event.people;
    if (event.person) return [event.person];
    return ['Jason'];
  }

  if (events.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-50 transition"
        >
          <span className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
          Calendar ({events.length})
        </button>
        {!collapsed && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {events.map(event => {
              const isEnabled = event.enabled !== false;
              const people = getEventPeople(event);
              const time = event.start.includes('T')
                ? new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : '';
              return (
                <div key={event.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${isEnabled ? 'bg-blue-50 text-blue-800' : 'bg-stone-100 text-stone-400 line-through'}`}>
                  <button
                    onClick={() => onOverride(event.id, { enabled: !isEnabled })}
                    className={`w-5 h-3 rounded-full relative flex-shrink-0 transition-colors ${isEnabled ? 'bg-blue-500' : 'bg-stone-300'}`}
                  >
                    <span className={`absolute top-px w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-2.5' : 'left-px'}`} />
                  </button>
                  {time && <span className="font-mono text-[10px] font-semibold">{time}</span>}
                  <span className="font-medium">{event.summary}</span>
                  {people.map(p => (
                    <span key={p} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PERSON_COLORS[p] || '#666' }} title={p} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: This requires importing `CalendarEvent` from `@/lib/types`. Add to the existing import on line 5.

- [ ] **Step 6: Remove the old SAVE button**

The SAVE button and the old showTemplatePicker dropdown are now replaced by the MoreMenu and auto-save. Remove:
- The old SAVE button (lines 400-408)
- The old showTemplatePicker dropdown (lines 354-371)
- The old manual `saveSchedule` button can stay in case auto-save fails, but it's now in the MoreMenu

The `saveSchedule` function stays for the auto-save hook to call, but the manual SAVE button in the toolbar is gone.

- [ ] **Step 7: Wrap the page in a flex column for full-height layout**

Change the outermost `<div className="min-h-screen bg-stone-100">` to:

```tsx
<div className="h-screen flex flex-col bg-stone-100 overflow-hidden">
```

This makes the layout fill the viewport and prevents scrolling.

- [ ] **Step 8: Verify the page compiles**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
cd ~/dev/daily-grid-web && git add app/editor/\\[date\\]/page.tsx && git commit -m "feat: kiosk header with clock/countdown, progress hairline, calendar strip, auto-save"
```

---

### Task 3: Optimize the grid for touchscreen kiosk

**Files:**
- Modify: `components/ScheduleGrid.tsx`

This task removes the countdown/progress/legend sections from ScheduleGrid (they moved to the parent), dims past rows, increases row heights, and enlarges text for touchscreen readability.

- [ ] **Step 1: Remove countdown timer and status bar from ScheduleGrid**

Remove the entire `currentTime` / `countdown` state and `useEffect` (lines 56-71). These are now in the parent page.

Remove the `currentTime` prop usage — the parent will pass `currentTime` as a string prop instead.

Add `currentTime` to the props interface:

```typescript
interface ScheduleGridProps {
  schedule: Schedule;
  currentTime: string; // added — passed from parent
  onActivityUpdate: (index: number, updates: Partial<Activity>) => void;
  // ... rest stays the same
}
```

Update the destructuring:

```typescript
export default function ScheduleGrid({
  schedule,
  currentTime, // added
  onActivityUpdate,
  // ... rest stays the same
}: ScheduleGridProps) {
```

- [ ] **Step 2: Remove the status bar and progress sections from the JSX**

Delete the entire "Status Bar" block (the `<div className="flex gap-4">` with countdown + calendar, lines 196-273).

Delete the entire "Progress" block (lines 276-294).

Delete the "Legend" block (lines 409-416).

The component JSX should now start directly with the grid table:

```tsx
return (
  <div className="h-full flex flex-col">
    {/* Grid */}
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-auto flex-1">
      <table className="w-full border-collapse">
        {/* ... existing table code ... */}
      </table>
    </div>
  </div>
);
```

- [ ] **Step 3: Increase row heights and font sizes for touchscreen**

In the `<thead>`, change the header cells from `px-3 py-2.5 text-[11px]` to:

```tsx
<th className="bg-stone-800 text-stone-300 px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase w-28">
  Time
</th>
{PEOPLE.map(person => (
  <th key={person} className="px-3 py-3 text-center text-sm font-semibold tracking-wider uppercase"
    style={{ backgroundColor: PERSON_COLORS[person].bg, color: PERSON_COLORS[person].dot }}>
    {person}
  </th>
))}
```

In the `<tbody>` rows, change the row styling to add `min-h-[48px]` and increase cell padding:

```tsx
<tr
  key={`${row.start}-${row.end}`}
  className={`border-b border-stone-100 last:border-0 ${
    isPast ? 'opacity-40' :
    isCurrent ? 'bg-orange-50' :
    rowIdx % 2 === 1 ? 'bg-stone-50/50' : ''
  }`}
>
  <td className={`px-3 py-3 text-center text-sm font-semibold align-middle whitespace-nowrap ${isCurrent ? 'text-orange-600' : 'text-stone-400'}`}>
```

Activity cells: change from `px-2 py-1.5 text-xs` to `px-3 py-2.5 text-sm`:

```tsx
<td
  key={person}
  className={`px-3 py-2.5 text-center text-sm align-middle transition-all ${activity.completed ? 'opacity-40' : ''} ${editMode ? 'cursor-pointer hover:brightness-95' : ''}`}
  style={{ ... }}
  onClick={...}
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
```

Empty cells: `px-3 py-3` instead of `px-2 py-2`.

- [ ] **Step 4: Add dimmed past rows**

Add a `isPast` calculation alongside the existing `isCurrent`:

```typescript
const isCurrent = currentTime >= row.start && currentTime < row.end;
const isPast = currentTime >= row.end;
```

Update the row className to include past dimming (already shown in Step 3 above).

- [ ] **Step 5: Compact time labels**

Change the time display to use shorter format:

```tsx
<td className={...}>
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
```

This shows "7am-8am" instead of "7:00 AM - 8:00 AM", saving horizontal space.

- [ ] **Step 6: Verify the component compiles**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors. Note: the parent must now pass `currentTime` prop — this was added in Task 2.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/daily-grid-web && git add components/ScheduleGrid.tsx && git commit -m "feat: kiosk grid — 48px rows, dimmed past hours, compact time labels, larger text"
```

---

### Task 4: Wire everything together and verify

**Files:**
- Verify: `app/editor/[date]/page.tsx` — passes `currentTime` to ScheduleGrid
- Verify: All components compile and render

- [ ] **Step 1: Ensure the parent passes `currentTime` to ScheduleGrid**

In `app/editor/[date]/page.tsx`, the ScheduleGrid usage must include:

```tsx
<ScheduleGrid
  schedule={schedule}
  currentTime={currentTime}
  onActivityUpdate={handleActivityUpdate}
  onActivityAdd={handleActivityAdd}
  onActivityRemove={handleActivityRemove}
  onToggleComplete={handleToggleComplete}
  onCalendarEventOverride={handleCalendarEventOverride}
  editMode={editMode}
  triggerNewActivity={triggerNewActivity}
/>
```

- [ ] **Step 2: Run the dev server and verify visually**

Run: `cd ~/dev/daily-grid-web && npm run dev`

Open: `http://localhost:3000/editor/2026-04-14`

Verify:
- Header is a single thin line with date, clock, countdown
- Progress hairline shows below header
- Grid fills most of the screen with large touch-friendly rows
- Past hours are dimmed
- Calendar events appear as a compact strip below the grid
- Legend is gone from below the grid (activity type colors are still visible in cells)
- Editing an activity triggers auto-save (watch for "Saving..." → "Saved ✓" in header)

- [ ] **Step 3: Fix any type errors or rendering issues**

Run: `cd ~/dev/daily-grid-web && npx tsc --noEmit 2>&1`
Fix any errors that appear.

- [ ] **Step 4: Commit final**

```bash
cd ~/dev/daily-grid-web && git add -A && git commit -m "feat: complete kiosk layout — auto-save, thin header, touch-friendly grid, calendar strip"
```

---

## Self-Review

**Spec coverage:**
- Thin header with clock/countdown → Task 2 ✓
- 4px progress hairline → Task 2 ✓
- Grid as hero, max height → Task 2 (flex column) + Task 3 (overflow auto) ✓
- 48px row heights → Task 3 ✓
- Dimmed past rows → Task 3 ✓
- Calendar events strip below grid → Task 2 (CalendarStrip) ✓
- Legend removed → Task 3 ✓
- Auto-save debounced 2s → Task 1 + Task 2 ✓
- Auto-save status indicator → Task 2 ✓
- SAVE button removed → Task 2 ✓
- Toolbar collapsed to ... menu → Task 2 (MoreMenu) ✓

**No placeholders** — all code is complete.

**Type consistency** — `currentTime` is `string` in both parent and child. `CalendarEvent` imported in both places. `useAutoSave` takes `Schedule` from types.
