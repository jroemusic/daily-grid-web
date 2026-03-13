// Calendar integration utilities
// Note: Google Calendar API integration requires service account setup
// This is a placeholder implementation that returns mock data

import { CalendarEvent, CALENDAR_MAPPING } from './types';

export interface CalendarConfig {
  serviceAccountKey?: string; // JSON string from environment variable
  calendars?: string[];
}

/**
 * Get calendar events for a specific date
 * TODO: Implement with Google Calendar API
 *
 * To enable:
 * 1. Create Google Cloud project
 * 2. Enable Calendar API
 * 3. Create service account
 * 4. Share calendars with service account email
 * 5. Store service account JSON in environment variable GOOGLE_CALENDAR_CREDENTIALS
 */
export async function getCalendarEvents(
  date: string,
  config?: CalendarConfig
): Promise<CalendarEvent[]> {
  // Placeholder: return empty array for now
  // Once credentials are set up, this will fetch from Google Calendar API

  console.warn('Calendar integration not yet configured');

  return [];

  /* Future implementation:
  if (typeof window !== 'undefined') {
    // Client-side: call API route
    const response = await fetch(`/api/calendar/${date}`);
    if (!response.ok) throw new Error('Failed to fetch calendar events');
    return await response.json();
  }

  // Server-side implementation with Google Calendar API
  const { google } = await import('googleapis');
  const { GoogleAuth } = await import('google-auth-library');

  const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS!),
    scopes: ['https://www.googleapis.com/auth/calendar.readonly']
  });

  const calendar = google.calendar({ version: 'v3', auth });

  const calendars = config?.calendars || Object.keys(CALENDAR_MAPPING);
  const allEvents: CalendarEvent[] = [];

  for (const calendarId of calendars) {
    const response = await calendar.events.list({
      calendarId,
      timeMin: new Date(`${date}T00:00:00Z`).toISOString(),
      timeMax: new Date(`${date}T23:59:59Z`).toISOString(),
      singleEvents: true,
    });

    for (const item of response.data.items || []) {
      const person = CALENDAR_MAPPING[calendarId];
      allEvents.push({
        id: item.id || '',
        summary: item.summary || 'No title',
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        person,
        location: item.location,
        description: item.description
      });
    }
  }

  return allEvents;
  */
}

/**
 * Convert UTC calendar time to local time
 */
export function convertUTCToLocal(utcTimeStr: string): string {
  try {
    if (!utcTimeStr.includes('T')) return utcTimeStr;

    // Handle Z suffix (UTC)
    let normalized = utcTimeStr;
    if (utcTimeStr.endsWith('Z')) {
      normalized = utcTimeStr.replace('Z', '+00:00');
    }

    const dt = new Date(normalized);
    return dt.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return utcTimeStr;
  }
}

/**
 * Check if a calendar event overlaps with an activity
 */
export function calendarEventOverlaps(
  event: CalendarEvent,
  activityStart: string,
  activityEnd: string
): boolean {
  const eventStart = parseCalendarTime(event.start);
  const eventEnd = parseCalendarTime(event.end);
  const actStart = parseTimeToMinutes(activityStart);
  const actEnd = parseTimeToMinutes(activityEnd);

  return eventStart < actEnd && eventEnd > actStart;
}

function parseCalendarTime(timeStr: string): number {
  try {
    const date = new Date(timeStr);
    return date.getHours() * 60 + date.getMinutes();
  } catch {
    return 0;
  }
}

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d{2}):(\d{2})/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  return 0;
}
