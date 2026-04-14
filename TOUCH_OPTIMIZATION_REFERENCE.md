# Touch-Optimized Web App Reference (2026)

For a family planner grid on kiosk touchscreens, tablets, and phones.

---

## 1. Touch Events: Pointer Events Win

**Use Pointer Events, not Touch Events.** Pointer Events unify mouse, touch, pen, and stylus into one API. Touch Events are the legacy API.

```js
// DO: Pointer Events (unified, modern)
element.addEventListener('pointerdown', handleStart);
element.addEventListener('pointermove', handleMove);
element.addEventListener('pointerup', handleEnd);

// DON'T: Separate mouse + touch handlers
element.addEventListener('touchstart', handleTouchStart);
element.addEventListener('mousedown', handleMouseDown);
// ... duplicates for move/end
```

**Key pointer event properties:**
- `event.pointerId` -- track individual fingers for multi-touch
- `event.pointerType` -- "mouse", "touch", "pen" (adapt behavior per input)
- `event.pressure` -- stylus pressure (0.0-1.0)
- `event.width` / `event.height` -- contact geometry (bigger = finger, 1x1 = mouse)

**Capturing pointer (keeps events flowing to element even if finger moves off):**
```js
element.addEventListener('pointerdown', (e) => {
  element.setPointerCapture(e.pointerId);
  // now pointermove/pointerup fire on THIS element even if finger leaves
});
```

**Passive event listeners -- when to use:**

```js
// PASSIVE: For listeners that NEVER call preventDefault()
// Lets browser start scrolling immediately without waiting for JS
element.addEventListener('touchstart', trackTouchStart, { passive: true });
element.addEventListener('touchmove', logPosition, { passive: true });

// NOT PASSIVE: When you MUST call preventDefault()
element.addEventListener('touchmove', preventScrollOnDraggable, { passive: false });
```

**Rule of thumb:** Chrome 56+ defaults `touchstart`/`touchmove` on `window`/`document`/`body` to passive. If you need `preventDefault()` on those targets, pass `{ passive: false }` explicitly.

**The 300ms delay is dead (mostly):**

This was caused by browsers waiting for double-tap-to-zoom. Solved by:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```
With this viewport meta tag, modern browsers skip the 300ms wait. No `touch-action: manipulation` needed as a fix, though it's still good practice (see section 3).

---

## 2. Drag-and-Drop on Touch: Library Recommendations

**The three real options in 2026:**

### @dnd-kit (Recommended for this project)
- **2.8M weekly downloads**, actively maintained, framework-agnostic core
- 6KB gzipped core, built-in touch sensor (`PointerSensor`)
- Uses CSS `transform` only (GPU-accelerated, no layout thrashing)
- Collision detection strategies: `closestCenter`, `closestCorners`, `rectIntersection`, `pointerWithin`
- Sortable preset with vertical/horizontal/grid strategies
- Accessibility built in (keyboard nav, screen reader announcements)

```js
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Configure sensor with activation constraints to distinguish tap from drag
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,       // must move 8px before drag starts (prevents accidental drags)
      // OR use delay:
      // delay: 150,      // must hold 150ms before drag starts
      // tolerance: 5,    // allow 5px movement during delay without canceling
    }
  })
);

function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',  // CRITICAL: prevents scroll interference during drag
      }}
      {...attributes}
      {...listeners}
    >
      {id}
    </div>
  );
}
```

### @atlaskit/pragmatic-drag-and-drop (Performance-critical)
- Atlassian's replacement for react-beautiful-dnd
- < 4KB, uses browser's native drag-and-drop under the hood
- Best for Jira/Trello scale (thousands of items)
- Lower-level API, more manual work
- Better for custom/non-standard interactions

### Custom Pointer Events (Maximum control)
For a grid planner where you're dragging time blocks between cells:

```js
function makeDraggable(element, { onDragStart, onDrag, onDragEnd }) {
  let startX, startY, isDragging = false;

  element.addEventListener('pointerdown', (e) => {
    element.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    isDragging = false;
  });

  element.addEventListener('pointermove', (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!isDragging && Math.hypot(dx, dy) > 8) {
      isDragging = true;
      onDragStart?.({ element, startX, startY });
    }
    if (isDragging) {
      // Use transform for 60fps (compositor-only, no layout)
      element.style.transform = `translate(${dx}px, ${dy}px)`;
      onDrag?.({ element, dx, dy, event: e });
    }
  });

  element.addEventListener('pointerup', (e) => {
    if (isDragging) {
      onDragEnd?.({ element, event: e });
    }
    element.style.transform = '';
    isDragging = false;
  });
}
```

**What makes drag feel smooth vs janky:**

| Smooth (do this) | Janky (avoid this) |
|---|---|
| CSS `transform: translate()` for position | `top`/`left` positioning |
| `will-change: transform` on draggable | Animating `width`/`height`/`margin` |
| `requestAnimationFrame` for updates | Updating DOM directly in move handler |
| Activation constraint (8px dead zone) | Immediate drag on any touch |
| `touch-action: none` on draggable element | Browser trying to scroll during drag |
| `user-select: none` during drag | Text selection triggering mid-drag |
| Single `transform` property change | Reading layout then writing (forced reflow) |

---

## 3. CSS for Touch

**The touch-optimized CSS reset (copy this):**

```css
/* === Global touch setup === */
html {
  overflow: hidden;                    /* Prevent document scroll in kiosk */
  overscroll-behavior: none;          /* Kill rubber-band on iOS/Android */
  -webkit-text-size-adjust: 100%;     /* Prevent auto text scaling */
}

