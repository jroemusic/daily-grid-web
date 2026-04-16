# Mobile View Design — Daily Grid

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Responsive layout for phone and tablet viewports

## Overview

The Daily Grid app currently targets a kiosk touchscreen (21-27" display). This spec adds responsive mobile support for phones and tablets, using a dual-layout strategy: single-person view on narrow screens, compressed grid on wider screens.

## Responsive Strategy

**Breakpoint: 768px (Tailwind `md`)**

| Viewport | Layout | Component |
|---|---|---|
| < 768px (portrait phone) | Single-person schedule | `MobileScheduleView` (new) |
| >= 768px (landscape phone, tablet) | Compressed grid | `ScheduleGrid` (existing, adapted) |
| >= 1024px (kiosk, desktop) | Full layout | `ScheduleGrid` (unchanged) |

### Detection

A `useIsMobile()` hook in `lib/hooks.ts` wraps `window.matchMedia('(max-width: 767px)')` with a React state listener. The editor page (`app/editor/[date]/page.tsx`) conditionally renders either `MobileScheduleView` or `ScheduleGrid`.

---

## Narrow View (< 768px): Single-Person Schedule

### Header

Thin bar with: back arrow, day name + date, compact clock (no countdown badge). No action buttons in the header — those move to the bottom toolbar.

### Person Tabs

Horizontal tab row directly below the header. Four tabs: Jason (blue), Kay (pink), Emma (green), Toby (orange). Each tab shows the person name with a colored bottom border when selected.

- **Default person:** Last-selected person persisted in `localStorage` under key `dg-last-person`. Falls back to "Jason" if no stored value.
- **Swipe:** Left/right swipe on the schedule area switches to previous/next person (optional enhancement, not v1).
- Tabs are sticky — they stay visible while scrolling the schedule.

### Schedule List

A vertical list of time slots (7AM–10PM, 16 rows). Each row:

- **Time label** on the left (e.g., "7a", "8a"), 40px wide, right-aligned
- **Activity card** taking remaining width:
  - Background color from activity type
  - Left border in person color (3px)
  - Checkbox (24x24, tap to toggle complete)
  - Activity title (truncated if needed)
  - Tap anywhere on card to open edit bottom sheet
- **Empty slots** show a subtle "+" in edit mode, tap to add activity
- **Current hour** row has orange tint background + "NOW" badge
- **Past hours** dimmed to 40% opacity (matching kiosk behavior)
- Minimum row height: 48px (touch target)

### Bottom Toolbar

Fixed to bottom of viewport. Three buttons in a row:

1. **Undo** — same as current undo button, disabled when nothing to undo
2. **Add Activity** — green button, opens add bottom sheet with person pre-set to current tab
3. **More** (three dots) — dropdown with: Load Template, Sync Calendar, Print, Save as Template

All buttons: 48px minimum touch target, `touch-action: manipulation`.

### Drag-and-Drop (Narrow)

Single-column vertical drag within the current person's schedule. Uses the same pointer-events + touchmove preventDefault approach as the kiosk grid, but simplified since there's only one column:

- Hold 150ms on an activity to start drag
- Ghost follows finger vertically
- Drop on empty slot → Move (no Swap/Copy modal needed for single-column)
- Drop on occupied slot → show bottom sheet with Swap/Copy/Move options

---

## Wide View (>= 768px): Compressed Grid

Same current `ScheduleGrid` component with mobile adaptations applied via Tailwind responsive classes:

### Table Adaptations

- **Person headers:** font-size drops to 10px on screens < 1024px
- **Time column:** `w-28` → `w-20` on md breakpoint (80px instead of 112px)
- **Cell padding:** `py-3` → `py-2` on md breakpoint
- **Activity content:** hide the shift-chevron button on md, show on lg+
- **Table min-width:** `min-w-[540px]` ensures the table doesn't compress below usable width
- **Horizontal scroll:** scroll container gets `overflow-x: auto` on md
- **Sticky time column:** first `<th>` and all time-label `<td>` cells get `position: sticky; left: 0; z-index: 5` with a solid background color

### Header Adaptations

- Clock and countdown badge hide on md, show on lg
- Undo/Add/More buttons keep current positions but shrink padding slightly

---

## Modals on Mobile

### Activity Edit Modal → Bottom Sheet

On screens < 768px, the centered overlay modal becomes a bottom sheet:

- Slides up from bottom of viewport
- Drag handle bar (40px × 4px rounded pill) centered at top
- Full viewport width, max-height 85vh
- Rounded top corners (16px border-radius)
- Swipe down past 30% to dismiss
- Content: same fields (title, time, people, type, notes) but stacked vertically
- Input fields get `font-size: 16px` to prevent iOS Safari auto-zoom
- People selector: 2×2 grid instead of horizontal row
- Type selector: horizontal scrolling pills instead of wrapping grid
- Delete button at bottom with red background

### DropModal → Bottom Sheet

On narrow screens, the floating post-drop modal becomes a bottom sheet with the same three options (Swap, Copy, Move) stacked vertically. Full width, same drag handle and swipe-to-dismiss.

### ShiftMenu → Bottom Sheet

Same bottom sheet pattern for the time-shift menu.

### Implementation

A shared `BottomSheet` wrapper component in `components/BottomSheet.tsx`:
- Accepts children and `onClose` prop
- Handles the slide-up animation, drag handle, and swipe-to-dismiss
- Uses `touch-action: pan-y` on the sheet body to allow vertical swipe
- Renders via React portal to `document.body`

---

## Data & State

### Person Persistence

```typescript
// lib/hooks.ts
function useIsMobile(): boolean
function useLastPerson(): [string, (person: string) => void]
```

`useLastPerson` reads/writes localStorage key `dg-last-person`. The mobile view initializes its person tab from this hook.

### Shared State

Both `MobileScheduleView` and `ScheduleGrid` receive the same props (schedule, callbacks, edit mode). No state duplication — they're just different renderings of the same data. The editor page owns the state and passes it down.

---

## Out of Scope (v1)

- **Swipe to switch person** on the schedule area (gesture navigation between tabs)
- **Auto-scroll during drag** on narrow view (single-column drag targets are usually visible)
- **Pull-to-refresh** for calendar sync
- **Offline support** (already in PRD but separate effort)
- **Dark mode mobile adaptations** (dark mode works via OS preference already)

---

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `lib/hooks.ts` | Create | `useIsMobile()`, `useLastPerson()` hooks |
| `components/MobileScheduleView.tsx` | Create | Single-person schedule component |
| `components/BottomSheet.tsx` | Create | Reusable bottom sheet wrapper |
| `components/ScheduleGrid.tsx` | Modify | Add responsive Tailwind classes for md breakpoint |
| `components/DropModal.tsx` | Modify | Render as bottom sheet on mobile |
| `app/editor/[date]/page.tsx` | Modify | Conditional rendering based on viewport width |
