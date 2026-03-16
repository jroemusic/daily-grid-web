'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Schedule, Activity, ActivityType, ACTIVITY_COLORS } from '@/lib/types';
import { getDayName, timeToMinutes, minutesToTime } from '@/lib/time';
import { openPrintableView } from '@/lib/pdf';

export default function EditorPage({ params }: { params: Promise<{ date: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{name: string, displayName: string}[]>([]);

  useEffect(() => {
    loadSchedule();
    // Load templates
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => {
        setTemplates((data.templates || []).map((t: any) => ({ name: t.name, displayName: t.display_name })));
      })
      .catch(console.error);
  }, [resolvedParams.date]);

  async function loadSchedule() {
    try {
      if (resolvedParams.date === 'new') {
        // Create new empty schedule
        const today = new Date().toISOString().split('T')[0];
        setSchedule({
          id: '',
          date: today,
          dayName: getDayName(today),
          activities: [],
          calendarEvents: [],
          reminders: []
        });
      } else {
        // Load existing schedule
        const res = await fetch(`/api/schedules/${resolvedParams.date}`);
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule);
        } else if (res.status === 404) {
          // Create new schedule for this date
          setSchedule({
            id: '',
            date: resolvedParams.date,
            dayName: getDayName(resolvedParams.date),
            activities: [],
            calendarEvents: [],
            reminders: []
          });
        } else {
          throw new Error('Failed to load schedule');
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule() {
    if (!schedule) return;

    setSaving(true);
    try {
      const method = schedule.id ? 'PUT' : 'POST';
      const url = schedule.id ? '/api/schedules' : '/api/schedules';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id,
          date: schedule.date,
          dayName: schedule.dayName,
          activities: schedule.activities,
          calendarEvents: schedule.calendarEvents,
          reminders: schedule.reminders
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
        alert('Schedule saved!');
      } else {
        throw new Error('Failed to save');
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
  }

  function addActivity() {
    if (!schedule) return;

    const lastActivity = schedule.activities[schedule.activities.length - 1];
    const start = lastActivity ? lastActivity.end : '07:00';
    const startMinutes = timeToMinutes(start);
    const end = minutesToTime(startMinutes + 60);

    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      title: 'New Activity',
      start,
      end,
      people: ['Jason'],
      type: 'other',
      color: ACTIVITY_COLORS.other
    };

    setSchedule({
      ...schedule,
      activities: [...schedule.activities, newActivity]
    });
  }

  function updateActivity(index: number, updates: Partial<Activity>) {
    if (!schedule) return;

    const newActivities = [...schedule.activities];
    newActivities[index] = { ...newActivities[index], ...updates };

    setSchedule({
      ...schedule,
      activities: newActivities
    });
  }

  function removeActivity(index: number) {
    if (!schedule) return;

    setSchedule({
      ...schedule,
      activities: schedule.activities.filter((_, i) => i !== index)
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-800">Loading...</div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/" className="text-blue-600 hover:text-blue-700">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">
                {schedule.date} - {schedule.dayName}
              </h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openPrintableView(schedule)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
              >
                Print / PDF
              </button>
              <button
                onClick={saveSchedule}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Template Loader */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Load from Template
          </label>
          <div className="flex gap-3">
            <select
              value={selectedTemplate || ''}
              onChange={(e) => setSelectedTemplate(e.target.value || null)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>{t.displayName}</option>
              ))}
            </select>
            <button
              onClick={() => selectedTemplate && loadTemplate(selectedTemplate)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Load Template
            </button>
          </div>
        </div>

        {/* Activities List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Activities</h2>
            <button
              onClick={addActivity}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              + Add Activity
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {schedule.activities.length === 0 ? (
              <div className="p-8 text-center text-gray-900">
                No activities yet. Add one to get started!
              </div>
            ) : (
              schedule.activities.map((activity, index) => (
                <ActivityEditor
                  key={activity.id}
                  activity={activity}
                  index={index}
                  onUpdate={(updates) => updateActivity(index, updates)}
                  onRemove={() => removeActivity(index)}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ActivityEditor({
  activity,
  index,
  onUpdate,
  onRemove
}: {
  activity: Activity;
  index: number;
  onUpdate: (updates: Partial<Activity>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 hover:bg-gray-50" style={{ borderLeftColor: activity.color, borderLeftWidth: '4px' }}>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Title
          </label>
          <input
            type="text"
            value={activity.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
          />
        </div>

        {/* Start Time */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Start
          </label>
          <input
            type="time"
            value={activity.start}
            onChange={(e) => onUpdate({ start: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
          />
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            End
          </label>
          <input
            type="time"
            value={activity.end}
            onChange={(e) => onUpdate({ end: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Type
          </label>
          <select
            value={activity.type}
            onChange={(e) => onUpdate({
              type: e.target.value as ActivityType,
              color: ACTIVITY_COLORS[e.target.value as ActivityType]
            })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
          >
            <option value="routine">Routine</option>
            <option value="meal">Meal</option>
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="family">Family</option>
            <option value="school">School</option>
            <option value="activity">Activity</option>
            <option value="break">Break</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-end">
          <button
            onClick={onRemove}
            className="w-full bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Remove
          </button>
        </div>
      </div>

      {/* People & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            People (comma separated)
          </label>
          <input
            type="text"
            value={activity.people.join(', ')}
            onChange={(e) => onUpdate({
              people: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
            })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            placeholder="Jason, Kay, Emma, Toby"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Notes
          </label>
          <input
            type="text"
            value={activity.notes || ''}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
          />
        </div>
      </div>
    </div>
  );
}
