'use client';

import { useState, useEffect } from 'react';
import {
  Schedule,
  Activity,
  ActivityType,
  ACTIVITY_COLORS,
  CalendarEvent
} from '@/lib/types';
import {
  timeToMinutes,
  formatTimeDisplay,
  sortActivitiesByTime
} from '@/lib/time';

const PEOPLE = ['Jason', 'Kay', 'Emma', 'Toby'];
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7; // 7 AM to 10 PM
  return `${hour.toString().padStart(2, '0')}:00`;
});

interface ScheduleGridProps {
  schedule: Schedule;
  onActivityUpdate: (index: number, updates: Partial<Activity>) => void;
  onActivityAdd: (start: string, end: string, person: string) => void;
  onActivityRemove: (index: number) => void;
  onToggleComplete: (index: number) => void;
  editMode: boolean;
}

export default function ScheduleGrid({
  schedule,
  onActivityUpdate,
  onActivityAdd,
  onActivityRemove,
  onToggleComplete,
  editMode
}: ScheduleGridProps) {
  const [editState, setEditState] = useState<{
    active: boolean;
    activityIndex: number;
  }>({ active: false, activityIndex: -1 });
  const [currentTime, setCurrentTime] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');

  // Update current time and countdown every second
  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setCurrentTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
      // Countdown to next hour
      const minsLeft = 59 - now.getMinutes();
      const secsLeft = 59 - now.getSeconds();
      setCountdown(`${minsLeft}:${secsLeft.toString().padStart(2, '0')}`);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper: parse ISO datetime to HH:MM
  function isoToHHMM(iso: string): string {
    if (!iso.includes('T')) return iso;
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  // Group activities by time slot and person
  const timeSlotMap = new Map<string, Map<string, { activity: Activity; index: number }>>();
  for (let i = 0; i < schedule.activities.length; i++) {
    const activity = schedule.activities[i];
    const timeKey = `${activity.start}-${activity.end}`;
    if (!timeSlotMap.has(timeKey)) {
      timeSlotMap.set(timeKey, new Map());
    }
    for (const person of activity.people) {
      timeSlotMap.get(timeKey)!.set(person, { activity, index: i });
    }
  }

  // Build calendar event map for grid cells — snap to hourly rows
  // Rule: if a calendar event overlaps an hour slot by 15+ minutes, show it in that slot.
  // This prevents sub-hour rows and keeps the grid clean.
  const calEventRows = new Map<string, CalendarEvent>(); // key: `${hourStart}-${hourEnd}-${person}`
  for (const event of schedule.calendarEvents || []) {
    const evtStart = timeToMinutes(isoToHHMM(event.start));
    const evtEnd = timeToMinutes(isoToHHMM(event.end));
    const person = event.person || 'Jason';
    // Check each hourly slot
    for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
      const slotStart = timeToMinutes(TIME_SLOTS[i]);
      const slotEnd = timeToMinutes(TIME_SLOTS[i + 1]);
      // Overlap = min(evtEnd, slotEnd) - max(evtStart, slotStart)
      const overlap = Math.min(evtEnd, slotEnd) - Math.max(evtStart, slotStart);
      if (overlap >= 15) {
        calEventRows.set(`${TIME_SLOTS[i]}-${TIME_SLOTS[i + 1]}-${person}`, event);
      }
    }
  }

  // Build rows for hourly time slots (7 AM to 10 PM)
  const baseRows: { start: string; end: string }[] = [];
  for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
    baseRows.push({ start: TIME_SLOTS[i], end: TIME_SLOTS[i + 1] });
  }

  // Also include custom time slots from activities that don't align to the hour
  const allRows = [...baseRows];
  for (const activity of schedule.activities) {
    const startMin = timeToMinutes(activity.start);
    const endMin = timeToMinutes(activity.end);
    if (startMin % 60 !== 0 || endMin % 60 !== 0) {
      const key = `${activity.start}-${activity.end}`;
      if (!allRows.some(r => `${r.start}-${r.end}` === key)) {
        allRows.push({ start: activity.start, end: activity.end });
      }
    }
  }
  // Calendar events do NOT create sub-hour rows — they snap to hourly slots above

  // Sort rows by start time and deduplicate
  allRows.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const seenSlots = new Set<string>();
  const uniqueRows = allRows.filter(r => {
    const key = `${r.start}-${r.end}`;
    if (seenSlots.has(key)) return false;
    seenSlots.add(key);
    return true;
  });

  function getCellContent(person: string, rowStart: string, rowEnd: string) {
    const timeKey = `${rowStart}-${rowEnd}`;
    const personMap = timeSlotMap.get(timeKey);
    if (personMap) {
      const entry = personMap.get(person);
      if (entry) return entry;
    }
    // Check if any activity spans this time slot
    for (let i = 0; i < schedule.activities.length; i++) {
      const act = schedule.activities[i];
      const actStart = timeToMinutes(act.start);
      const actEnd = timeToMinutes(act.end);
      const rowStartMin = timeToMinutes(rowStart);
      const rowEndMin = timeToMinutes(rowEnd);
      if (actStart <= rowStartMin && actEnd >= rowEndMin && act.people.includes(person)) {
        return { activity: act, index: i };
      }
    }
    return null;
  }

  function getCalEvent(person: string, rowStart: string, rowEnd: string): CalendarEvent | null {
    return calEventRows.get(`${rowStart}-${rowEnd}-${person}`) || null;
  }

  function handleCellClick(person: string, rowStart: string, rowEnd: string) {
    if (!editMode) return;
    const existing = getCellContent(person, rowStart, rowEnd);
    if (existing) {
      setEditState({ active: true, activityIndex: existing.index });
    } else {
      onActivityAdd(rowStart, rowEnd, person);
    }
  }

  // Progress
  const completed = schedule.activities.filter(a => a.completed).length;
  const total = schedule.activities.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Next up
  const nextActivity = currentTime
    ? sortActivitiesByTime(schedule.activities).find(a => a.start > currentTime)
    : null;

  return (
    <div className="space-y-4">
      {/* Progress */}
      {total > 0 && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-3 text-white">
          <div className="flex justify-between items-center font-semibold text-sm">
            <span>Today&apos;s Progress</span>
            <span>{completed} of {total} blocks complete</span>
          </div>
          <div className="bg-white/30 h-5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-500"
              style={{ width: `${Math.max(percentage, 8)}%` }}
            >
              {percentage}%
            </div>
          </div>
        </div>
      )}

      {/* Next Up + Countdown */}
      {currentTime && (
        <div className="flex gap-3">
          <div className="flex-1 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-xl p-3 border-l-4 border-indigo-500 text-center">
            <div className="font-bold text-sm text-indigo-900">Next Hour In</div>
            <div className="text-2xl font-bold text-indigo-700 tabular-nums">{countdown}</div>
          </div>
          {nextActivity && (
            <div className="flex-1 bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl p-3 border-l-4 border-yellow-500">
              <div className="font-bold text-sm text-gray-800">Next Up</div>
              <div className="font-semibold text-gray-800">
                {nextActivity.title} ({formatTimeDisplay(nextActivity.start)} - {formatTimeDisplay(nextActivity.end)})
              </div>
            </div>
          )}
        </div>
      )}
      {/* Old standalone Next Up removed */}

      {/* Calendar Events */}
      {schedule.calendarEvents && schedule.calendarEvents.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 border-l-4 border-blue-500">
          <div className="font-bold text-sm text-blue-900 mb-2">Calendar Events</div>
          {schedule.calendarEvents.map((event: CalendarEvent) => {
            const eventTime = event.start.includes('T')
              ? new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : '';
            const eventEndTime = event.end.includes('T')
              ? new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : '';
            return (
              <div key={event.id} className="bg-white/70 rounded-md px-3 py-1.5 mb-1 text-sm">
                <span className="font-bold text-blue-700 inline-block min-w-[100px]">
                  {eventTime}{eventEndTime && eventEndTime !== eventTime ? ` - ${eventEndTime} ` : ' '}
                </span>
                <span className="font-semibold text-blue-900">{event.summary}</span>
                {event.person && <span className="text-gray-500 ml-2">({event.person})</span>}
                {event.location && <span className="text-gray-500 italic ml-2 text-xs">@ {event.location}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Grid Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="bg-gradient-to-r from-orange-400 to-orange-300 text-white px-2 py-2 text-center text-xs font-bold w-20">
                Time
              </th>
              {PEOPLE.map(person => (
                <th key={person} className="bg-gradient-to-r from-orange-400 to-orange-300 text-white px-2 py-2 text-center text-xs font-bold">
                  {person}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueRows.map((row, rowIdx) => {
              const isCurrent = currentTime >= row.start && currentTime < row.end;
              return (
                <tr
                  key={`${row.start}-${row.end}`}
                  className={`
                    ${isCurrent ? 'bg-red-50 border-l-4 border-l-red-400 border-r-4 border-r-red-400' : ''}
                    ${!isCurrent && rowIdx % 2 === 1 ? 'bg-gray-50' : ''}
                    hover:bg-gray-100 transition-colors
                  `}
                >
                  <td className="px-2 py-1.5 text-center text-xs font-bold text-orange-500 align-middle whitespace-nowrap">
                    {formatTimeDisplay(row.start).replace(':00', '').replace(' ', '')} - {formatTimeDisplay(row.end).replace(':00', '').replace(' ', '')}
                    {isCurrent && (
                      <span className="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                        NOW
                      </span>
                    )}
                  </td>
                  {PEOPLE.map(person => {
                    const cellData = getCellContent(person, row.start, row.end);
                    const calEvent = getCalEvent(person, row.start, row.end);
                    // Calendar events take priority
                    if (calEvent) {
                      return (
                        <td
                          key={person}
                          className="px-1.5 py-1 text-center text-xs font-medium align-middle bg-blue-100 text-blue-900"
                          title={`${calEvent.summary}${calEvent.location ? ' @ ' + calEvent.location : ''}`}
                        >
                          <span className="leading-tight block font-bold">{calEvent.summary}</span>
                        </td>
                      );
                    }
                    if (cellData) {
                      const { activity, index } = cellData;
                      const typeColor = ACTIVITY_COLORS[activity.type] || '#ffffff';
                      const isEditing = editState.active && editState.activityIndex === index;
                      return (
                        <td
                          key={person}
                          className={`px-1.5 py-1 text-center text-sm font-medium align-middle cursor-pointer transition-all ${activity.completed ? 'line-through opacity-50' : ''} ${editMode ? 'hover:ring-2 hover:ring-blue-300' : ''}`}
                          style={{ backgroundColor: typeColor, color: getTypeTextColor(activity.type) }}
                          onClick={() => editMode && setEditState({ active: true, activityIndex: index })}
                        >
                          {isEditing ? (
                            <InlineActivityEditor
                              activity={activity}
                              index={index}
                              onUpdate={onActivityUpdate}
                              onRemove={onActivityRemove}
                              onClose={() => setEditState({ active: false, activityIndex: -1 })}
                            />
                          ) : (
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={e => { e.stopPropagation(); onToggleComplete(index); }}
                                className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 transition-colors ${activity.completed ? 'bg-green-500 border-green-600' : 'border-gray-400 hover:border-green-500'}`}
                                title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {activity.completed && (
                                  <svg viewBox="0 0 12 12" className="w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 6l3 3 5-5" />
                                  </svg>
                                )}
                              </button>
                              <span className="text-xs leading-tight">{activity.title}</span>
                            </div>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={person}
                        className={`px-1.5 py-1 text-center align-middle ${editMode ? 'cursor-pointer hover:bg-blue-50 hover:ring-1 hover:ring-blue-200' : ''}`}
                        onClick={() => handleCellClick(person, row.start, row.end)}
                      >
                        {editMode && (
                          <span className="text-gray-300 text-xs opacity-0 hover:opacity-100 transition-opacity">+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ACTIVITY_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: color }} />
            <span className="capitalize text-gray-600">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTypeTextColor(type: ActivityType): string {
  const textColors: Record<ActivityType, string> = {
    routine: '#1b5e20', meal: '#f57f17', personal: '#0d47a1', work: '#4a148c',
    family: '#e65100', school: '#004d40', activity: '#880e4f', break: '#424242', other: '#212121'
  };
  return textColors[type] || '#212121';
}

function InlineActivityEditor({
  activity, index, onUpdate, onRemove, onClose
}: {
  activity: Activity; index: number;
  onUpdate: (index: number, updates: Partial<Activity>) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(activity.title);
  const [start, setStart] = useState(activity.start);
  const [end, setEnd] = useState(activity.end);
  const [type, setType] = useState<ActivityType>(activity.type);
  const [people, setPeople] = useState(activity.people.join(', '));
  const [notes, setNotes] = useState(activity.notes || '');
  const [expanded, setExpanded] = useState(false);

  function handleSave() {
    onUpdate(index, {
      title, start, end, type,
      color: ACTIVITY_COLORS[type],
      people: people.split(',').map(p => p.trim()).filter(Boolean),
      notes
    });
    onClose();
  }

  return (
    <div className="bg-white border-2 border-blue-400 rounded-lg p-2 shadow-lg text-left" onClick={e => e.stopPropagation()}>
      <input type="text" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-1" placeholder="Activity title" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
      />
      <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 underline mb-1">
        {expanded ? 'Less...' : 'More...'}
      </button>
      {expanded && (
        <div className="space-y-1 mt-1">
          <div className="flex gap-1">
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-xs flex-1" />
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-xs flex-1" />
          </div>
          <select value={type} onChange={e => setType(e.target.value as ActivityType)} className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs">
            <option value="routine">Routine</option><option value="meal">Meal</option>
            <option value="personal">Personal</option><option value="work">Work</option>
            <option value="family">Family</option><option value="school">School</option>
            <option value="activity">Activity</option><option value="break">Break</option>
            <option value="other">Other</option>
          </select>
          <input type="text" value={people} onChange={e => setPeople(e.target.value)}
            className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs" placeholder="Jason, Kay, Emma, Toby" />
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs" placeholder="Notes" />
        </div>
      )}
      <div className="flex gap-1 mt-1">
        <button onClick={handleSave} className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">Save</button>
        <button onClick={onClose} className="bg-gray-300 text-gray-700 px-2 py-0.5 rounded text-xs">Cancel</button>
        <button onClick={() => { onRemove(index); onClose(); }} className="bg-red-500 text-white px-2 py-0.5 rounded text-xs ml-auto">Delete</button>
      </div>
    </div>
  );
}
