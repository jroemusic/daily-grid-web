# Daily Grid: Living Room Kiosk Layout

**Date:** 2026-04-14
**Status:** Approved
**Context:** Touchscreen PC in family living room, displayed full-screen so everyone knows what they should be doing.

## Design Principle

*"If Toby can look at the screen and understand 'it's guitar lesson time' without asking anyone, the design works."*

The grid is the hero. Everything else gets out of the way.

## Layout (top to bottom)

### 1. Thin Header Bar (single line, ~48px)

- **Left:** Day name + date (e.g. "Tuesday — Apr 14"), `text-lg font-bold`
- **Center:** Current time in large tabular numerals (e.g. "2:47 PM")
- **Right:** Countdown to next hour (e.g. "13 min left"), compact
- **Toolbar buttons collapse into a "..." menu** (or stay as small icons). Only essential actions visible: edit toggle, +Activity. Everything else (templates, print, save template, sync cal) goes into a dropdown or stays as small icon buttons.
- Sticky at top, `z-20`

### 2. Time-of-Day Progress Hairline (4px)

- Full-width bar showing how far through the day (7AM–10PM) we are
- No card, no label, no padding — just a thin gradient line
- Fill color: warm orange gradient transitioning to green at end
- Background: `stone-200`
- Replaces the current progress card entirely

### 3. Schedule Grid (hero element, fills remaining viewport)

- **Row height:** minimum 48px for touch targets
- **Font sizes:** activity titles 18-20px, time labels 16px, person headers 18-20px
- **Person columns:** equal width, color-coded headers (Jason blue, Kay pink, Emma green, Toby orange)
- **Time column:** fixed width, shows hour labels compactly (7a, 8a, ... 10p)
- **Current time row:** highlighted with warm orange background + "NOW" pill
- **Past hours:** slightly dimmed (opacity 0.5) so current/future stand out
- **Empty cells:** show subtle "+" on hover/tap for adding activities
- **Calendar events in cells:** blue background, same size as activities
- **Completion checkboxes:** 24px touch target within cells
- **Grid takes maximum available height** — no wasted vertical space

### 4. Calendar Events Strip (below grid, compact)

- Single horizontal strip, not a card
- Shows each event as a compact pill: `[time] Event Name (person)`
- Disabled events shown grayed out with strikethrough
- Toggle and person assignment available on tap (same behavior, just condensed)
- Collapsible with a chevron toggle
- Default: expanded if events exist, collapsed if none

### 5. Legend (inline with calendar strip)

- Same row as calendar strip, right-aligned
- Compact: small color swatches with labels
- Activity type swatches only (no card wrapper)

## Auto-Save

**Debounced auto-save on all changes:**
- Activity create/edit/delete → save after 2 seconds of inactivity
- Calendar event overrides → already auto-saves (keep existing behavior)
- Checkbox completion → already auto-saves (keep existing behavior)
- Visual indicator: subtle "Saving..." / "Saved" text in header bar
- Remove the manual SAVE button from toolbar (replaced by auto-save)
- Keep a manual "Save" option in the "..." menu as backup

**Implementation:**
- Add a `useAutoSave` hook that watches `schedule.activities` and debounces `saveSchedule()`
- Use `useEffect` with a 2-second debounce timer
- Show save status in header: idle → "Saving..." → "Saved ✓" → fade out

## Files to Modify

1. `app/editor/[date]/page.tsx` — restructure header, add auto-save hook, remove SAVE button
2. `components/ScheduleGrid.tsx` — move countdown out, dim past rows, increase row heights, move calendar events below grid, inline legend, add progress hairline
3. `app/globals.css` or Tailwind — larger touch-friendly sizes, dimmed past rows

## Files NOT Modified

- `lib/types.ts` — no data structure changes
- API routes — no backend changes
- Dashboard/home page — separate concern
- Meal planning, templates — keep existing behavior

## Out of Scope

- Dark mode (can add later)
- Kiosk/fullscreen mode (browser handles F11)
- Person column tap-for-detail view
- Auto-dismiss detail modal on inactivity
- Mobile responsive (this is a fixed touchscreen PC)
