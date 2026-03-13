#!/usr/bin/env tsx
/**
 * Data Migration Script
 * Migrates schedules and templates from Flask app JSON files to Supabase
 *
 * Usage:
 *   npm run migrate:data
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const FLASK_DATA_DIR = path.join(process.env.HOME || '', '.openclaw/workspace/daily-grid/data');

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface JsonTemplate {
  displayName: string;
  description?: string;
  activities: any[];
}

interface JsonSchedule {
  date: string;
  dayName: string;
  activities: any[];
  calendarEvents?: any[];
  reminders?: any[];
}

async function migrateTemplates() {
  console.log('Migrating templates...');

  const templatesDir = path.join(FLASK_DATA_DIR, 'templates');
  if (!fs.existsSync(templatesDir)) {
    console.log('  No templates directory found, skipping...');
    return;
  }

  const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
  console.log(`  Found ${files.length} template files`);

  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const name = file.replace('.json', '');

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: JsonTemplate = JSON.parse(content);

      // Check if template already exists
      const { data: existing } = await supabase
        .from('templates')
        .select('id')
        .eq('name', name)
        .single();

      if (existing) {
        console.log(`  ⏭️  Skipping existing template: ${name}`);
        skipped++;
        continue;
      }

      // Insert template
      const { error } = await supabase
        .from('templates')
        .insert({
          name,
          display_name: data.displayName,
          description: data.description || '',
          activities: data.activities
        });

      if (error) {
        console.error(`  ❌ Error migrating ${name}:`, error.message);
      } else {
        console.log(`  ✅ Migrated: ${name}`);
        migrated++;
      }
    } catch (error) {
      console.error(`  ❌ Error reading ${file}:`, error);
    }
  }

  console.log(`\n  Templates: ${migrated} migrated, ${skipped} skipped\n`);
}

async function migrateSchedules() {
  console.log('Migrating schedules...');

  const schedulesDir = path.join(FLASK_DATA_DIR, 'schedules');
  if (!fs.existsSync(schedulesDir)) {
    console.log('  No schedules directory found, skipping...');
    return;
  }

  const files = fs.readdirSync(schedulesDir).filter(f => f.endsWith('.json'));
  console.log(`  Found ${files.length} schedule files`);

  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(schedulesDir, file);
    const date = file.replace('.json', '');

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.log(`  ⏭️  Skipping invalid date: ${date}`);
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: JsonSchedule = JSON.parse(content);

      // Check if schedule already exists
      const { data: existing } = await supabase
        .from('schedules')
        .select('id')
        .eq('date', date)
        .single();

      if (existing) {
        console.log(`  ⏭️  Skipping existing schedule: ${date}`);
        skipped++;
        continue;
      }

      // Insert schedule
      const { error } = await supabase
        .from('schedules')
        .insert({
          date,
          day_name: data.dayName,
          activities: data.activities,
          calendar_events: data.calendarEvents || [],
          reminders: data.reminders || []
        });

      if (error) {
        console.error(`  ❌ Error migrating ${date}:`, error.message);
      } else {
        console.log(`  ✅ Migrated: ${date}`);
        migrated++;
      }
    } catch (error) {
      console.error(`  ❌ Error reading ${file}:`, error);
    }
  }

  console.log(`\n  Schedules: ${migrated} migrated, ${skipped} skipped\n`);
}

async function main() {
  console.log('Daily Grid Data Migration\n');
  console.log(`Flask data directory: ${FLASK_DATA_DIR}\n`);

  // Check if directory exists
  if (!fs.existsSync(FLASK_DATA_DIR)) {
    console.error(`Error: Flask data directory not found: ${FLASK_DATA_DIR}`);
    console.log('Make sure the Flask app data exists at the expected location.');
    process.exit(1);
  }

  await migrateTemplates();
  await migrateSchedules();

  console.log('Migration complete!');
}

main().catch(console.error);
