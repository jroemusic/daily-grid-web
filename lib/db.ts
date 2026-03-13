import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate and create Supabase client
let supabaseInstance: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co') {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn('Failed to create Supabase client:', error);
  }
}

export const supabase = supabaseInstance;

// Helper to check if database is configured
export function isDatabaseConfigured(): boolean {
  return supabaseInstance !== null;
}

// Database types
export interface DatabaseSchedule {
  id: string;
  date: string;
  day_name: string;
  activities: any;
  calendar_events: any;
  reminders: any;
  created_at: string;
  updated_at: string;
}

export interface DatabaseTemplate {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  activities: any;
  created_at: string;
  updated_at: string;
}

// Helper functions for database operations
export async function getSchedules(limit = 10): Promise<DatabaseSchedule[]> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await (supabase as ReturnType<typeof createClient>)
    .from('schedules')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as DatabaseSchedule[];
}

export async function getScheduleByDate(date: string): Promise<DatabaseSchedule | null> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await (supabase as ReturnType<typeof createClient>)
    .from('schedules')
    .select('*')
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return (data || null) as DatabaseSchedule | null;
}

export async function createSchedule(schedule: Omit<DatabaseSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseSchedule> {
  if (!supabase) throw new Error('Database not configured');
  const client = supabase as any;
  const { data, error } = await client
    .from('schedules')
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  return data as DatabaseSchedule;
}

export async function updateSchedule(id: string, updates: Partial<DatabaseSchedule>): Promise<DatabaseSchedule> {
  if (!supabase) throw new Error('Database not configured');
  const client = supabase as any;
  const { data, error } = await client
    .from('schedules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DatabaseSchedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!supabase) throw new Error('Database not configured');
  const client = supabase as any;
  const { error } = await client
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getTemplates(): Promise<DatabaseTemplate[]> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await (supabase as ReturnType<typeof createClient>)
    .from('templates')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []) as DatabaseTemplate[];
}

export async function getTemplateByName(name: string): Promise<DatabaseTemplate | null> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await (supabase as ReturnType<typeof createClient>)
    .from('templates')
    .select('*')
    .eq('name', name)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data || null) as DatabaseTemplate | null;
}

export async function createTemplate(template: Omit<DatabaseTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseTemplate> {
  if (!supabase) throw new Error('Database not configured');
  const client = supabase as any;
  const { data, error } = await client
    .from('templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data as DatabaseTemplate;
}

export async function updateTemplate(id: string, updates: Partial<DatabaseTemplate>): Promise<DatabaseTemplate> {
  if (!supabase) throw new Error('Database not configured');
  const client = supabase as any;
  const { data, error } = await client
    .from('templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DatabaseTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!supabase) throw new Error('Database not configured');
  const client = supabase as any;
  const { error } = await client
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
