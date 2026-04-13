'use client';

import { useEffect, useState, use, useCallback, useRef } from 'react';
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
  const [triggerNewActivity, setTriggerNewActivity] = useState(0);
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
      let savedOverrides: { id: string; enabled?: boolean; overridePeople?: string[] }[] = [];
      const res = await fetch(`/api/schedules/${scheduleDate}`);
      if (res.ok) {
        const data = await res.json();
        scheduleData = data.schedule;
        // Extract saved calendar overrides from DB
        if (scheduleData?.calendarEvents && Array.isArray(scheduleData.calendarEvents)) {
          savedOverrides = scheduleData.calendarEvents.filter(
            (ev: any) => ev.enabled !== undefined || ev.overridePeople !== undefined
          );
        }
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

      // Fetch calendar events and apply saved overrides
      try {
        const calendarRes = await fetch(`/api/google-calendar/${scheduleDate}`);
        if (calendarRes.ok) {
          const calendarData = await calendarRes.json();
          const freshEvents = calendarData.events || [];
          // Merge saved overrides into fresh events
          const overrideMap = new Map(savedOverrides.map((o: any) => [o.id, o]));
          scheduleData!.calendarEvents = freshEvents.map((ev: any) => {
            const saved = overrideMap.get(ev.id);
            if (saved) return { ...ev, enabled: saved.enabled, overridePeople: saved.overridePeople };
            return ev;
          });
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
        // Re-fetch calendar events after save so they don't disappear
        const calendarRes = await fetch(`/api/google-calendar/${schedule.date}`);
        let calEvents = schedule.calendarEvents || [];
        if (calendarRes.ok) {
          const calendarData = await calendarRes.json();
          calEvents = calendarData.events || [];
        }
        setSchedule({ ...data.schedule, calendarEvents: calEvents });
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

  const handleCalendarEventOverride = useCallback(async (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => {
    if (!schedule || !schedule.calendarEvents) return;
    const updatedEvents = schedule.calendarEvents.map(ev => {
      if (ev.id !== eventId) return ev;
      return { ...ev, ...overrides };
    });
    const updated = { ...schedule, calendarEvents: updatedEvents };
    setSchedule(updated);

    // Auto-save overrides to DB (store just the override data, not raw events)
    try {
      const overrideData = updatedEvents.map(ev => ({
        id: ev.id,
        enabled: ev.enabled,
        overridePeople: ev.overridePeople
      })).filter(ev => ev.enabled !== undefined || ev.overridePeople !== undefined);

      const method = updated.id ? 'PUT' : 'POST';
      const body: any = {
        date: updated.date,
        dayName: updated.dayName,
        activities: updated.activities,
        reminders: updated.reminders || [],
        calendarEvents: overrideData
      };
      if (updated.id) body.id = updated.id;
      const res = await fetch('/api/schedules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule({ ...data.schedule, calendarEvents: updatedEvents });
      }
    } catch (e) {
      console.warn('Auto-save calendar override failed:', e);
    }
  }, [schedule]);

  const handleToggleComplete = useCallback(async (index: number) => {
    if (!schedule) return;
    const newActivities = [...schedule.activities];
    newActivities[index] = {
      ...newActivities[index],
      completed: !newActivities[index].completed,
      completedAt: !newActivities[index].completed ? new Date().toISOString() : undefined
    };
    const updated = { ...schedule, activities: newActivities };
    setSchedule(updated);

    // Auto-save to DB
    try {
      const method = updated.id ? 'PUT' : 'POST';
      const body: any = {
        date: updated.date,
        dayName: updated.dayName,
        activities: updated.activities,
        reminders: updated.reminders || []
      };
      if (updated.id) body.id = updated.id;
      const res = await fetch('/api/schedules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        // Re-attach calendar events (not stored in DB)
        setSchedule({ ...data.schedule, calendarEvents: updated.calendarEvents });
      }
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }, [schedule]);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  async function saveAsTemplate() {
    if (!schedule || !templateName.trim()) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim().toLowerCase().replace(/\s+/g, '-'),
          display_name: templateName.trim(),
          activities: schedule.activities
        })
      });
      if (res.ok) {
        setShowSaveTemplate(false);
        setTemplateName('');
        // Refresh template list
        const templatesRes = await fetch('/api/templates');
        const templatesData = await templatesRes.json();
        setTemplates((templatesData.templates || []).map((t: any) => ({ name: t.name, displayName: t.display_name })));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  }

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
    <div className="min-h-screen bg-stone-100">
      {/* Header / Toolbar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <Link href="/" className="text-stone-400 hover:text-stone-600 text-xs font-medium tracking-wide">
                &larr; Dashboard
              </Link>
              <h1 className="text-xl font-bold text-stone-800 mt-0.5 tracking-tight">
                {dayName} <span className="text-stone-400 font-normal">&mdash;</span> <span className="text-stone-600">{displayDate}</span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Edit/View toggle */}
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition ${editMode ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-600'}`}
              >
                {editMode ? 'EDITING' : 'VIEW'}
              </button>

              {/* Templates */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  className="bg-stone-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide hover:bg-stone-600 transition"
                >
                  TEMPLATES
                </button>
                {showTemplatePicker && (
                  <div className="absolute right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 w-48 overflow-hidden">
                    {templates.length === 0 ? (
                      <div className="p-3 text-sm text-stone-400">No templates</div>
                    ) : (
                      templates.map(t => (
                        <button
                          key={t.name}
                          onClick={() => loadTemplate(t.name)}
                          className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 border-b border-stone-100 last:border-0 transition"
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
                  onClick={() => setTriggerNewActivity(n => n + 1)}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide hover:bg-emerald-700 transition"
                >
                  + ACTIVITY
                </button>
              )}

              {/* Refresh Calendar */}
              <button
                onClick={refreshCalendar}
                className="bg-sky-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide hover:bg-sky-700 transition"
              >
                SYNC CAL
              </button>

              {/* Print */}
              <button
                onClick={() => openPrintableView(schedule)}
                className="bg-stone-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide hover:bg-stone-600 transition"
              >
                PRINT
              </button>

              {/* Save */}
              {editMode && (
                <button
                  onClick={saveSchedule}
                  disabled={saving}
                  className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide hover:bg-orange-700 transition disabled:opacity-50"
                >
                  {saving ? 'SAVING...' : 'SAVE'}
                </button>
              )}

              {/* Save as Template */}
              {editMode && (
                <div className="relative">
                  <button
                    onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                    className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide hover:bg-amber-700 transition"
                  >
                    SAVE TEMPLATE
                  </button>
                  {showSaveTemplate && (
                    <div className="absolute right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 p-3 w-56">
                      <input
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveAsTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false); }}
                        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:border-stone-500 outline-none"
                        placeholder="Template name..."
                        autoFocus
                      />
                      <button
                        onClick={saveAsTemplate}
                        disabled={!templateName.trim()}
                        className="w-full bg-stone-800 text-white px-2 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-stone-700 transition"
                      >
                        SAVE TEMPLATE
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-5xl mx-auto px-4 py-5">
        <ScheduleGrid
          schedule={schedule}
          onActivityUpdate={handleActivityUpdate}
          onActivityAdd={handleActivityAdd}
          onActivityRemove={handleActivityRemove}
          onToggleComplete={handleToggleComplete}
          onCalendarEventOverride={handleCalendarEventOverride}
          editMode={editMode}
          triggerNewActivity={triggerNewActivity}
        />
      </main>
    </div>
  );
}
