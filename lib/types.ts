// Core types for Daily Grid application

export interface Activity {
  id: string;
  title: string;
  start: string; // HH:MM format
  end: string;   // HH:MM format
  people: string[]; // ["Jason", "Kay", "Emma", "Toby"]
  type: ActivityType;
  color: string;
  notes?: string;
  completed?: boolean;
  completedAt?: string;
}

export type ActivityType =
  | 'routine'
  | 'meal'
  | 'personal'
  | 'work'
  | 'family'
  | 'school'
  | 'activity'
  | 'break'
  | 'other';

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  dayName: string;
  activities: Activity[];
  calendarEvents?: CalendarEvent[];
  reminders?: Reminder[];
  created_at?: string;
  updated_at?: string;
}

export interface Template {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  activities: Activity[];
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  person?: string;
  location?: string;
  description?: string;
}

export interface Reminder {
  time: string;
  message: string;
  person?: string;
}

export interface PersonInfo {
  name: string;
  color: string;
}

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  routine: '#c8e6c9',      // Green
  meal: '#fff9c4',         // Yellow
  personal: '#bbdefb',     // Blue
  work: '#d1c4e9',         // Purple
  family: '#ffe0b2',       // Orange
  school: '#b2dfdb',       // Teal
  activity: '#f8bbd0',     // Pink
  break: '#f0f0f0',        // Gray
  other: '#ffffff'         // White
};

export const PERSON_INFO: Record<string, PersonInfo> = {
  jason: { name: 'Jason', color: '#1976d2' },
  kay: { name: 'Kay', color: '#e91e63' },
  emma: { name: 'Emma', color: '#4caf50' },
  toby: { name: 'Toby', color: '#ff9800' }
};

export const CALENDAR_MAPPING: Record<string, string> = {
  'jroemusic@gmail.com': 'jason',
  'jandkaymusic@gmail.com': 'kay',
  'vppqsrush6srtu99lle2ifetrkobh5af@import.calendar.google.com': 'kay',
  '5uv8d4df4tsms9427jgqo64vjuktheme@import.calendar.google.com': 'jason'
};
