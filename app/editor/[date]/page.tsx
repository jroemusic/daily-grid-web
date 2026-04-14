'use client';

import { useEffect, useState, use, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Schedule, Activity, ActivityType, ACTIVITY_COLORS, CalendarEvent } from '@/lib/types';
import { getDayName, getTodayDate } from '@/lib/time';
import { formatDate, openPrintableView } from '@/lib/pdf';
import { useAutoSave } from '@/lib/useAutoSave';
import ScheduleGrid from '@/components/ScheduleGrid';

export default function EditorPage({ params }: { params: Promise<{ date: string }> }) {
  const resolvedParams = use(params);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [triggerNewActivity, setTriggerNewActivity] = useState(0);
  const [templates, setTemplates] = useState<{ name: string; displayName: string }[]>([]);
  const [currentTime, setCurrentTime] = useState('');
  const [countdown, setCountdown] = useState('');

  // Clock + countdown — update every second
  // currentTimeForGrid is HH:MM format for string comparisons in ScheduleGrid
  const [currentTimeForGrid, setCurrentTimeForGrid] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }));
      setCurrentTimeForGrid(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      const minsUntilNextHour = 60 - now.getMinutes();
      const secsUntilNextHour = 60 - now.getSeconds();
      const totalSecs = minsUntilNextHour * 60 + secsUntilNextHour;
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      setCountdown(`${m}:${String(s).padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

  // Auto-save hook
  const saveStatus = useAutoSave(schedule, async (s) => {
    const method = s.id ? 'PUT' : 'POST';
    const body: any = {
      date: s.date,
      dayName: s.dayName,
      activities: s.activities,
      reminders: s.reminders || []
    };
    if (s.id) body.id = s.id;
    const res = await fetch('/api/schedules', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      const calendarRes = await fetch(`/api/google-calendar/${s.date}`);
      let calEvents = s.calendarEvents || [];
      if (calendarRes.ok) {
        const calendarData = await calendarRes.json();
        calEvents = calendarData.events || [];
      }
      setSchedule({ ...data.schedule, calendarEvents: calEvents });
    }
  }, { enabled: editMode });

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
    <div className="h-screen flex flex-col bg-stone-100 overflow-hidden">
      {/* Thin header: date | clock + countdown | controls */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-stone-400 hover:text-stone-600 text-xs font-medium tracking-wide">&larr;</Link>
            <h1 className="text-sm font-bold text-stone-800 tracking-tight">
              {dayName} <span className="text-stone-400 font-normal mx-1">&mdash;</span> <span className="text-stone-500">{displayDate}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-stone-800 tabular-nums">{currentTime}</span>
            <span className="text-xs font-semibold text-stone-400 tabular-nums bg-stone-100 px-2 py-0.5 rounded-full">{countdown}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {editMode && (
              <span className={`text-[10px] font-semibold tracking-wide transition-opacity ${saveStatus === 'saving' ? 'text-orange-500' : saveStatus === 'saved' ? 'text-green-500' : 'text-transparent'}`}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
              </span>
            )}
            <button onClick={() => setEditMode(!editMode)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition ${editMode ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-600'}`}>
              {editMode ? 'EDIT' : 'VIEW'}
            </button>
            {editMode && (
              <button onClick={() => setTriggerNewActivity(n => n + 1)} className="bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide hover:bg-emerald-700 transition">+ ADD</button>
            )}
            <MoreMenu editMode={editMode} templates={templates} onLoadTemplate={loadTemplate} onRefreshCalendar={refreshCalendar} onPrint={() => openPrintableView(schedule)} onSaveAsTemplate={() => setShowSaveTemplate(true)} />
          </div>
        </div>
      </header>

      {/* Progress hairline */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{
            width: `${(() => {
              if (!currentTime) return 0;
              const now = new Date();
              const mins = now.getHours() * 60 + now.getMinutes();
              return Math.max(0, Math.min(100, ((mins - 420) / 900) * 100));
            })()}%`,
            background: 'linear-gradient(90deg, #f97316, #fb923c, #22c55e)'
          }} />
        </div>
      </div>

      {/* Schedule grid — fills remaining viewport */}
      <main className="max-w-6xl mx-auto px-4 py-3 flex-1 overflow-hidden">
        <ScheduleGrid
          schedule={schedule}
          currentTime={currentTimeForGrid}
          onActivityUpdate={handleActivityUpdate}
          onActivityAdd={handleActivityAdd}
          onActivityRemove={handleActivityRemove}
          onToggleComplete={handleToggleComplete}
          onCalendarEventOverride={handleCalendarEventOverride}
          editMode={editMode}
          triggerNewActivity={triggerNewActivity}
        />
      </main>

      {/* Calendar strip — compact, below the grid */}
      <CalendarStrip events={schedule.calendarEvents || []} onOverride={handleCalendarEventOverride} />

      {/* Save-as-template modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-4 w-64">
            <h3 className="text-sm font-bold text-stone-800 mb-2">Save as Template</h3>
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAsTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false); }}
              className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:border-stone-500 outline-none"
              placeholder="Template name..."
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveTemplate(false)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-stone-200 text-stone-600 hover:bg-stone-300 transition">Cancel</button>
              <button onClick={saveAsTemplate} disabled={!templateName.trim()} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 text-white disabled:opacity-50 hover:bg-stone-700 transition">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MoreMenu ──────────────────────────────────────────────────────────
function MoreMenu({ editMode, templates, onLoadTemplate, onRefreshCalendar, onPrint, onSaveAsTemplate }: {
  editMode: boolean;
  templates: { name: string; displayName: string }[];
  onLoadTemplate: (name: string) => void;
  onRefreshCalendar: () => void;
  onPrint: () => void;
  onSaveAsTemplate: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="bg-stone-200 text-stone-600 px-2 py-1 rounded-md text-[11px] font-semibold tracking-wide hover:bg-stone-300 transition">&#8226;&#8226;&#8226;</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 w-52 overflow-hidden">
            {templates.length > 0 && (
              <div className="border-b border-stone-100">
                <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-stone-400">Templates</div>
                {templates.map(t => (
                  <button key={t.name} onClick={() => { onLoadTemplate(t.name); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition">{t.displayName}</button>
                ))}
              </div>
            )}
            <button onClick={() => { onRefreshCalendar(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition">Sync Calendar</button>
            <button onClick={() => { onPrint(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition">Print</button>
            {editMode && (
              <button onClick={() => { onSaveAsTemplate(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 border-t border-stone-100 transition">Save as Template</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── CalendarStrip ─────────────────────────────────────────────────────
function CalendarStrip({ events, onOverride }: {
  events: CalendarEvent[];
  onOverride: (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => void;
}) {
  const [collapsed, setCollapsed] = useState(events.length === 0);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const PEOPLE = ['Jason', 'Kay', 'Emma', 'Toby'];
  const PERSON_COLORS: Record<string, string> = { Jason: '#2563eb', Kay: '#db2777', Emma: '#16a34a', Toby: '#ea580c' };

  function getEventPeople(event: CalendarEvent): string[] {
    if (event.overridePeople) return event.overridePeople;
    if (event.people) return event.people;
    if (event.person) return [event.person];
    return ['Jason'];
  }

  if (events.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-50 transition">
          <span className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>&#9654;</span>
          Calendar ({events.length})
        </button>
        {!collapsed && (
          <div className="px-4 pb-3 space-y-1.5">
            {events.map(event => {
              const isEnabled = event.enabled !== false;
              const people = getEventPeople(event);
              const time = event.start.includes('T') ? new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
              const isExpanded = expandedEvent === event.id;
              return (
                <div key={event.id}>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${isEnabled ? 'bg-blue-50 text-blue-800' : 'bg-stone-100 text-stone-400 line-through'}`}
                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  >
                    <button onClick={e => { e.stopPropagation(); onOverride(event.id, { enabled: !isEnabled }); }} className={`w-5 h-3 rounded-full relative flex-shrink-0 transition-colors ${isEnabled ? 'bg-blue-500' : 'bg-stone-300'}`}>
                      <span className={`absolute top-px w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-2.5' : 'left-px'}`} />
                    </button>
                    {time && <span className="font-mono text-[10px] font-semibold">{time}</span>}
                    <span className="font-medium">{event.summary}</span>
                    <div className="flex gap-0.5 ml-auto">
                      {people.map(p => (
                        <span key={p} className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PERSON_COLORS[p] || '#666' }} title={p} />
                      ))}
                    </div>
                    <span className={`text-stone-400 text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>&#9660;</span>
                  </div>
                  {isExpanded && (
                    <div className="flex gap-1.5 mt-1 ml-8">
                      {PEOPLE.map(person => {
                        const isActive = people.includes(person);
                        return (
                          <button
                            key={person}
                            onClick={() => {
                              const next = isActive ? people.filter(x => x !== person) : [...people, person];
                              if (next.length === 0) return;
                              onOverride(event.id, { overridePeople: next });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isActive
                                ? 'text-white shadow-sm'
                                : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                            }`}
                            style={isActive ? { backgroundColor: PERSON_COLORS[person] } : {}}
                          >
                            {person}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
