'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PEOPLE,
  DEMO_SLOTS,
  PERSON_COLORS,
  getMockActivities,
  DemoActivity,
  getActivityColor,
  getTypeTextColor,
  formatSlot,
} from '@/components/dnd-demo/demo-data';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const HOLD_MS = 300;      // long-press threshold
const MOVE_PX = 8;        // movement that cancels long-press (scroll intent)
const GHOST_OFFSET_Y = 80; // ghost floats above finger
const VIBRATE_MS = 50;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cellKey(person: string, slot: string) {
  return `${person}::${slot}`;
}

function findActivityAt(
  activities: DemoActivity[],
  person: string,
  slot: string,
): DemoActivity | undefined {
  return activities.find((a) => a.person === person && a.start === slot);
}

/** Walk up from a DOM node to find the nearest <td> with a data-cellkey */
function closestCell(el: Element | null): HTMLTableCellElement | null {
  let node: Element | null = el;
  while (node && node.tagName !== 'TABLE') {
    if (node.tagName === 'TD' && (node as HTMLTableCellElement).dataset.cellkey) {
      return node as HTMLTableCellElement;
    }
    node = node.parentElement;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Demo1PointerEvents() {
  const [activities, setActivities] = useState<DemoActivity[]>(getMockActivities);
  const [moves, setMoves] = useState(0);

  /* refs that the raw-DOM event handlers close over */
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // We keep activities in a ref so the raw handlers always see fresh state
  // without needing to detach / reattach listeners on every render.
  const actRef = useRef(activities);
  actRef.current = activities;

  /* ---- reset ---- */
  const reset = useCallback(() => {
    setActivities(getMockActivities());
    setMoves(0);
  }, []);

  /* ================================================================ */
  /*  Pointer-event drag logic (raw DOM, attached in useEffect)       */
  /* ================================================================ */

  useEffect(() => {
    const table = tableRef.current;
    const scrollContainer = scrollRef.current;
    if (!table || !scrollContainer) return;

    /* per-drag mutable state ---------------------------------------- */
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dragging = false;
    let sourceCell: HTMLTableCellElement | null = null;
    let sourceKey = '';              // "person::slot"
    let sourcePerson = '';
    let sourceSlot = '';
    let sourceActivity: DemoActivity | null = null;
    let ghost: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;
    let hoveredCell: HTMLTableCellElement | null = null;

    /* helpers ------------------------------------------------------- */

    function cleanup() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      if (sourceCell) {
        sourceCell.style.opacity = '';
        sourceCell.style.outline = '';
      }
      if (hoveredCell) {
        hoveredCell.style.outline = '';
        hoveredCell = null;
      }
      scrollContainer!.style.touchAction = 'pan-y';
      dragging = false;
      sourceCell = null;
      sourceKey = '';
      sourcePerson = '';
      sourceSlot = '';
      sourceActivity = null;
    }

    function createGhost(cell: HTMLTableCellElement, x: number, y: number) {
      const rect = cell.getBoundingClientRect();
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.left = `${rect.left}px`;
      div.style.top = `${rect.top - GHOST_OFFSET_Y}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.style.zIndex = '9999';
      div.style.pointerEvents = 'none';
      div.style.opacity = '0.88';
      div.style.borderRadius = '8px';
      div.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
      div.style.background = cell.style.background || getActivityColor(sourceActivity!.type);
      div.style.color = getTypeTextColor(sourceActivity!.type);
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
      div.style.fontSize = '13px';
      div.style.fontWeight = '600';
      div.style.padding = '4px 6px';
      div.style.textAlign = 'center';
      div.style.lineHeight = '1.2';
      div.style.borderLeft = `4px solid ${PERSON_COLORS[sourcePerson]?.border || '#888'}`;
      div.textContent = sourceActivity!.title;
      div.style.willChange = 'transform';
      document.body.appendChild(div);
      ghost = div;
    }

    function moveGhost(cx: number, cy: number) {
      if (!ghost) return;
      // translate3d is GPU-composited
      ghost.style.transform = `translate3d(${cx - startX}px, ${cy - startY - GHOST_OFFSET_Y}px, 0)`;
    }

    function highlightTarget(cx: number, cy: number) {
      // Temporarily hide ghost so elementFromPoint hits the cell underneath
      if (ghost) ghost.style.display = 'none';
      const el = document.elementFromPoint(cx, cy);
      if (ghost) ghost.style.display = '';

      const cell = closestCell(el);

      if (hoveredCell && hoveredCell !== cell) {
        hoveredCell.style.outline = '';
      }

      if (cell && cell.dataset.cellkey !== sourceKey) {
        const [person, slot] = cell.dataset.cellkey!.split('::');
        const occupied = findActivityAt(actRef.current, person, slot);
        cell.style.outline = occupied
          ? '3px solid #f97316'   // orange = swap
          : '3px solid #3b82f6';  // blue = empty drop
        cell.style.outlineOffset = '-3px';
        hoveredCell = cell;
      } else {
        hoveredCell = null;
      }
    }

    function doDrop(cx: number, cy: number) {
      if (ghost) ghost.style.display = 'none';
      const el = document.elementFromPoint(cx, cy);
      if (ghost) ghost.style.display = '';

      const targetCell = closestCell(el);

      if (targetCell && targetCell.dataset.cellkey !== sourceKey) {
        const [tPerson, tSlot] = targetCell.dataset.cellkey!.split('::');
        const targetAct = findActivityAt(actRef.current, tPerson, tSlot);

        setActivities((prev) => {
          if (targetAct) {
            // SWAP
            return prev.map((a) => {
              if (a.id === sourceActivity!.id) return { ...a, person: tPerson, start: tSlot, end: tSlot };
              if (a.id === targetAct.id) return { ...a, person: sourcePerson, start: sourceSlot, end: sourceSlot };
              return a;
            });
          }
          // MOVE to empty
          return prev.map((a) =>
            a.id === sourceActivity!.id
              ? { ...a, person: tPerson, start: tSlot, end: tSlot }
              : a,
          );
        });
        setMoves((m) => m + 1);
      }
    }

    /* ---- event handlers ------------------------------------------- */

    function onPointerDown(e: PointerEvent) {
      const cell = closestCell(e.target as Element);
      if (!cell || !cell.dataset.cellkey) return;

      // Only start on cells that have an activity
      const [person, slot] = cell.dataset.cellkey!.split('::');
      const act = findActivityAt(actRef.current, person, slot);
      if (!act) return;

      startX = e.clientX;
      startY = e.clientY;
      sourceCell = cell;
      sourceKey = cell.dataset.cellkey;
      sourcePerson = person;
      sourceSlot = slot;
      sourceActivity = act;

      timer = setTimeout(() => {
        // Long-press confirmed => start drag
        if (!sourceCell) return;
        dragging = true;
        timer = null;

        // Vibrate
        if (navigator.vibrate) navigator.vibrate(VIBRATE_MS);

        // Freeze scroll
        scrollContainer!.style.touchAction = 'none';

        // Vacated style
        sourceCell.style.opacity = '0.35';
        sourceCell.style.outline = '2px dashed #999';
        sourceCell.style.outlineOffset = '-2px';

        // Capture pointer on source cell so we keep getting events
        sourceCell.setPointerCapture(e.pointerId);

        createGhost(sourceCell, startX, startY);
      }, HOLD_MS);
    }

    function onPointerMove(e: PointerEvent) {
      if (timer) {
        // Still in hold phase — check if user moved too much (scroll intent)
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > MOVE_PX || Math.abs(dy) > MOVE_PX) {
          cleanup();
        }
        return;
      }
      if (!dragging) return;

      moveGhost(e.clientX, e.clientY);
      highlightTarget(e.clientX, e.clientY);
    }

    function onPointerUp(e: PointerEvent) {
      if (timer) {
        // short tap — cancel
        cleanup();
        return;
      }
      if (!dragging) {
        cleanup();
        return;
      }

      doDrop(e.clientX, e.clientY);
      cleanup();
    }

    function onPointerCancel(_e: PointerEvent) {
      cleanup();
    }

    /* attach (passive: true is fine — we don't call preventDefault) */
    table.addEventListener('pointerdown', onPointerDown);
    table.addEventListener('pointermove', onPointerMove);
    table.addEventListener('pointerup', onPointerUp);
    table.addEventListener('pointercancel', onPointerCancel);

    return () => {
      table.removeEventListener('pointerdown', onPointerDown);
      table.removeEventListener('pointermove', onPointerMove);
      table.removeEventListener('pointerup', onPointerUp);
      table.removeEventListener('pointercancel', onPointerCancel);
      cleanup();
    };
  }, []); // mount once

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '12px 8px 32px',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      }}
    >
      {/* ---- Banner ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          padding: '10px 14px',
          background: '#1e293b',
          borderRadius: 10,
          color: '#fff',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
          Demo 1: Pointer Events
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              background: 'rgba(255,255,255,0.15)',
              padding: '3px 10px',
              borderRadius: 6,
            }}
          >
            Moves: {moves}
          </span>
          <button
            onClick={reset}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ---- Hint ---- */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#64748b',
          marginBottom: 10,
        }}
      >
        Touch &amp; hold an activity to drag. Drop on empty to move, drop on another to swap.
      </div>

      {/* ---- Scrollable grid container ---- */}
      <div
        ref={scrollRef}
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          maxHeight: 'calc(100vh - 130px)',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
        }}
      >
        <table
          ref={tableRef}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr>
              {/* Time column */}
              <th
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  background: '#f1f5f9',
                  padding: '10px 6px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#475569',
                  borderBottom: '2px solid #cbd5e1',
                  width: 48,
                  textAlign: 'center',
                }}
              >
                Time
              </th>
              {PEOPLE.map((person) => {
                const pc = PERSON_COLORS[person];
                return (
                  <th
                    key={person}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      background: pc.bg,
                      padding: '10px 4px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: pc.dot,
                      borderBottom: `2px solid ${pc.border}`,
                      textAlign: 'center',
                    }}
                  >
                    {person}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {DEMO_SLOTS.map((slot, rowIdx) => {
              const slotLabel = formatSlot(slot);
              return (
                <tr key={slot}>
                  {/* Time label */}
                  <td
                    style={{
                      padding: '8px 4px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      textAlign: 'center',
                      background: rowIdx % 2 === 0 ? '#f8fafc' : '#fff',
                      borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {slotLabel}
                  </td>
                  {PEOPLE.map((person) => {
                    const act = findActivityAt(activities, person, slot);
                    const pc = PERSON_COLORS[person];
                    const bgColor = act ? getActivityColor(act.type) : 'transparent';
                    const textColor = act ? getTypeTextColor(act.type) : '#94a3b8';
                    const ck = cellKey(person, slot);

                    return (
                      <td
                        key={ck}
                        data-cellkey={ck}
                        style={{
                          padding: 0,
                          borderBottom: '1px solid #e2e8f0',
                          borderLeft: `3px solid ${pc.border}`,
                          background: rowIdx % 2 === 0 ? '#f8fafc' : '#fff',
                          verticalAlign: 'middle',
                          height: 52,
                          minWidth: 44,
                          minHeight: 44,
                          position: 'relative',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          touchAction: 'none', // per-cell: let pointer events fire
                          cursor: act ? 'grab' : 'default',
                        }}
                      >
                        {act ? (
                          <div
                            style={{
                              background: bgColor,
                              color: textColor,
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '6px 5px',
                              borderRadius: 4,
                              margin: '3px 3px',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              minHeight: 38,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderLeft: `3px solid ${pc.border}`,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                            }}
                          >
                            {act.title}
                          </div>
                        ) : (
                          <div
                            style={{
                              color: '#cbd5e1',
                              fontSize: 18,
                              textAlign: 'center',
                              padding: '6px',
                              minHeight: 38,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
