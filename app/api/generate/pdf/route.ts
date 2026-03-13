import { NextRequest, NextResponse } from 'next/server';
import { getScheduleByDate } from '@/lib/db';
import { Schedule } from '@/lib/types';

/**
 * POST /api/generate/pdf - Generate PDF (client-side only)
 *
 * Note: jsPDF requires browser APIs and cannot be used in serverless functions.
 * This endpoint returns schedule data that can be used with client-side PDF generation.
 *
 * For client-side use:
 * import { downloadPDF } from '@/lib/pdf';
 * await downloadPDF(schedule);
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    const fetched = await getScheduleByDate(date);
    if (!fetched) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    const schedule: Schedule = {
      id: fetched.id,
      date: fetched.date,
      dayName: fetched.day_name,
      activities: fetched.activities,
      calendarEvents: fetched.calendar_events,
      reminders: fetched.reminders
    };

    // Return schedule data for client-side PDF generation
    return NextResponse.json({
      schedule,
      message: 'Use client-side PDF generation with downloadPDF()'
    });
  } catch (error) {
    console.error('Error preparing PDF data:', error);
    return NextResponse.json(
      { error: 'Failed to prepare PDF data' },
      { status: 500 }
    );
  }
}
