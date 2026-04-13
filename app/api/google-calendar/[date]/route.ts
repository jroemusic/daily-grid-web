import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google-calendar/[date] - Get calendar events using refresh token
 *
 * Uses OAuth refresh token to access Google Calendar API directly
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Get refresh token from environment
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google Calendar credentials not configured', events: [] },
        { status: 501 }
      );
    }

    // Exchange refresh token for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      console.error('Failed to refresh token:', await tokenResponse.text());
      return NextResponse.json(
        { error: 'Failed to refresh Google access token', events: [] },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Compute dynamic timezone offset for America/New_York
    const dateObj = new Date(date + 'T00:00:00');
    const utcDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'UTC' }));
    const estDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const offsetMinutes = (utcDate.getTime() - estDate.getTime()) / 60000;
    const offsetHours = Math.trunc(offsetMinutes / 60);
    const offsetRemainder = Math.abs(offsetMinutes % 60);
    const offsetSign = offsetHours >= 0 ? '-' : '+';
    const offsetStr = `${offsetSign}${String(Math.abs(offsetHours)).padStart(2, '0')}:${String(offsetRemainder).padStart(2, '0')}`;

    const startOfDay = `${date}T00:00:00${offsetStr}`;
    const endOfDay = `${date}T23:59:59${offsetStr}`;

    // Fetch from all family calendars
    const calendarIds = [
      'primary',
      'jandkaymusic@gmail.com',
      'vppqsrush6srtu99lle2ifetrkobh5af@import.calendar.google.com',
      '5uv8d4df4tsms9427jgqo64vjuktheme@import.calendar.google.com'
    ];

    const CALENDAR_PERSON_MAP: Record<string, string> = {
      'primary': 'Jason',
      'jroemusic@gmail.com': 'Jason',
      'jandkaymusic@gmail.com': 'Kay',
      'vppqsrush6srtu99lle2ifetrkobh5af@import.calendar.google.com': 'Kay',
      '5uv8d4df4tsms9427jgqo64vjuktheme@import.calendar.google.com': 'Jason'
    };

    const allEvents: any[] = [];

    for (const calId of calendarIds) {
      try {
        const calEventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${encodeURIComponent(startOfDay)}&timeMax=${encodeURIComponent(endOfDay)}&singleEvents=true&orderBy=startTime`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (calEventsResponse.ok) {
          const calEventsData = await calEventsResponse.json();
          const calEvents = (calEventsData.items || []).map((item: any) => ({
            id: item.id,
            summary: item.summary || 'No title',
            start: item.start?.dateTime || item.start?.date || '',
            end: item.end?.dateTime || item.end?.date || '',
            person: CALENDAR_PERSON_MAP[calId] || 'Jason',
            location: item.location,
            description: item.description
          }));
          allEvents.push(...calEvents);
        }
      } catch (calError) {
        console.warn(`Failed to fetch calendar ${calId}:`, calError);
      }
    }

    // Deduplicate by event ID
    const seen = new Set<string>();
    const events = allEvents.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    return NextResponse.json({ events, date });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', details: error instanceof Error ? error.message : 'Unknown error', events: [] },
      { status: 500 }
    );
  }
}
