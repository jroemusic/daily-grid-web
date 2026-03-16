# Daily Grid App - Product Requirements Document

## Project Overview

**Product Name:** Daily Grid
**Version:** 2.0
**Status:** Planning
**Last Updated:** March 16, 2026

---

## Key Design Decisions (Updated March 16)

- **Pin Only:** Simple PIN gate, no user accounts
- **Shared View:** Everyone sees the same full grid
- **Highlight Current User:** Just shows who's logged in at top
- **Anyone Can Edit:** No permission restrictions
- **Completed = Grayed Out:** Strikethrough + reduced opacity
- **Multi-Person Same as Single:** Checking off affects entire activity, not per-person
- **No Notifications (for now):** Skip push notifications
- **PWA:** Progressive Web App installable
- **Calendar Integration:** Full integration (see Flask app for reference)

---

## 1. User Identification

### Problem
Currently, anyone who accesses the app can see everything, but there's no personalization or user-specific tracking.

### Solution
Simple user selection system to identify who's using the app.

### Requirements

#### F1.1 - User Selection UI
- Display user avatars/buttons at top of screen
- 4 users: Jason, Kay, Emma, Toby
- Visual indicator showing who's currently logged in
- Persist selection in localStorage
- Default: "View All" mode

#### F1.2 - User-Specific View
- When user selected, highlight their column
- Filter to show only their activities
- Toggle to "Show All" to see full family grid

#### F1.3 - Per-Activity User Assignment
- Each activity already has `people` array
- Display user avatars in each activity cell
- Allow clicking to toggle user on/off for an activity

### Data Model

```typescript
interface User {
  id: string;
  name: string;
  color: string; // Avatar/indicator color
}

const USERS: User[] = [
  { id: 'jason', name: 'Jason', color: '#1976d2' },
  { id: 'kay', name: 'Kay', color: '#e91e63' },
  { id: 'emma', name: 'Emma', color: '#4caf50' },
  { id: 'toby', name: 'Toby', color: '#ff9800' }
];
```

---

## 2. Drag & Drop Rescheduling

### Problem
Users want to easily reschedule activities by dragging them to different time slots.

### Solution
Implement drag-and-drop for activity cells.

### Requirements

#### F2.1 - Drag Activity
- User can drag any activity cell
- Visual feedback: cell lifts, shadow appears
- Drop zones highlight on hover

#### F2.2 - Drop to Reschedule
- Drop on time slot row to reassign time
- Drop on another user's column to reassign person
- Auto-save to database after drop

#### F2.3 - Conflict Detection
- If two people dropped in same cell at same time, show warning
- Allow override or auto-adjust

#### F2.4 - Mobile Support
- Touch-and-hold to initiate drag
- Visual feedback for touch drag

### Technical Implementation

```typescript
// Using @dnd-kit/core
- Draggable: ActivityCell
- Droppable: TimeSlotRow, UserColumn
- onDragEnd: Handle reorder + save to API
```

### Edge Cases
- Dragging to a time that conflicts with existing activity
- Dragging when offline (queue changes)
- Undo capability for accidental drags

---

## 3. Check Off Activities

### Problem
Track what's been completed vs. what's pending.

### Solution
Checkbox/completion toggle for each activity.

### Requirements

#### F3.1 - Completion Toggle
- Checkbox or clickable circle in each activity
- Click to toggle: pending → done
- Visual change: strikethrough, opacity reduce, checkmark icon

#### F3.2 - Progress Tracking
- Progress bar at top showing % complete
- Count: "3 of 15 activities done"
- Per-user progress when logged in

#### F3.3 - Completion History
- Store completed timestamp
- Optional: show "completed at 9:45 AM"
- Ability to uncheck if marked by mistake

### Data Model

```typescript
interface Activity {
  id: string;
  // ... existing fields
  completed: boolean;
  completedAt?: string; // ISO timestamp
  completedBy?: string; // user ID
}
```

---

## 4. Time Auto-Detection

### Problem
Users want to see what's happening "now" and what's next.

### Solution
Auto-detect current time slot and highlight accordingly.

### Requirements

#### F4.1 - Current Time Slot
- Detect current time from browser
- Highlight current row (or cell for current user)
- Visual indicator: border, background tint, or "NOW" badge

#### F4.2 - Up Next Indicator
- Show what's next after current slot
- Countdown or "in X minutes" indicator

#### F4.3 - Timezone Handling
- Use user's local timezone
- Settings to override timezone
- Display timezone in footer

### Technical Implementation

```typescript
// Client-side hook
function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  return time;
}
```

---

## 5. Architecture Overview

### Frontend (Next.js)
- User selection: Component in header
- Drag & Drop: @dnd-kit/core
- Checkbox: ActivityCell component
- Time detection: useCurrentTime hook

### Backend (API)
- Existing endpoints already support activities
- Add: `PUT /api/activities/{id}` for completion
- Add: `PUT /api/schedules/{date}` for rescheduling

### Database (Supabase)
- Activities table already exists
- Add `completed`, `completedAt`, `completedBy` columns

---

## 6. Implementation Priority

| Priority | Feature | Notes |
|----------|---------|-------|
| P0 | User Identification | Who am I? |
| P1 | Check Off Activities | Basic tracking |
| P1 | Current Time Highlight | Now vs. later |
| P2 | Drag & Drop | Rescheduling |
| P2 | Progress Bar | Motivation |
| P3 | Undo/History | Recovery |

---

## 7. Mockups

### Header with User Selection
```
[Avatar: J] [Avatar: K] [Avatar: E] [Avatar: T]  |  [View All ▼]
─────────────────────────────────────────────────────────────
Daily Grid - Monday, March 16, 2026          [Today] [Progress: 33%]
```

### Activity Cell with Checkbox
```
┌─────────────────────────────────────┐
│ ✓ Lift/Shower                    │
│   Jason (You)                     │
│   9:00 AM - 10:00 AM             │
└─────────────────────────────────────┘
```

### Drag Feedback
```
[Dragging]
┌─────────────────────────────────────┐
│   👆 Lift/Shower (dragging)       │
└─────────────────────────────────────┘

[Drop Zone Highlight]
┌─────────────────────────────────────┐
│ ← DROP HERE                         │
│   10:00 AM - 11:00 AM              │
└─────────────────────────────────────┘
```

---

## 8. Success Metrics

- [ ] Users can identify themselves in app
- [ ] Activities can be marked complete
- [ ] Current time slot is visually highlighted
- [ ] Activities can be dragged to new times
- [ ] Progress tracking visible
- [ ] Works on mobile (touch drag)
- [ ] Offline-capable (queue changes)

---

## 9. Open Questions

1. Should we require login or keep PIN-only?
2. Should completed activities be hidden or shown differently?
3. How to handle multi-person activities (all check, or per-person)?
4. Notifications for "time's up" on current activity?
5. Integration with calendar events?

---

*PRD Created by Squip - March 16, 2026*
