// Shared mock data for DnD demo pages
import { Activity, ActivityType, ACTIVITY_COLORS } from '@/lib/types';

export const PEOPLE = ['Jason', 'Kay', 'Emma', 'Toby'] as const;
export const DEMO_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'
] as const;

export const PERSON_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  Jason: { bg: '#dbeafe', border: '#3b82f6', dot: '#2563eb' },
  Kay: { bg: '#fce7f3', border: '#ec4899', dot: '#db2777' },
  Emma: { bg: '#dcfce7', border: '#22c55e', dot: '#16a34a' },
  Toby: { bg: '#ffedd5', border: '#f97316', dot: '#ea580c' }
};

function makeId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

let counter = 0;
function freshId(): string {
  return `demo-${++counter}`;
}

export interface DemoActivity {
  id: string;
  title: string;
  start: string;
  end: string;
  person: string;
  type: ActivityType;
}

export function getMockActivities(): DemoActivity[] {
  counter = 0;
  return [
    { id: freshId(), title: 'Morning Run', start: '08:00', end: '09:00', person: 'Jason', type: 'routine' },
    { id: freshId(), title: 'Math', start: '08:00', end: '09:00', person: 'Emma', type: 'school' },
    { id: freshId(), title: 'Playtime', start: '08:00', end: '09:00', person: 'Toby', type: 'activity' },
    { id: freshId(), title: 'Yoga', start: '09:00', end: '10:00', person: 'Kay', type: 'personal' },
    { id: freshId(), title: 'Reading', start: '09:00', end: '10:00', person: 'Emma', type: 'school' },
    { id: freshId(), title: 'Standup', start: '10:00', end: '11:00', person: 'Jason', type: 'work' },
    { id: freshId(), title: 'Piano', start: '10:00', end: '11:00', person: 'Emma', type: 'activity' },
    { id: freshId(), title: 'Crafts', start: '11:00', end: '12:00', person: 'Toby', type: 'activity' },
    { id: freshId(), title: 'Lunch', start: '12:00', end: '13:00', person: 'Jason', type: 'meal' },
    { id: freshId(), title: 'Lunch', start: '12:00', end: '13:00', person: 'Kay', type: 'meal' },
    { id: freshId(), title: 'Nap', start: '13:00', end: '14:00', person: 'Toby', type: 'routine' },
    { id: freshId(), title: 'Meeting', start: '13:00', end: '14:00', person: 'Jason', type: 'work' },
    { id: freshId(), title: 'Science', start: '14:00', end: '15:00', person: 'Emma', type: 'school' },
    { id: freshId(), title: 'Snack', start: '14:00', end: '15:00', person: 'Toby', type: 'meal' },
  ];
}

export function getActivityColor(type: ActivityType): string {
  return ACTIVITY_COLORS[type] || '#ffffff';
}

export function getTypeTextColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    routine: '#1b5e20', meal: '#f57f17', personal: '#0d47a1', work: '#4a148c',
    family: '#e65100', school: '#004d40', activity: '#880e4f', break: '#424242', other: '#212121'
  };
  return colors[type] || '#212121';
}

export function formatSlot(time: string): string {
  return time.replace(':00', '').replace(/^(?:0)?(\d+)/, (_, h) => {
    const hour = parseInt(h);
    if (hour === 0 || hour === 12) return '12';
    if (hour > 12) return String(hour - 12);
    return h;
  }) + (parseInt(time) < 12 ? 'a' : 'p');
}
