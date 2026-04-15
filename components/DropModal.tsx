// components/DropModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity } from '@/lib/types';
import { timesOverlap, timeToMinutes, minutesToTime } from '@/lib/time';

export interface PendingDrop {
  srcActivity: Activity;
  srcPerson: string;
  srcTime: string;
  destActivity: Activity | null;
  destPerson: string;
  destTime: string;
  destEndTime: string;
  dropPosition: { x: number; y: number };
}

interface DropModalProps {
  pending: PendingDrop;
  allActivities: Activity[];
  onSwap: () => void;
  onCopy: () => void;
  onMove: () => void;
  onClose: () => void;
}

export default function DropModal({
  pending,
  allActivities,
  onSwap,
  onCopy,
  onMove,
  onClose,
}: DropModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Dismiss on outside click/tap — gated behind a new pointer interaction
  // so residual drag-release events don't close the modal
  useEffect(() => {
    let dismissed = false;
    let sawNewPointerDown = false;

    function onPointerDown() {
      sawNewPointerDown = true;
    }

    function handleClick(e: MouseEvent) {
      if (dismissed || !sawNewPointerDown) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    function handleTouch(e: TouchEvent) {
      if (dismissed || !sawNewPointerDown) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (dismissed) return;
      if (e.key === 'Escape') handleClose();
    }

    // Wait for drag-release events to clear, then start listening for a NEW touch/click
    const attachTimer = setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('touchend', handleTouch as any);
      document.addEventListener('keydown', handleKey);
    }, 200);

    return () => {
      dismissed = true;
      clearTimeout(attachTimer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchend', handleTouch as any);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 150);
  }

  // Check for overlaps at destination (for Copy and Move)
  const srcDuration = timeToMinutes(pending.srcActivity.end) - timeToMinutes(pending.srcActivity.start);
  const destEndFormatted = minutesToTime(timeToMinutes(pending.destTime) + srcDuration);

  // Find overlapping activity for the destination person (excluding source and destination activities)
  const overlapActivity = allActivities.find(a => {
    if (a.id === pending.srcActivity.id) return false;
    if (pending.destActivity && a.id === pending.destActivity.id) return false;
    if (!a.people.includes(pending.destPerson)) return false;
    return timesOverlap(pending.destTime, destEndFormatted, a.start, a.end);
  });

  const hasDestActivity = pending.destActivity !== null;
  const hasOverlap = overlapActivity !== undefined;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(pending.dropPosition.x, window.innerWidth - 280),
    top: Math.min(Math.max(10, pending.dropPosition.y - 20), window.innerHeight - 350),
    zIndex: 50,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
    transition: 'opacity 150ms ease, transform 150ms ease',
  };

  return (
    <div ref={ref} style={menuStyle} className="bg-white rounded-xl shadow-xl border border-stone-200 w-64 overflow-hidden"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="px-4 py-2.5 bg-stone-800 text-white">
        <div className="font-bold text-xs">Drop &quot;{pending.srcActivity.title}&quot;?</div>
        <div className="text-stone-400 text-[10px] mt-0.5">
          {pending.srcPerson} {pending.srcTime} → {pending.destPerson} {pending.destTime}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <button
          onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onSwap(); handleClose(); }}
          className="w-full px-3 py-3 rounded-lg text-sm font-bold border-2 border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: 44 }}
        >
          ↔ Swap
        </button>
        {hasDestActivity && (
          <div className="text-[10px] text-stone-400 -mt-1 ml-1">
            Trades with &quot;{pending.destActivity!.title}&quot;
          </div>
        )}
        {hasOverlap && (
          <div className="text-[10px] text-amber-600 font-semibold -mt-1 ml-1">
            ⚠ Overlaps &quot;{overlapActivity!.title}&quot;
          </div>
        )}
        <button
          onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onCopy(); handleClose(); }}
          className="w-full px-3 py-3 rounded-lg text-sm font-bold border-2 border-green-400 bg-green-50 text-green-800 hover:bg-green-100 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: 44 }}
        >
          ⊕ Copy
        </button>
        <div className="text-[10px] text-stone-400 -mt-1 ml-1">
          Duplicate to {pending.destPerson} {pending.destTime}
        </div>
        <button
          onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onMove(); handleClose(); }}
          className="w-full px-3 py-3 rounded-lg text-sm font-bold border-2 border-orange-400 bg-orange-50 text-orange-800 hover:bg-orange-100 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: 44 }}
        >
          → Move
        </button>
        <div className="text-[10px] text-stone-400 -mt-1 ml-1">
          {pending.srcPerson} {pending.srcTime} empties
        </div>
        <button
          onClick={handleClose}
          className="w-full bg-stone-50 text-stone-400 px-3 py-2 rounded-lg text-xs font-medium hover:bg-stone-100 transition-colors mt-1"
          style={{ touchAction: 'manipulation', minHeight: 44 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
