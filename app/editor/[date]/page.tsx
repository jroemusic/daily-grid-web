'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { Schedule, Activity, ActivityType, ACTIVITY_COLORS } from '@/lib/types';
import { getDayName, getTodayDate } from '@/lib/time';
import { formatDate, openPrintableView } from '@/lib/pdf';
import ScheduleGrid from '@/components/ScheduleGrid';

export default function EditorPage({ params }: { params: Promise<{ date: string }> }) {
  const resolvedParams = use(params);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<{ name: string; displayName: string }[]>([]);

  useEffect(() => {
    loadSchedule();
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => {
        setTemplates((data.templates || []).map((t: any) => ({ name: t.name, displayName: t.display_name })));
      })
      .catch(console.error);
  }, [resolvedParams.date]);

  async function loadSchedule() {
    try {
      let scheduleDate = resolvedParams.date;
      if (scheduleDate === 'new') {
        scheduleDate = getTodayDate();
      }

      let scheduleData: Schedule | null = null;

      const res = await fetch(`/api/schedules/${scheduleDate}`);
      if (res.ok) {
        const data = await res.json();
        scheduleData = data.schedule;
      } else if (res.status === 404) {
        scheduleData = {
          id: '',
          date: scheduleDate,
          dayName: getDayName(scheduleDate),
          activities: [],
          calendarEvents: [],
          reminders: []
        };
      } else {
        throw new Error('Failed to load schedule');
      }

      // Fetch calendar events
      try {
        const calendarRes = await fetch(`/api/google-calendar/${scheduleDate}`);
        if (calendarRes.ok) {
          const calendarData = await calendarRes.json();
          scheduleData!.calendarEvents = calendarData.events || [];
        }
      } catch (e) {
        console.warn('Failed to load calendar events:', e);
      }

      setSchedule(scheduleData);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCalendar() {
    if (!schedule) return;
    try {
      const calendarRes = await fetch(`/api/google-calendar/${schedule.date}`);
      if (calendarRes.ok) {
        const calendarData = await calendarRes.json();
        setSchedule({ ...schedule, calendarEvents: calendarData.events || [] });
      }
    } catch (e) {
      console.warn('Failed to refresh calendar events:', e);
    }
  }

  async function saveSchedule() {
    if (!schedule) return;
    setSaving(true);
    try {
      const method = schedule.id ? 'PUT' : 'POST';
      const url = '/api/schedules';
      const body: any = {
        date: schedule.date,
        dayName: schedule.dayName,
        activities: schedule.activities,
        calendarEvents: schedule.calendarEvents || [],
        reminders: schedule.reminders || []
      };
      if (schedule.id) body.id = schedule.id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }

  async function loadTemplate(templateName: string) {
    try {
      const res = await fetch(`/api/templates/${templateName}`);
      if (res.ok) {
        const data = await res.json();
        if (schedule && data.template) {
          setSchedule({
            ...schedule,
            activities: data.template.activities.map((a: Activity) => ({
              ...a,
              id: `act-${Date.now()}-${Math.random()}`
            }))
          });
        }
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
    setShowTemplatePicker(false);
  }

  const handleActivityUpdate = useCallback((index: number, updates: Partial<Activity>) => {
    if (!schedule) return;
    const newActivities = [...schedule.activities];
    newActivities[index] = { ...newActivities[index], ...updates };
    setSchedule({ ...schedule, activities: newActivities });
  }, [schedule]);

  const handleActivityAdd = useCallback((start: string, end: string, person: string) => {
    if (!schedule) return;
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      title: 'New Activity',
      start,
      end,
      people: [person],
      type: 'other',
      color: ACTIVITY_COLORS.other
    };
    setSchedule({
      ...schedule,
      activities: [...schedule.activities, newActivity]
    });
  }, [schedule]);

  const handleActivityRemove = useCallback((index: number) => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      activities: schedule.activities.filter((_, i) => i !== index)
    });
  }, [schedule]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Failed to load schedule</div>
      </div>
    );
  }

  const displayDate = formatDate(schedule.date);
  const dayName = getDayName(schedule.date);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / Toolbar */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm">
                &larr; Dashboard
              </Link>
              <h1 className="text-lg font-bold text-gray-900 mt-0.5">
                {dayName} &mdash; {displayDate}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Edit/View toggle */}
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${editMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {editMode ? 'Editing' : 'View Only'}
              </button>

              {/* Templates */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
                >
                  Templates
                </button>
                {showTemplatePicker && (
                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 w-48">
                    {templates.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No templates</div>
                    ) : (
                      templates.map(t => (
                        <button
                          key={t.name}
                          onClick={() => loadTemplate(t.name)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-purple-50 border-b border-gray-100 last:border-0"
                        >
                          {t.displayName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Add Activity */}
              {editMode && (
                <button
                  onClick={() => handleActivityAdd('07:00', '08:00', 'Jason')}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                >
                  + Activity
                </button>
              )}

              {/* Refresh Calendar */}
              <button
                onClick={refreshCalendar}
                className="bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-cyan-700 transition"
              >
                Refresh Cal
              </button>

              {/* Print */}
              <button
                onClick={() => openPrintableView(schedule)}
                className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
              >
                Print
              </button>

              {/* Save */}
              {editMode && (
                <button
                  onClick={saveSchedule}
                  disabled={saving}
                  className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <ScheduleGrid
          schedule={schedule}
          onActivityUpdate={handleActivityUpdate}
          onActivityAdd={handleActivityAdd}
          onActivityRemove={handleActivityRemove}
          editMode={editMode}
        />
      </main>
    </div>
  );
}
