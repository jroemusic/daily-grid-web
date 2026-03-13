#!/usr/bin/env tsx
/**
 * Template Seeding Script
 * Loads templates from JSON files and inserts them into Supabase
 *
 * Usage:
 *   npm run seed:templates
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEMPLATES_DIR = path.join(process.cwd(), 'public/data');

interface JsonTemplate {
  displayName: string;
  description?: string;
  activities: any[];
}

const templateMapping: Record<string, string> = {
  'free-day.json': 'free-day',
  'school-day.json': 'school-day',
  'school-day-fri.json': 'school-day-fri',
  'school-day-thu.json': 'school-day-thu',
  'school-day-wed.json': 'school-day-wed',
  'morning-routine.json': 'morning-routine'
};

async function seedTemplates() {
  console.log('Seeding templates from public/data...\n');

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(`Templates directory not found: ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  const files = Object.keys(templateMapping);

  for (const file of files) {
    const name = templateMapping[file];
    const filePath = path.join(TEMPLATES_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${file}`);
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: JsonTemplate = JSON.parse(content);

      // Check if exists
      const { data: existing } = await supabase
        .from('templates')
        .select('id')
        .eq('name', name)
        .single();

      if (existing) {
        console.log(`⏭️  Skipping existing: ${name}`);
        // Update anyway to refresh activities
        await supabase
          .from('templates')
          .update({
            display_name: data.displayName,
            description: data.description || '',
            activities: data.activities
          })
          .eq('name', name);
        console.log(`✅ Updated: ${name}`);
      } else {
        // Insert new
        const { error } = await supabase
          .from('templates')
          .insert({
            name,
            display_name: data.displayName,
            description: data.description || '',
            activities: data.activities
          });

        if (error) {
          console.error(`❌ Error inserting ${name}:`, error.message);
        } else {
          console.log(`✅ Inserted: ${name}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }

  console.log('\nDone!');
}

seedTemplates().catch(console.error);
