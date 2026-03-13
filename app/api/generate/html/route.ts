import { NextRequest, NextResponse } from 'next/server';
import { generatePrintableHTML } from '@/lib/pdf';
import { getScheduleByDate } from '@/lib/db';
import { Schedule } from '@/lib/types';

/**
 * POST /api/generate/html - Generate HTML for printable schedule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, schedule }: { date?: string; schedule?: Schedule } = body;

    let targetSchedule: Schedule | undefined = schedule;

    // If date is provided but no schedule, fetch from database
    if (date && !schedule) {
      const fetched = await getScheduleByDate(date);
      if (!fetched) {
        return NextResponse.json(
          { error: 'Schedule not found' },
          { status: 404 }
        );
      }
      targetSchedule = {
        id: fetched.id,
        date: fetched.date,
        dayName: fetched.day_name,
        activities: fetched.activities,
        calendarEvents: fetched.calendar_events,
        reminders: fetched.reminders
      };
    }

    if (!targetSchedule) {
      return NextResponse.json(
        { error: 'Either date or schedule data is required' },
        { status: 400 }
      );
    }

    const html = generatePrintableHTML(targetSchedule);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating HTML:', error);
    return NextResponse.json(
      { error: 'Failed to generate HTML' },
      { status: 500 }
    );
  }
}