body {
  overscroll-behavior: none;          /* No bounce, no pull-to-refresh */
  -webkit-user-select: none;          /* No text selection (kiosk) */
  user-select: none;
  -webkit-touch-callout: none;        /* No iOS callout menu */
  -webkit-tap-highlight-color: transparent; /* No blue flash on tap */
  touch-action: manipulation;         /* Pan + pinch OK, no double-tap zoom */
}

/* === Scrollable areas within the app === */
.scroll-container {
  overflow-y: auto;
  overscroll-behavior-y: contain;     /* Scroll stops HERE, doesn't chain to body */
  -webkit-overflow-scrolling: touch;  /* Momentum scrolling on iOS */
  touch-action: pan-y;                /* Only vertical pan */
}

/* === Interactive elements (buttons, cards, grid cells) === */
.interactive {
  touch-action: manipulation;         /* Allow scroll but kill double-tap zoom */
  -webkit-tap-highlight-color: transparent;
}

/* === Draggable elements === */
.draggable {
  touch-action: none;                 /* ALL touch handling via JS */
  user-select: none;
  cursor: grab;
}

.draggable:active {
  cursor: grabbing;
}

/* === Performance hints (use sparingly) === */
.will-animate {
  will-change: transform;             /* Promote to own compositor layer */
}

.drag-preview {
  will-change: transform, opacity;
  pointer-events: none;               /* Don't capture events on floating copy */
}
```

**`touch-action` values cheat sheet:**

| Value | Effect | Use when |
|---|---|---|
| `auto` | Browser handles everything | Default, rarely useful |
| `none` | Browser does nothing, you handle all touch | Draggable elements, canvas |
| `pan-x` | Only horizontal scroll allowed | Horizontal carousels |
| `pan-y` | Only vertical scroll allowed | Vertical scroll containers |
| `manipulation` | Pan + pinch-zoom OK, no double-tap zoom | General interactive elements |
| `pinch-zoom` | Only pinch-zoom | Map/image viewers |

**`overscroll-behavior` values:**

| Value | Effect |
|---|---|
| `auto` | Default -- scroll chains to parent, bounce effects |
| `contain` | No scroll chaining to parent, local bounce OK |
| `none` | No chaining, no bounce, no pull-to-refresh |

---

## 4. Touch Target Sizing

**WCAG 2.2 requirements (current standard):**

| Guideline | Min Size | Level | Notes |
|---|---|---|---|
| SC 2.5.8 Target Size (Minimum) | **24x24 CSS px** | AA | With spacing exception |
| SC 2.5.5 Target Size (Enhanced) | **44x44 CSS px** | AAA | Gold standard |

**For a family planner grid, target 44x44 minimum** -- kiosk users include kids.

**Make hit areas bigger than visible areas:**

```css
.grid-cell {
  /* Visible cell */
  width: 60px;
  height: 60px;
  position: relative;
}

.grid-cell::before {
  /* Invisible expanded hit area */
  content: '';
  position: absolute;
  top: -8px;
  right: -8px;
  bottom: -8px;
  left: -8px;
  /* No visual, just expands the tap target */
}

