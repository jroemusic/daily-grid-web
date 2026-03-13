import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, getScheduleByDate, createSchedule, updateSchedule, deleteSchedule } from '@/lib/db';
import { Activity } from '@/lib/types';

/**
 * GET /api/schedules - List all schedules
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const schedules = await getSchedules(limit);

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedules - Create a new schedule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, dayName, activities, calendarEvents, reminders } = body;

    if (!date || !dayName) {
      return NextResponse.json(
        { error: 'Date and dayName are required' },
        { status: 400 }
      );
    }

    // Check if schedule already exists
    const existing = await getScheduleByDate(date);
    if (existing) {
      return NextResponse.json(
        { error: 'Schedule for this date already exists' },
        { status: 409 }
      );
    }

    const schedule = await createSchedule({
      date,
      day_name: dayName,
      activities: activities || [],
      calendar_events: calendarEvents || [],
      reminders: reminders || []
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/schedules - Update a schedule
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, date, dayName, activities, calendarEvents, reminders } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const schedule = await updateSchedule(id, {
      date,
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
 * DELETE /api/schedules - Delete a schedule
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    await deleteSchedule(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
