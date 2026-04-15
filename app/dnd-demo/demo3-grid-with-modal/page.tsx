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

const HOLD_MS = 150;
const MOVE_PX = 25;
const GHOST_OFFSET_Y = 70;

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

interface PendingDrop {
  srcActivity: DemoActivity;
  srcPerson: string;
  srcSlot: string;
  destActivity: DemoActivity | null;
  destPerson: string;
  destSlot: string;
  dropX: number;
  dropY: number;
}

export default function Demo3GridWithModal() {
  const [activities, setActivities] = useState<DemoActivity[]>(getMockActivities);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [moves, setMoves] = useState(0);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [dragState, setDragState] = useState('idle');

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLog(prev => [...prev.slice(-19), `[${ts}] ${msg}`]);
  }, []);

  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const actRef = useRef(activities);
  actRef.current = activities;
  const logRef = useRef(addLog);
  logRef.current = addLog;
  const dragStateRef = useRef(setDragState);
  dragStateRef.current = setDragState;

  const reset = useCallback(() => {
    setActivities(getMockActivities());
    setMoves(0);
    setPendingDrop(null);
  }, []);

  /* ========== Pointer drag logic ========== */
  useEffect(() => {
    const table = tableRef.current;
    const scrollContainer = scrollRef.current;
    if (!table || !scrollContainer) return;
    const log = (msg: string) => logRef.current(msg);
    const setDS = (s: string) => dragStateRef.current(s);

    let timer: ReturnType<typeof setTimeout> | null = null;
    let dragging = false;
    let sourceCell: HTMLTableCellElement | null = null;
    let sourceKey = '';
    let sourcePerson = '';
    let sourceSlot = '';
    let sourceActivity: DemoActivity | null = null;
    let ghost: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;
    let hoveredCell: HTMLTableCellElement | null = null;

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (ghost) { ghost.remove(); ghost = null; }
      if (sourceCell) { sourceCell.style.opacity = ''; sourceCell.style.outline = ''; }
      if (hoveredCell) { hoveredCell.style.outline = ''; hoveredCell = null; }
      scrollContainer!.style.touchAction = 'pan-y';
      dragging = false;
      sourceCell = null;
      sourceKey = '';
      sourcePerson = '';
      sourceSlot = '';
      sourceActivity = null;
    }

    function createGhost(cell: HTMLTableCellElement) {
      const rect = cell.getBoundingClientRect();
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.left = `${rect.left}px`;
      div.style.top = `${rect.top - GHOST_OFFSET_Y}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.style.zIndex = '9999';
      div.style.pointerEvents = 'none';
      div.style.opacity = '0.9';
      div.style.borderRadius = '8px';
      div.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
      div.style.background = getActivityColor(sourceActivity!.type);
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
      ghost.style.transform = `translate3d(${cx - startX}px, ${cy - startY - GHOST_OFFSET_Y}px, 0)`;
    }

    function highlightTarget(cx: number, cy: number) {
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
        cell.style.outline = occupied ? '3px solid #f97316' : '3px solid #3b82f6';
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
      if (!targetCell) {
        log(`drop: no cell found at ${cx},${cy} (el=${el?.tagName})`);
        return;
      }
      if (targetCell.dataset.cellkey === sourceKey) {
        log(`drop: same cell — ignoring`);
        return;
      }

      const [tPerson, tSlot] = targetCell.dataset.cellkey!.split('::');
      const targetAct = findActivityAt(actRef.current, tPerson, tSlot);
      log(`drop: ${tPerson}::${tSlot} ${targetAct ? `has "${targetAct.title}"` : 'empty'} → showing modal`);

      const targetRect = targetCell.getBoundingClientRect();
      setPendingDrop({
        srcActivity: sourceActivity!,
        srcPerson: sourcePerson,
        srcSlot: sourceSlot,
        destActivity: targetAct ?? null,
        destPerson: tPerson,
        destSlot: tSlot,
        dropX: targetRect.left + targetRect.width / 2 - 120,
        dropY: targetRect.top,
      });
    }

    function onPointerDown(e: PointerEvent) {
      const cell = closestCell(e.target as Element);
      if (!cell || !cell.dataset.cellkey) {
        log(`down: no cell (target=${(e.target as Element).tagName})`);
        return;
      }

      const [person, slot] = cell.dataset.cellkey!.split('::');
      const act = findActivityAt(actRef.current, person, slot);
      if (!act) {
        log(`down: empty cell ${person}::${slot}`);
        return;
      }

      log(`down: ${act.title} at ${person}::${slot} ptrId=${e.pointerId}`);
      setDS('holding');
      startX = e.clientX;
      startY = e.clientY;
      sourceCell = cell;
      sourceKey = cell.dataset.cellkey;
      sourcePerson = person;
      sourceSlot = slot;
      sourceActivity = act;

      timer = setTimeout(() => {
        if (!sourceCell) return;
        dragging = true;
        timer = null;
        log(`DRAG START: ${sourceActivity!.title}`);
        setDS('dragging');
        if (navigator.vibrate) navigator.vibrate(50);
        scrollContainer!.style.touchAction = 'none';
        sourceCell.style.opacity = '0.35';
        sourceCell.style.outline = '2px dashed #999';
        sourceCell.style.outlineOffset = '-2px';
        sourceCell.setPointerCapture(e.pointerId);
        createGhost(sourceCell);
      }, HOLD_MS);
    }

    function onPointerMove(e: PointerEvent) {
      if (timer) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > MOVE_PX || Math.abs(dy) > MOVE_PX) {
          log(`hold cancelled: moved ${Math.round(dx)},${Math.round(dy)}`);
          setDS('idle');
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
        log(`up: short tap (no drag)`);
        setDS('idle');
        cleanup();
        return;
      }
      if (!dragging) {
        log(`up: not dragging`);
        cleanup();
        return;
      }
      log(`DROP at ${e.clientX},${e.clientY}`);
      setDS('dropped');
      doDrop(e.clientX, e.clientY);
      cleanup();
    }

    function onPointerCancel() { cleanup(); }

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
  }, []);

  /* ========== Drop actions ========== */

  function executeSwap() {
    if (!pendingDrop) return;
    addLog(`SWAP: "${pendingDrop.srcActivity.title}" ↔ "${pendingDrop.destActivity?.title ?? '(empty→move)'}"`);
    const { srcActivity, srcPerson, srcSlot, destActivity, destPerson, destSlot } = pendingDrop;
    if (!destActivity) { executeMove(); return; }
    setActivities(prev => prev.map(a => {
      if (a.id === srcActivity.id) return { ...a, person: destPerson, start: destSlot, end: destSlot };
      if (a.id === destActivity.id) return { ...a, person: srcPerson, start: srcSlot, end: srcSlot };
      return a;
    }));
    setMoves(m => m + 1);
    setPendingDrop(null);
    setDragState('idle');
  }

  function executeCopy() {
    if (!pendingDrop) return;
    addLog(`COPY: "${pendingDrop.srcActivity.title}" → ${pendingDrop.destPerson}::${pendingDrop.destSlot}`);
    const { srcActivity, destActivity, destPerson, destSlot } = pendingDrop;
    setActivities(prev => {
      // Remove existing activity at destination if occupied
      const filtered = destActivity
        ? prev.filter(a => a.id !== destActivity.id)
        : prev;
      return [...filtered, {
        id: `act-${Date.now()}`,
        title: srcActivity.title,
        start: destSlot,
        end: destSlot,
        person: destPerson,
        type: srcActivity.type,
      }];
    });
    setMoves(m => m + 1);
    setPendingDrop(null);
    setDragState('idle');
  }

  function executeMove() {
    if (!pendingDrop) return;
    addLog(`MOVE: "${pendingDrop.srcActivity.title}" → ${pendingDrop.destPerson}::${pendingDrop.destSlot}`);
    const { srcActivity, destPerson, destSlot } = pendingDrop;
    setActivities(prev => prev.map(a =>
      a.id === srcActivity.id ? { ...a, person: destPerson, start: destSlot, end: destSlot } : a
    ));
    setMoves(m => m + 1);
    setPendingDrop(null);
    setDragState('idle');
  }

  /* ========== Render ========== */

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '12px 8px 32px', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, padding: '10px 14px', background: '#1e293b', borderRadius: 10, color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
          Demo 3: Pointer Events + Drop Modal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 6 }}>
            Moves: {moves}
          </span>
          <button onClick={reset} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Touch &amp; hold to drag. Drop shows Swap / Copy / Move.
      </div>

      {/* Debug panel */}
      <div style={{
        background: '#0f172a', color: '#22d3ee', fontFamily: 'monospace', fontSize: 11,
        padding: '8px 10px', borderRadius: 8, marginBottom: 10, maxHeight: 140, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>DEBUG — state: {dragState}</span>
          <button onClick={() => setDebugLog([])} style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>clear</button>
        </div>
        {debugLog.map((line, i) => (
          <div key={i} style={{ lineHeight: 1.4, opacity: i < debugLog.length - 5 ? 0.4 : 1 }}>{line}</div>
        ))}
        {debugLog.length === 0 && <div style={{ color: '#64748b' }}>Touch/hold an activity to see events...</div>}
      </div>

      {/* Grid */}
      <div ref={scrollRef} style={{ overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', maxHeight: 'calc(100vh - 130px)', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f1f5f9', padding: '10px 6px', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '2px solid #cbd5e1', width: 48, textAlign: 'center' }}>
                Time
              </th>
              {PEOPLE.map(person => {
                const pc = PERSON_COLORS[person];
                return (
                  <th key={person} style={{ position: 'sticky', top: 0, zIndex: 2, background: pc.bg, padding: '10px 4px', fontSize: 13, fontWeight: 700, color: pc.dot, borderBottom: `2px solid ${pc.border}`, textAlign: 'center' }}>
                    {person}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {DEMO_SLOTS.map((slot, rowIdx) => (
              <tr key={slot}>
                <td style={{ padding: '8px 4px', fontSize: 12, fontWeight: 600, color: '#64748b', textAlign: 'center', background: rowIdx % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                  {formatSlot(slot)}
                </td>
                {PEOPLE.map(person => {
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
                        touchAction: 'none',
                        cursor: act ? 'grab' : 'default',
                      }}
                    >
                      {act ? (
                        <div style={{ background: bgColor, color: textColor, fontSize: 12, fontWeight: 600, padding: '6px 5px', borderRadius: 4, margin: '3px 3px', textAlign: 'center', lineHeight: 1.2, minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `3px solid ${pc.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                          {act.title}
                        </div>
                      ) : (
                        <div style={{ color: '#cbd5e1', fontSize: 18, textAlign: 'center', padding: '6px', minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          +
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drop Modal */}
      {pendingDrop && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(pendingDrop.dropX, window.innerWidth - 280),
            top: Math.min(Math.max(10, pendingDrop.dropY - 20), window.innerHeight - 280),
            zIndex: 50,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            border: '1px solid #e2e8f0',
            width: 240,
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '10px 14px', background: '#1e293b', color: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Drop &quot;{pendingDrop.srcActivity.title}&quot;?</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              {pendingDrop.srcPerson} {pendingDrop.srcSlot} → {pendingDrop.destPerson} {pendingDrop.destSlot}
            </div>
          </div>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(20); executeSwap(); }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '2px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}
            >
              ↔ Swap
            </button>
            {pendingDrop.destActivity && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4, marginTop: -2 }}>
                Trades with &quot;{pendingDrop.destActivity.title}&quot;
              </div>
            )}
            <button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(20); executeCopy(); }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '2px solid #22c55e', background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}
            >
              ⊕ Copy
            </button>
            <div style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4, marginTop: -2 }}>
              Duplicate to {pendingDrop.destPerson} {pendingDrop.destSlot}
            </div>
            <button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(20); executeMove(); }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '2px solid #f97316', background: '#fff7ed', color: '#c2410c', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}
            >
              → Move
            </button>
            <div style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4, marginTop: -2 }}>
              {pendingDrop.srcPerson} {pendingDrop.srcSlot} empties
            </div>
            <button
              onClick={() => setPendingDrop(null)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', background: '#f8fafc', color: '#64748b', fontSize: 12, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation', marginTop: 4 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Backdrop for modal */}
      {pendingDrop && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setPendingDrop(null)}
        />
      )}
    </div>
  );
}