/* Or use padding for the same effect */
.icon-button {
  /* Icon is 24px but tap target is 44px */
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.icon-button svg {
  width: 24px;
  height: 24px;
  pointer-events: none; /* Events hit the padded parent */
}
```

**Minimum spacing between targets (WCAG 2.5.8 spacing exception):**

If a target is smaller than 24px, it can pass if the spacing around it brings the total "diameter" to 24px. But just make things 44px+ -- it's simpler and more usable.

**Grid layout spacing:**
```css
.planner-grid {
  display: grid;
  gap: 4px;  /* Minimum gap between touch targets */
  /* 4px gap + 60px cells = targets are well-separated */
}
```

---

## 5. Scrolling Performance

**The compositor thread model:**

Chrome uses separate threads: main (JS/CSSOM/layout/paint), compositor (scroll/transform compositing), raster, GPU. When scrolling only touches compositor-only properties, the main thread can be blocked and scrolling stays smooth.

**Compositor-only properties (animate these freely):**
- `transform` (translate, scale, rotate)
- `opacity`

**Properties that force main-thread work (avoid animating these):**
- `width`, `height`, `margin`, `padding`
- `top`, `left`, `right`, `bottom` (in non-transform context)
- `border-width`, `font-size`
- `box-shadow` (use a pseudo-element with opacity instead)
- `background-position` (use `transform: translate()` on the element instead)

**Virtualization for long lists (use @tanstack/react-virtual):**

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

function TimeSlotList({ slots }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: slots.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,       // estimated row height
    overscan: 5,                  // render 5 extra rows above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size,
              width: '100%',
            }}
          >
            <TimeSlot data={slots[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Passive scroll listeners:**

```js
// GOOD: passive scroll listener (doesn't block scroll)
scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

// BAD: non-passive scroll listener that reads layout
scrollContainer.addEventListener('scroll', () => {
  // Reading scrollHeight forces layout calculation
  const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
  // This is fine for passive -- just don't call preventDefault()
});

// AVOID: synchronous layout read + write in scroll handler
element.addEventListener('scroll', () => {
  const top = element.scrollTop;     // READ (forces layout)
  element.style.height = `${top}px`; // WRITE (invalidates layout)
  // ^ This creates a read-write-read cycle = jank
});
```

**`will-change` -- use correctly or not at all:**

```css
/* GOOD: Apply before animation starts, remove after */
.dragging {
  will-change: transform;
}

/* BAD: Apply to everything (wastes GPU memory) */
* {
  will-change: transform;  /* DON'T DO THIS */
}

/* GOOD: Apply to elements that WILL animate soon */
.card:hover {
  will-change: transform;  /* Card is about to be dragged */
}
```

**`contain` property for scroll performance:**
```css
.grid-row {
  contain: layout style paint;  /* Isolate this row's rendering */
  content-visibility: auto;     /* Skip rendering off-screen rows */
}
```

---

## 6. Common Touch Bugs and Fixes

### Ghost clicks (event fires after touch)
**Problem:** After a touch interaction, a `click` event fires ~300ms later, causing unintended actions.

```js
// Fix: Prevent the ghost click
element.addEventListener('pointerdown', (e) => {
  // pointer events don't have the ghost click problem
  // if you still use touch events:
  e.preventDefault(); // prevents the subsequent click event
});
```

With pointer events + viewport meta tag, ghost clicks are generally solved. If using legacy touch events, call `preventDefault()` on `touchend`.

### Scroll jacking (unintended scroll capture)
**Problem:** A touch handler on a parent element captures scroll events meant for a child.

```css
/* Fix: Use overscroll-behavior: contain on scrollable children */
.scroll-panel {
  overflow-y: auto;
  overscroll-behavior-y: contain;  /* Scroll stops here */
  touch-action: pan-y;             /* Only allow vertical scroll */
}
```

### Accidental drags (tapping triggers drag)
**Problem:** User taps a grid cell but it starts a drag operation.

```js
// Fix: Activation constraints (distance or delay threshold)
const sensor = useSensor(PointerSensor, {
  activationConstraint: {
    distance: 8,  // Must move 8px before drag activates
    // OR:
    // delay: 200,
    // tolerance: 5,  // Allow 5px jitter during delay
  }
});
```

### Context menu / long-press menu
**Problem:** Long-pressing an element shows browser context menu.

```js
// Fix: Prevent context menu on touch elements
element.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// CSS approach:
.touch-element {
  -webkit-touch-callout: none;  /* iOS */
}
```

### iOS rubber-banding / bounce scroll
**Problem:** Page bounces when scrolled past boundaries on iOS.

```css
html, body {
  overscroll-behavior: none;      /* Kill bounce on Chrome/Android */
  position: fixed;                /* Prevent document scroll entirely */
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* For iOS Safari, also need: */
html {
  -webkit-overflow-scrolling: auto; /* Disable momentum scroll if needed */
}
```

For iOS Safari, `position: fixed` on body is the most reliable way to kill rubber-banding. `overscroll-behavior: none` works on Chrome/Android but has spotty iOS Safari support.

### Text selection during drag
**Problem:** User starts dragging and text gets selected instead.

```css
body.dragging-active {
  user-select: none;
  -webkit-user-select: none;
}

/* Or per-element: */
.draggable {
  user-select: none;
  -webkit-user-select: none;
}
```

### Pinch-zoom in kiosk mode
**Problem:** Users accidentally pinch-zoom the page.

```html
<!-- In <head> -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

```css
html {
  touch-action: manipulation; /* Disables double-tap zoom */
  /* For complete lockout: */
  touch-action: none;
}
```

### Input focus causing scroll/zoom on iOS
**Problem:** Tapping an input field causes iOS Safari to zoom in.

```css
/* Ensure inputs have font-size >= 16px to prevent iOS auto-zoom */
input, textarea, select {
  font-size: 16px; /* iOS won't zoom if font >= 16px */
}
```

---

## 7. Kiosk Mode Specifics

**What's different about a permanent touchscreen:**

1. **No browser chrome** -- The app IS the interface. No back button, no address bar, no tabs.
2. **Users may not be tech-savvy** -- Kids, guests, non-technical family members.
3. **Always-on display** -- Screen burn-in, idle state handling, automatic refresh.
4. **No right-click** -- Context menus are useless, disable them.
5. **Fat finger syndrome** -- People press harder, less precise than phone touch.
6. **Multi-user** -- Different family members touching the same screen.

**Kiosk CSS reset:**

```css
/* === Kiosk Mode Base Styles === */
html, body {
  position: fixed;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;

  /* Kill all browser overscroll behavior */
  overscroll-behavior: none;

  /* Kill touch extras */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* Disable all context menus */
* {
  -webkit-touch-callout: none;
}

/* Prevent pull-to-refresh */
body {
  overscroll-behavior-y: none;
}
```

**Kiosk HTML setup:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#ffffff">
  <title>Daily Grid</title>
</head>
```

**Kiosk JS setup:**

```js
// Prevent all unwanted browser behaviors
document.addEventListener('contextmenu', e => e.preventDefault());

// Prevent pinch zoom
document.addEventListener('gesturestart', e => e.preventDefault());

// Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// Handle idle state (screen saver / dim)
let idleTimer;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  document.body.classList.remove('idle');
  idleTimer = setTimeout(() => {
    document.body.classList.add('idle');
  }, 5 * 60 * 1000); // 5 minutes
}
document.addEventListener('pointerdown', resetIdleTimer);
document.addEventListener('pointermove', resetIdleTimer);
resetIdleTimer();
```

**Preventing screen burn-in (OLED displays):**

```css
/* Subtle pixel shift every few seconds prevents burn-in */
@keyframes burn-in-prevention {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(1px, 0); }
  50% { transform: translate(1px, 1px); }
  75% { transform: translate(0, 1px); }
}

