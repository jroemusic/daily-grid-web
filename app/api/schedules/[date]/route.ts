import { NextRequest, NextResponse } from 'next/server';
import { getScheduleByDate, updateSchedule, deleteSchedule } from '@/lib/db';

/**
 * GET /api/schedules/[date] - Get schedule by date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    const schedule = await getScheduleByDate(date);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Map database fields to frontend fields
    const mappedSchedule = {
      id: schedule.id,
      date: schedule.date,
      dayName: schedule.day_name,
      activities: schedule.activities,
      calendarEvents: schedule.calendar_events,
      reminders: schedule.reminders
    };

    return NextResponse.json({ schedule: mappedSchedule });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/schedules/[date] - Update schedule by date
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    const body = await request.json();
    const { dayName, activities, calendarEvents, reminders } = body;

    // Get existing schedule
    const existing = await getScheduleByDate(date);
    if (!existing) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    const schedule = await updateSchedule(existing.id, {
      day_name: dayName,
      activities,
      calendar_events: calendarEvents,
      reminders
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedules/[date] - Delete schedule by date
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    // Get existing schedule
    const existing = await getScheduleByDate(date);
    if (!existing) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    await deleteSchedule(existing.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
