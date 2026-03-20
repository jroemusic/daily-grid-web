import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/gog-calendar/[date] - Get calendar events using GOG CLI
 *
 * This uses the local gog command which is already configured with OAuth credentials
 *
 * To refresh expired tokens: bash scripts/refresh-gog-token.sh
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

    // Call gog CLI to get calendar events for the date
    const { stdout, stderr } = await execAsync(
      `gog calendar events ${date} --json 2>&1`,
      {
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      }
    );

    // Check for authentication errors
    if (stderr && stderr.includes('Token has been expired or revoked')) {
      return NextResponse.json(
        {
          error: 'GOG token expired',
          message: 'Calendar authentication expired. Please refresh the token.',
          instructions: 'Run: bash scripts/refresh-gog-token.sh',
          events: []
        },
        { status: 401 }
      );
    }

    let events = [];
    try {
      // Parse GOG output if it's valid JSON
      if (stdout && !stderr.includes('Token has been expired')) {
        events = JSON.parse(stdout);
      }
    } catch (e) {
      // If JSON parsing fails, return empty array
      console.warn('Failed to parse GOG output:', e.message);
      events = [];
    }

    return NextResponse.json({ events, date });
  } catch (error) {
    console.error('Error fetching calendar events:', error);

    // Check for authentication errors in exception
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg.includes('Token has been expired') || errorMsg.includes('invalid_grant')) {
      return NextResponse.json(
        {
          error: 'GOG token expired',
          message: 'Calendar authentication expired. Please refresh the token.',
          instructions: 'Run: bash scripts/refresh-gog-token.sh',
          events: []
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch calendar events', details: errorMsg, events: [] },
      { status: 500 }
    );
  }
}
