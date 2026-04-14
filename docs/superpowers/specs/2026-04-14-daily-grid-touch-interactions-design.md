# Daily Grid: Touch Interactions — Drag, Long-Press, Shift

**Date:** 2026-04-14
**Status:** Approved
**Context:** Touchscreen PC in family living room. Grid is the hero element. Interactions must be intuitive for all family members including children.

## Design Principle

*"If Toby can move his piano practice to a different slot without asking anyone, the design works."*

Three gestures, three purposes. No hidden menus. No multi-step flows.

## Interactions

### 1. Tap → Edit Modal (existing)

No changes. Tap any activity cell → modal opens with title, time, people, type, notes. Already implemented and working.

### 2. Long-press (0.5s) → Shift Cascade Menu (NEW — killer feature)

Hold any activity for 500ms → a popup appears above the cell:

**Popup contents:**
- Title: "Shift from [time] onward"
- Subtitle: "Moves [activity name], [next activity], and everything after"
- Buttons: **+1 hour**, **+30 min**, **-30 min**, **-1 hour**
- Secondary option: "Just this one" (moves only the held activity, no cascade)
- Cancel

**Behavior:**
- Tap a shift amount → all activities from that time slot onward (for that person) shift by the selected amount
- If shifting would push an activity past 10pm, it gets clamped to 10pm
- If shifting would push an activity before 7am, it gets clamped to 7am
- Auto-saves after shift
- Only shifts activities for the person whose column was long-pressed, not all 4 people
- The popup shows a preview count: "This will move 5 activities"

**Implementation:**
- Custom `useLongPress` hook (~20 lines) — `touchstart`/`mousedown` with 500ms `setTimeout`
- Cancel on `touchmove` (finger moved = they're trying to drag, not shift)
- Shift logic: filter activities for that person with `start >= heldActivity.start`, adjust times, save

### 3. Long-press + drag → Move single activity with swap (NEW)

If the user holds for 500ms and then moves their finger (or mouse), the drag mode activates instead of the shift menu.

**Behavior:**
- The held activity "lifts" — gets a shadow, slight scale-up, follows the finger
- Drop zones highlight as the finger moves over cells
- On drop:
  - If target cell is empty → activity moves there
  - If target cell has an activity → **swap** — the two activities trade time slots
  - If target cell has a calendar event → drop rejected, activity snaps back
- Only moves within the same person's column (no cross-person drag in v1)
- Auto-saves after drop

**Implementation:**
- Library: **@dnd-kit/core** + `@dnd-kit/sortable` (~25KB)
- Touch sensor with `activationConstraint: { delay: 500 }` — same 500ms threshold as long-press
- Differentiate: if finger moves >10px after 500ms → drag mode. If finger stays still → shift menu.
- Each activity cell is a `Draggable`. Each grid cell is a `Droppable`.
- On drop: compare source and target, perform swap if occupied, save.

### Interaction Differentiation

Both long-press actions share the same 500ms hold threshold. The differentiation:

```
finger down → start 500ms timer
  → timer fires → show shift menu
  → finger moves >10px → cancel timer, enter drag mode
```

If the shift menu is already showing and the user starts dragging, dismiss the menu and enter drag mode.

## Files to Create/Modify

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/useLongPress.ts` | Create | Long-press detection hook (500ms, cancels on move) |
| `lib/useShiftCascade.ts` | Create | Shift cascade logic (filter activities by person+time, adjust times) |
| `components/ScheduleGrid.tsx` | Major modify | Add drag-and-drop via @dnd-kit, long-press shift menu, swap logic |
| `components/ShiftMenu.tsx` | Create | Popup menu for shift cascade (+1hr, +30m, etc.) |
| `package.json` | Modify | Add @dnd-kit/core and @dnd-kit/sortable |

## Files NOT Modified

- `app/editor/[date]/page.tsx` — no changes to header or layout
- `lib/useAutoSave.ts` — already works, picks up activity changes
- API routes — existing save endpoint handles everything
- `lib/types.ts` — no data structure changes

## Edge Cases

- **Activity spans multiple hours** (e.g., 9am-11am): shift moves the entire block. Drag moves the whole block to the new start time.
- **Overlapping after shift**: If shifting creates overlaps, the later activity adjusts to start right after the earlier one ends.
- **Calendar events**: Cannot be dragged or shifted. They're read-only from the grid side.
- **Empty cells**: Not draggable. Only activities can be dragged.
- **Completed activities**: Still draggable/shiftable. Don't prevent interaction just because something's done.

## Out of Scope

- Cross-person column drag (move activity from Jason to Kay)
- Drag to resize (extend/shrink duration)
- Undo button for shifts/drags
- Multi-select + bulk move
- Animation/transition effects on shift
