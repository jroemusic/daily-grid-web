// lib/useLongPress.ts
'use client';

import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number;     // ms before long-press fires (default 500)
  moveTolerance?: number; // px of movement allowed before cancelling (default 10)
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  disabled?: boolean;
}

export function useLongPress({
  threshold = 500,
  moveTolerance = 10,
  onLongPress,
  onClick,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return;
    longPressFiredRef.current = false;

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    startPosRef.current = { x, y };

    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress(e);
    }, threshold);
  }, [disabled, onLongPress, threshold]);

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!startPosRef.current || !timerRef.current) return;

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    const dx = x - startPosRef.current.x;
    const dy = y - startPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > moveTolerance) {
      clear();
    }
  }, [moveTolerance, clear]);

  const end = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      clear();
      e.preventDefault();
      return;
    }
    clear();
    if (onClick && !disabled) {
      onClick(e);
    }
  }, [onClick, disabled, clear]);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: clear,
  };
}
