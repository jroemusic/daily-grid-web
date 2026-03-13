// Time utility functions

/**
 * Convert time string (HH:MM or HH:MM AM/PM) to minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  try {
    const cleaned = timeStr.trim().toUpperCase();

    // Handle AM/PM format
    if (cleaned.includes('AM') || cleaned.includes('PM')) {
      const match = cleaned.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const ampm = match[3];

        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        return hour * 60 + minute;
      }
    }

    // Handle HH:MM format
    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');
      const hour = parseInt(parts[0], 10);
      const minute = parseInt(parts[1], 10);
      return hour * 60 + minute;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Convert minutes from midnight to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  try {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  } catch {
    return '00:00';
  }
}

/**
 * Format time for display (e.g., "7:00 AM")
 */
export function formatTimeDisplay(timeStr: string): string {
  const minutes = timeToMinutes(timeStr);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Check if two time ranges overlap
 */
export function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && e1 > s2;
}

/**
 * Calculate duration in minutes between two times
 */
export function durationMinutes(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

/**
 * Sort activities by start time
 */
export function sortActivitiesByTime<T extends { start: string }>(activities: T[]): T[] {
  return [...activities].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

/**
 * Get day name from date
 */
export function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Format date for display (e.g., "March 13, 2026")
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Add days to a date
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
