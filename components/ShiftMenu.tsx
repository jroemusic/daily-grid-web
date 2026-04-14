// components/ShiftMenu.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { countAffectedActivities } from '@/lib/shiftCascade';
import { formatTimeDisplay } from '@/lib/time';
import { Activity } from '@/lib/types';

interface ShiftMenuProps {
  activity: Activity;
  person: string;
  allActivities: Activity[];
  position: { x: number; y: number };
  onShift: (shiftMinutes: number, cascade: boolean) => void;
  onClose: () => void;
}

export default function ShiftMenu({
  activity,
  person,
  allActivities,
  position,
  onShift,
  onClose,
}: ShiftMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const affectedCount = countAffectedActivities(allActivities, person, activity.start);

  // Animate in after mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Dismiss on outside click/tap — use touchend not touchstart to avoid closing during scroll
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    function handleTouch(e: TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchend', handleTouch as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchend', handleTouch as any);
    };
  }, [onClose]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 150); // Wait for fade-out animation
  }

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 340),
    top: Math.max(10, position.y - 200),
    zIndex: 50,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
    transition: 'opacity 150ms ease, transform 150ms ease',
  };

  const timeDisplay = formatTimeDisplay(activity.start).replace(':00', '').replace(' ', '').toLowerCase();

  return (
    <div ref={ref} style={menuStyle} className="bg-white rounded-xl shadow-xl border border-stone-200 w-80 overflow-hidden"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="px-4 py-3 bg-stone-800 text-white">
        <div className="font-bold text-sm">Shift from {timeDisplay} onward</div>
        <div className="text-stone-300 text-xs mt-0.5">
          Moves <strong className="text-white">{affectedCount}</strong> activit{affectedCount !== 1 ? 'ies' : 'y'} for {person}
        </div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onShift(60, true); }}
            className="bg-orange-50 border-2 border-orange-300 text-orange-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: 44 }}
          >
            +1 hour
          </button>
          <button
            onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onShift(30, true); }}
            className="bg-orange-50 border-2 border-orange-200 text-orange-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: 44 }}
          >
            +30 min
          </button>
          <button
            onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onShift(-30, true); }}
            className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: 44 }}
          >
            -30 min
          </button>
          <button
            onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onShift(-60, true); }}
            className="bg-blue-50 border-2 border-blue-300 text-blue-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: 44 }}
          >
            -1 hour
          </button>
        </div>
        <button
          onClick={() => onShift(0, false)}
          className="w-full bg-stone-100 text-stone-600 px-3 py-3 rounded-lg text-xs font-semibold hover:bg-stone-200 transition-colors mb-2"
          style={{ touchAction: 'manipulation', minHeight: 44 }}
        >
          Just move &quot;{activity.title}&quot; only (no cascade)
        </button>
        <button
          onClick={handleClose}
          className="w-full bg-stone-50 text-stone-400 px-3 py-2 rounded-lg text-xs font-medium hover:bg-stone-100 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: 44 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
