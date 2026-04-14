// lib/useAutoSave.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Schedule } from './types';

interface AutoSaveOptions {
  delay?: number; // debounce ms, default 2000
  enabled?: boolean;
}

export function useAutoSave(
  schedule: Schedule | null,
  saveFn: (schedule: Schedule) => Promise<void>,
  options: AutoSaveOptions = {}
) {
  const { delay = 2000, enabled = true } = options;
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleJsonRef = useRef('');

  // Stringify current activities for deep comparison
  const currentJson = schedule ? JSON.stringify(schedule.activities) : '';

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !schedule || !schedule.activities?.length) return;
    if (currentJson === scheduleJsonRef.current) return;

    // First load — just record, don't save
    if (!scheduleJsonRef.current) {
      scheduleJsonRef.current = currentJson;
      return;
    }

    scheduleJsonRef.current = currentJson;
    clearTimer();
    setStatus('idle');

    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFn(schedule);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (e) {
        console.warn('Auto-save failed:', e);
        setStatus('idle');
      }
    }, delay);

    return clearTimer;
  }, [currentJson, enabled, schedule, saveFn, delay, clearTimer]);

  return status;
}
