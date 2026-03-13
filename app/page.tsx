'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Schedule, Template } from '@/lib/types';
import { getTodayDate, addDays } from '@/lib/time';

export default function HomePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load schedules
        const schedulesRes = await fetch('/api/schedules?limit=5');
        const schedulesData = await schedulesRes.json();
        setSchedules(schedulesData.schedules || []);

        // Load templates
        const templatesRes = await fetch('/api/templates');
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.templates || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const today = getTodayDate();
  const tomorrow = addDays(today, 1);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Daily Grid</h1>
              <p className="text-gray-600 mt-1">Family Time-Blocking System</p>
            </div>
            <Link
              href="/templates"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Manage Templates
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <QuickActionCard
            title="Today's Schedule"
            date={today}
            href={`/editor/${today}`}
            icon="📅"
            color="blue"
          />
          <QuickActionCard
            title="Tomorrow's Schedule"
            date={tomorrow}
            href={`/editor/${tomorrow}`}
            icon="📆"
            color="green"
          />
          <QuickActionCard
            title="Create New"
            date=""
            href="/editor/new"
            icon="➕"
            color="purple"
          />
        </div>

        {/* Recent Schedules */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Recent Schedules</h2>
          </div>
          {schedules.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No schedules yet. Create your first one!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map((schedule) => (
                <ScheduleCard key={schedule.id} schedule={schedule} />
              ))}
            </div>
          )}
        </section>

        {/* Templates */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Templates</h2>
            <Link
              href="/templates"
              className="text-blue-600 hover:text-blue-700"
            >
              View all →
            </Link>
          </div>
          {templates.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No templates yet. Create your first template!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function QuickActionCard({
  title,
  date,
  href,
  icon,
  color
}: {
  title: string;
  date: string;
  href: string;
  icon: string;
  color: 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    green: 'bg-green-50 border-green-200 hover:bg-green-100',
    purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
  };

  return (
    <Link
      href={href}
      className={`block border-2 rounded-lg p-6 transition ${colorClasses[color]}`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {date && <p className="text-gray-600 mt-1">{formatDateDisplay(date)}</p>}
    </Link>
  );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  return (
    <Link
      href={`/editor/${schedule.date}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition p-5"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900">{schedule.date}</h3>
          <p className="text-sm text-gray-600">{schedule.dayName}</p>
        </div>
        <span className="text-2xl">📋</span>
      </div>
      <div className="mt-3 text-sm text-gray-500">
        {schedule.activities?.length || 0} activities
      </div>
    </Link>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Link
      href={`/editor/new?template=${template.name}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition p-5"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900">{template.displayName}</h3>
          {template.description && (
            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
          )}
        </div>
        <span className="text-2xl">📝</span>
      </div>
      <div className="mt-3 text-sm text-gray-500">
        {template.activities?.length || 0} activities
      </div>
    </Link>
  );
}

function formatDateDisplay(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}
