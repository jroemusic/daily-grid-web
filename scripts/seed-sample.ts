#!/usr/bin/env tsx
/**
 * Quick Data Seeding Script
 * Loads sample data for testing the app
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.error('❌ Please configure .env.local with real Supabase credentials first');
  console.error('   See SUPABASE_SETUP.md for instructions');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedSampleData() {
  console.log('🌱 Seeding sample schedule data...\n');

  const today = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Sample schedule
  const schedule = {
    date: today,
    day_name: dayName,
    activities: [
      {
        id: `act-${Date.now()}-1`,
        title: 'Morning Routine',
        start: '07:00',
        end: '08:00',
        people: ['Jason', 'Kay'],
        type: 'routine',
        color: '#c8e6c9',
        notes: 'Breakfast and planning'
      },
      {
        id: `act-${Date.now()}-2`,
        title: 'Work Time',
        start: '08:00',
        end: '10:00',
        people: ['Jason'],
        type: 'work',
        color: '#d1c4e9',
        notes: 'Deep work session'
      },
      {
        id: `act-${Date.now()}-3`,
        title: 'Kids Activities',
        start: '09:00',
        end: '10:00',
        people: ['Kay', 'Emma', 'Toby'],
        type: 'family',
        color: '#ffe0b2',
        notes: 'Morning activities'
      },
      {
        id: `act-${Date.now()}-4`,
        title: 'Family Walk',
        start: '12:00',
        end: '13:00',
        people: ['Jason', 'Kay', 'Emma', 'Toby'],
        type: 'family',
        color: '#ffe0b2',
        notes: 'Lunch break walk'
      }
    ],
    calendar_events: [],
    reminders: []
  };

  try {
    // Check if schedule already exists
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('date', today)
      .single();

    if (existing) {
      console.log(`⏭️  Schedule for ${today} already exists, skipping...`);
    } else {
      const { error } = await supabase
        .from('schedules')
        .insert(schedule);

      if (error) {
        console.error('❌ Error creating schedule:', error.message);
      } else {
        console.log(`✅ Created sample schedule for ${today}`);
      }
    }

    // Count schedules
    const { count } = await supabase
      .from('schedules')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total schedules in database: ${count || 0}`);

    // Count templates
    const { count: templateCount } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total templates in database: ${templateCount || 0}`);

    console.log('\n✅ Seeding complete!');
    console.log(`\n🚀 Start the dev server: npm run dev`);
    console.log(`🌐 Visit: http://localhost:3000`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

seedSampleData().catch(console.error);