.kiosk-display {
  animation: burn-in-prevention 30s infinite;
  /* 1px shift is invisible to user but prevents OLED burn */
}
```

**Auto-refresh / heartbeat (kiosk stays alive):**

```js
// Periodic health check
setInterval(() => {
  fetch('/api/health')
    .then(res => { if (!res.ok) location.reload(); })
    .catch(() => location.reload());
}, 60000); // Check every minute

// Reload at 3am to clear memory leaks
const scheduled = new Date();
scheduled.setHours(3, 0, 0, 0);
if (scheduled < new Date()) scheduled.setDate(scheduled.getDate() + 1);
setTimeout(() => location.reload(), scheduled - new Date());
```

**Kiosk browser launch flags (Chrome):**

```bash
google-chrome \
  --kiosk \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-translate \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --app=http://localhost:3000
```

---

## Quick Checklist: Family Planner Grid

Before shipping, verify:

- [ ] Viewport meta tag with `maximum-scale=1, user-scalable=no`
- [ ] `overscroll-behavior: none` on html/body
- [ ] `touch-action: none` on draggable grid items
- [ ] `touch-action: pan-y` on scrollable columns
- [ ] All touch targets >= 44x44px
- [ ] Grid cells have expanded hit areas (::before pseudo-element or padding)
- [ ] Pointer events used (not mouse/touch event pairs)
- [ ] Passive listeners where `preventDefault` isn't needed
- [ ] Activation constraint (8px distance) on drag sensor
- [ ] `user-select: none` on interactive elements
- [ ] Context menu disabled
- [ ] `will-change: transform` only on elements about to animate
- [ ] No layout thrashing in scroll/drag handlers
- [ ] Idle state handling for kiosk mode
- [ ] Input font-size >= 16px (prevent iOS zoom)
- [ ] Tested on: iOS Safari, Chrome Android, Chrome desktop (touch), kiosk mode
