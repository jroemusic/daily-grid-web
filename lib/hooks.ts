// lib/hooks.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);

    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

const STORAGE_KEY = 'dg-last-person';
const DEFAULT_PERSON = 'Jason';

export function useLastPerson(): [string, (person: string) => void] {
  const [person, setPersonState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PERSON;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PERSON;
  });

  const setPerson = useCallback((p: string) => {
    setPersonState(p);
    localStorage.setItem(STORAGE_KEY, p);
  }, []);

  return [person, setPerson];
}
