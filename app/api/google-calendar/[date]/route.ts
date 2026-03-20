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

    // Fetch calendar events for the date
    const startOfDay = `${date}T00:00:00-05:00`; // Eastern Time
    const endOfDay = `${date}T23:59:59-05:00`;

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(startOfDay)}&timeMax=${encodeURIComponent(endOfDay)}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventsResponse.ok) {
      console.error('Failed to fetch events:', await eventsResponse.text());
      return NextResponse.json(
        { error: 'Failed to fetch calendar events', events: [] },
        { status: 500 }
      );
    }

    const eventsData = await eventsResponse.json();
    const events = (eventsData.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || 'No title',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      location: item.location,
      description: item.description
    }));

    return NextResponse.json({ events, date });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', details: error instanceof Error ? error.message : 'Unknown error', events: [] },
      { status: 500 }
    );
  }
}
