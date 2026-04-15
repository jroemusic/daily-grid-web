# DnD Copy & Swap — Design Spec

Date: 2026-04-15

## Problem

The daily grid's drag-and-drop has several issues:
1. **No copy option** — only move and swap, no way to duplicate an activity
2. **Multi-person data loss** — dragging overwrites `people[]` to a single person
3. **60-minute lookup bug** — `handleDragEnd` hard-codes a 1-hour window, failing for non-standard durations (30min, 90min)
4. **Swap duration mismatch** — swapping doesn't account for overlaps correctly

## Design

### Post-Drop Modal

After any successful drag, a floating modal appears at the drop point with three options:

- **Swap** — Activities trade time slots and people columns
- **Copy** — Duplicate the dragged activity to destination; original stays
- **Move** — Original slot empties; activity moves to new time/person

Cancel (or tapping outside) dismisses with no change.

All three options are always shown regardless of whether the destination is empty or occupied.

### People Handling

| Action | Source activity people | Destination |
|--------|----------------------|-------------|
| Swap | Source person removed, dest person added | Dest activity gets source person added |
| Copy | Unchanged | New duplicate with dest person |
| Move | Source person removed, dest person added | N/A (slot empties) |

For multi-person activities (e.g. `["Jason", "Kay"]`):
- Only the dragged person's column is affected
- Other people on the activity remain unchanged

Example: Drag "Family Breakfast" (`["Jason", "Kay"]`) from Jason 8am to Emma 10am:
- **Swap** (Emma has "Piano"): Breakfast becomes `["Kay", "Emma"]` at 10am, Piano becomes `["Jason"]` at 8am
- **Copy**: New "Family Breakfast" with `["Emma"]` at 10am. Original `["Jason", "Kay"]` at 8am unchanged
- **Move**: Breakfast becomes `["Kay", "Emma"]` at 10am. Jason's 8am slot empties

### Technical Implementation

**Two-phase drag handling:**

1. **Phase 1 — Validate** (onDragEnd): Parse source/destination, look up activities, compute new times. Store result in state without mutating.
2. **Phase 2 — Execute** (modal callback): When user picks Swap/Copy/Move, apply the mutation.

**Fix 60-minute lookup bug:**
Use the row's actual end time from `uniqueRows` instead of hard-coding `srcTime + 60`.

**New DropModal component:**
- Receives pending drag result (source activity, destination activity, computed times)
- Renders 3 buttons + cancel
- Positioned at drop point (fixed positioning)
- Touch-friendly: 44px min targets, `touchAction: 'manipulation'`
- Dismisses on outside tap or Escape

**Data mutations:**
- Swap: `onActivitiesUpdate` (batch)
- Copy: `onActivityAdd` + `onActivityUpdate`
- Move: `onActivityUpdate`

No new dependencies.

### Edge Cases

**Time conflicts:**
- Move/Copy can cause overlaps — show a warning on the button ("Overlaps with Piano") but still allow it
- Swaps never conflict (activities trade positions)

**Calendar events:**
- Read-only, not draggable. No change needed.

**Duration preservation:**
- All operations preserve the dragged activity's original duration
- Swap preserves both activities' durations

**Undo support:**
- All operations push to existing undo stack before mutating

## Files Affected

- `components/ScheduleGrid.tsx` — Refactor handleDragEnd, add DropModal, fix lookup bug
- `components/DropModal.tsx` — New component for post-drop choice
- `app/editor/[date]/page.tsx` — Wire up copy handler (if needed beyond existing onActivityAdd)

## Out of Scope

- Drag-to-reorder within the same cell (not needed — each cell has 0 or 1 activity)
- Drag between days
- Drag-to-delete gesture
