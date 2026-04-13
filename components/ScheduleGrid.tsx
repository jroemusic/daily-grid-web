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
const PERSON_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  Jason: { bg: '#dbeafe', border: '#3b82f6', dot: '#2563eb' },
  Kay: { bg: '#fce7f3', border: '#ec4899', dot: '#db2777' },
  Emma: { bg: '#dcfce7', border: '#22c55e', dot: '#16a34a' },
  Toby: { bg: '#ffedd5', border: '#f97316', dot: '#ea580c' }
};
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

interface ScheduleGridProps {
  schedule: Schedule;
  onActivityUpdate: (index: number, updates: Partial<Activity>) => void;
  onActivityAdd: (start: string, end: string, person: string) => void;
  onActivityRemove: (index: number) => void;
  onToggleComplete: (index: number) => void;
  onCalendarEventOverride: (eventId: string, overrides: { enabled?: boolean; overridePeople?: string[] }) => void;
  editMode: boolean;
}

export default function ScheduleGrid({
  schedule,
  onActivityUpdate,
  onActivityAdd,
  onActivityRemove,
  onToggleComplete,
  onCalendarEventOverride,
  editMode
}: ScheduleGridProps) {
  const [editState, setEditState] = useState<{
    active: boolean;
    activityIndex: number;
  }>({ active: false, activityIndex: -1 });
  const [currentTime, setCurrentTime] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setCurrentTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
      const minsLeft = 59 - now.getMinutes();
      const secsLeft = 59 - now.getSeconds();
      setCountdown(`${minsLeft}:${secsLeft.toString().padStart(2, '0')}`);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  function isoToHHMM(iso: string): string {
    if (!iso.includes('T')) return iso;
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

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

  // Helper: get resolved people for a calendar event (override > default)
  function getEventPeople(event: CalendarEvent): string[] {
    if (event.overridePeople) return event.overridePeople;
    if (event.people) return event.people;
    if (event.person) return [event.person];
    return ['Jason'];
  }

  const calEventRows = new Map<string, CalendarEvent>();
  for (const event of schedule.calendarEvents || []) {
    if (event.enabled === false) continue; // disabled via override
    const evtStart = timeToMinutes(isoToHHMM(event.start));
    const evtEnd = timeToMinutes(isoToHHMM(event.end));
    const eventPeople = getEventPeople(event);
    for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
      const slotStart = timeToMinutes(TIME_SLOTS[i]);
      const slotEnd = timeToMinutes(TIME_SLOTS[i + 1]);
      const overlap = Math.min(evtEnd, slotEnd) - Math.max(evtStart, slotStart);
      if (overlap >= 15) {
        for (const person of eventPeople) {
          calEventRows.set(`${TIME_SLOTS[i]}-${TIME_SLOTS[i + 1]}-${person}`, event);
        }
      }
    }
  }

  const baseRows: { start: string; end: string }[] = [];
  for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
    baseRows.push({ start: TIME_SLOTS[i], end: TIME_SLOTS[i + 1] });
  }

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

  const completed = schedule.activities.filter(a => a.completed).length;
  const total = schedule.activities.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Status Bar: Countdown + Calendar Events side by side */}
      {currentTime && (
        <div className="flex gap-4">
          {/* Countdown */}
          <div className="flex-shrink-0 bg-white rounded-2xl p-4 shadow-sm border border-stone-200 text-center min-w-[140px]">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-1">Next Hour</div>
            <div className="text-3xl font-bold text-stone-700 tabular-nums tracking-tight">{countdown}</div>
          </div>

          {/* Calendar Events (interactive) */}
          {schedule.calendarEvents && schedule.calendarEvents.length > 0 ? (
            <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-blue-200 overflow-hidden">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-blue-400 mb-2">Calendar</div>
              <div className="space-y-2">
                {schedule.calendarEvents.map((event: CalendarEvent) => {
                  const eventTime = event.start.includes('T')
                    ? new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : '';
                  const eventEndTime = event.end.includes('T')
                    ? new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : '';
                  const isEnabled = event.enabled !== false;
                  const eventPeople = getEventPeople(event);
                  return (
                    <div key={event.id} className={`rounded-lg p-2 transition-opacity ${isEnabled ? 'bg-blue-50' : 'bg-stone-100 opacity-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {/* Enable/disable toggle */}
                        <button
                          onClick={() => onCalendarEventOverride(event.id, { enabled: !isEnabled })}
                          className={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 ${isEnabled ? 'bg-blue-500' : 'bg-stone-300'}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isEnabled ? 'left-3.5' : 'left-0.5'}`} />
                        </button>
                        <span className="font-mono text-[10px] font-semibold text-blue-600 min-w-[100px]">
                          {eventTime}{eventEndTime && eventEndTime !== eventTime ? ` - ${eventEndTime}` : ''}
                        </span>
                        <span className="font-semibold text-stone-800 text-xs">{event.summary}</span>
                        {event.source && <span className="text-stone-400 text-[10px] ml-auto flex-shrink-0">{event.source}</span>}
                      </div>
                      {/* Person toggles */}
                      <div className="flex gap-1 ml-9">
                        {PEOPLE.map(person => {
                          const isActive = eventPeople.includes(person);
                          return (
                            <button
                              key={person}
                              onClick={() => {
                                const current = eventPeople;
                                const next = isActive
                                  ? current.filter(p => p !== person)
                                  : [...current, person];
                                if (next.length === 0) return; // must have at least 1
                                onCalendarEventOverride(event.id, { overridePeople: next });
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                isActive
                                  ? 'text-white'
                                  : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                              }`}
                              style={isActive ? { backgroundColor: PERSON_COLORS[person]?.dot || '#666' } : {}}
                            >
                              {person}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-stone-400 mb-2">Calendar</div>
              <div className="text-sm text-stone-400">No events today</div>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-400">Progress</span>
            <span className="text-sm font-semibold text-stone-600">{completed}/{total} done</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${percentage}%`,
                background: percentage === 100
                  ? '#22c55e'
                  : 'linear-gradient(90deg, #f97316, #fb923c)'
              }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="bg-stone-800 text-stone-300 px-3 py-2.5 text-center text-[11px] font-semibold tracking-wider uppercase w-24">
                Time
              </th>
              {PEOPLE.map(person => (
                <th key={person} className="px-3 py-2.5 text-center text-[11px] font-semibold tracking-wider uppercase"
                  style={{ backgroundColor: PERSON_COLORS[person].bg, color: PERSON_COLORS[person].dot }}>
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
                  className={`border-b border-stone-100 last:border-0 ${
                    isCurrent ? 'bg-orange-50' : rowIdx % 2 === 1 ? 'bg-stone-50/50' : ''
                  }`}
                >
                  <td className={`px-3 py-2 text-center text-xs font-semibold align-middle whitespace-nowrap ${isCurrent ? 'text-orange-600' : 'text-stone-400'}`}>
                    <div>
                      {formatTimeDisplay(row.start).replace(':00', '').replace(' ', '')}
                      <span className="text-stone-300 mx-0.5">-</span>
                      {formatTimeDisplay(row.end).replace(':00', '').replace(' ', '')}
                    </div>
                    {isCurrent && (
                      <span className="inline-block mt-0.5 bg-orange-500 text-white px-1.5 py-px rounded-full text-[9px] font-bold tracking-wide animate-pulse">
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
                          className="px-2 py-2 text-center text-xs align-middle"
                          style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
                          title={`${calEvent.summary}${calEvent.location ? ' @ ' + calEvent.location : ''}`}
                        >
                          <span className="leading-tight block font-semibold">{calEvent.summary}</span>
                        </td>
                      );
                    }
                    if (cellData) {
                      const { activity, index } = cellData;
                      const typeColor = ACTIVITY_COLORS[activity.type] || '#ffffff';
                      const isEditing = editState.active && editState.activityIndex === index;
                      const personBorder = PERSON_COLORS[person]?.border || '#d1d5db';
                      return (
                        <td
                          key={person}
                          className={`px-2 py-1.5 text-center text-xs align-middle transition-all ${activity.completed ? 'opacity-40' : ''} ${editMode ? 'cursor-pointer hover:brightness-95' : ''}`}
                          style={{
                            backgroundColor: activity.completed ? '#f5f5f4' : typeColor,
                            color: activity.completed ? '#a8a29e' : getTypeTextColor(activity.type),
                            borderLeft: `3px solid ${personBorder}`
                          }}
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
                                className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all ${
                                  activity.completed
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/60 border border-stone-300 hover:border-green-400 hover:bg-green-50'
                                }`}
                                title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {activity.completed && (
                                  <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M2 6l3 3 5-5" />
                                  </svg>
                                )}
                              </button>
                              <span className={`leading-tight ${activity.completed ? 'line-through' : 'font-medium'}`}>
                                {activity.title}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={person}
                        className={`px-2 py-2 text-center align-middle ${editMode ? 'cursor-pointer hover:bg-stone-50' : ''}`}
                        style={{ borderLeft: `3px solid ${PERSON_COLORS[person]?.border || '#e7e5e4'}33` }}
                        onClick={() => handleCellClick(person, row.start, row.end)}
                      >
                        {editMode && (
                          <span className="text-stone-200 text-xs opacity-0 hover:opacity-100 transition-opacity text-lg leading-none">+</span>
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
      <div className="flex flex-wrap gap-3 text-xs px-1">
        {Object.entries(ACTIVITY_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-stone-200" style={{ backgroundColor: color }} />
            <span className="capitalize text-stone-500">{type}</span>
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
    <div className="bg-white rounded-xl p-3 shadow-xl border-2 border-stone-300 text-left" onClick={e => e.stopPropagation()}>
      <input type="text" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:border-stone-500 focus:ring-1 focus:ring-stone-300 outline-none" placeholder="Activity title" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
      />
      <button onClick={() => setExpanded(!expanded)} className="text-xs text-stone-500 hover:text-stone-700 mb-2 font-medium">
        {expanded ? '- Less options' : '+ Time, type, people...'}
      </button>
      {expanded && (
        <div className="space-y-1.5 mt-1 mb-2">
          <div className="flex gap-1.5">
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="border border-stone-300 rounded-lg px-2 py-1 text-xs flex-1 focus:border-stone-500 outline-none" />
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="border border-stone-300 rounded-lg px-2 py-1 text-xs flex-1 focus:border-stone-500 outline-none" />
          </div>
          <select value={type} onChange={e => setType(e.target.value as ActivityType)} className="w-full border border-stone-300 rounded-lg px-2 py-1 text-xs focus:border-stone-500 outline-none">
            <option value="routine">Routine</option><option value="meal">Meal</option>
            <option value="personal">Personal</option><option value="work">Work</option>
            <option value="family">Family</option><option value="school">School</option>
            <option value="activity">Activity</option><option value="break">Break</option>
            <option value="other">Other</option>
          </select>
          <input type="text" value={people} onChange={e => setPeople(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-2 py-1 text-xs focus:border-stone-500 outline-none" placeholder="Jason, Kay, Emma, Toby" />
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-2 py-1 text-xs focus:border-stone-500 outline-none" placeholder="Notes" />
        </div>
      )}
      <div className="flex gap-1.5">
        <button onClick={handleSave} className="bg-stone-800 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-stone-700">Save</button>
        <button onClick={onClose} className="bg-stone-100 text-stone-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-stone-200">Cancel</button>
        <button onClick={() => { onRemove(index); onClose(); }} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-100 ml-auto">Delete</button>
      </div>
    </div>
  );
}
