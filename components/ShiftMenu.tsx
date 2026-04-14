// components/ShiftMenu.tsx
'use client';

import { useEffect, useRef } from 'react';
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

  const affectedCount = countAffectedActivities(allActivities, person, activity.start);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick as any);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 340),
    top: Math.max(10, position.y - 200),
    zIndex: 50,
  };

  const timeDisplay = formatTimeDisplay(activity.start).replace(':00', '').replace(' ', '').toLowerCase();

  return (
    <div ref={ref} style={menuStyle} className="bg-white rounded-xl shadow-xl border border-stone-200 w-80 overflow-hidden">
      <div className="px-4 py-3 bg-stone-800 text-white">
        <div className="font-bold text-sm">Shift from {timeDisplay} onward</div>
        <div className="text-stone-300 text-xs mt-0.5">
          Moves <strong className="text-white">{affectedCount}</strong> activit{affectedCount !== 1 ? 'ies' : 'y'} for {person}
        </div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => onShift(60, true)}
            className="bg-orange-50 border-2 border-orange-300 text-orange-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition"
          >
            +1 hour
          </button>
          <button
            onClick={() => onShift(30, true)}
            className="bg-orange-50 border-2 border-orange-200 text-orange-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition"
          >
            +30 min
          </button>
          <button
            onClick={() => onShift(-30, true)}
            className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
          >
            -30 min
          </button>
          <button
            onClick={() => onShift(-60, true)}
            className="bg-blue-50 border-2 border-blue-300 text-blue-800 px-3 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
          >
            -1 hour
          </button>
        </div>
        <button
          onClick={() => onShift(0, false)}
          className="w-full bg-stone-100 text-stone-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-stone-200 transition mb-2"
        >
          Just move &quot;{activity.title}&quot; only (no cascade)
        </button>
        <button
          onClick={onClose}
          className="w-full bg-stone-50 text-stone-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-stone-100 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
