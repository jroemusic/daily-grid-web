#!/usr/bin/env tsx
/**
 * Seed sample meal plans
 */

import { createClient } from '@supabase/supabase-js';
import { getTodayDate } from '../lib/time';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.error('❌ Please configure .env.local with real Supabase credentials first');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedMeals() {
  const today = getTodayDate();

  console.log(`🌱 Seeding meal plan for ${today}...\n`);

  // Jason's meals (1600 calorie target)
  const jasonMeals = [
    {
      date: today,
      meal_type: 'breakfast',
      person: 'Jason',
      name: 'Protein Smoothie',
      description: 'Spinach, protein powder, banana, almond milk',
      calories: 350,
      protein: 30,
      carbs: 45,
      fat: 8,
      planned: true,
      consumed: false
    },
    {
      date: today,
      meal_type: 'lunch',
      person: 'Jason',
      name: 'Grilled Chicken Salad',
      description: 'Mixed greens, cherry tomatoes, cucumber, grilled chicken',
      calories: 450,
      protein: 40,
      carbs: 20,
      fat: 22,
      planned: true,
      consumed: false
    },
    {
      date: today,
      meal_type: 'snack',
      person: 'Jason',
      name: 'Special K Bar',
      description: 'Chocolate almond',
      calories: 100,
      protein: 2,
      carbs: 18,
      fat: 3,
      planned: true,
      consumed: false
    },
    {
      date: today,
      meal_type: 'dinner',
      person: 'Jason',
      name: 'Salmon with Vegetables',
      description: 'Grilled salmon, broccoli, brown rice',
      calories: 550,
      protein: 35,
      carbs: 40,
      fat: 25,
      planned: true,
      consumed: false
    }
  ];

  // Family meals
  const familyMeals = [
    {
      date: today,
      meal_type: 'breakfast',
      person: 'Family',
      name: 'Family Breakfast',
      description: 'Eggs, toast, fruit for everyone',
      calories: 0,
      planned: true,
      consumed: false
    },
    {
      date: today,
      meal_type: 'lunch',
      person: 'Family',
      name: 'Family Lunch',
      description: 'Sandwiches, soup, veggies',
      calories: 0,
      planned: true,
      consumed: false
    },
    {
      date: today,
      meal_type: 'dinner',
      person: 'Family',
      name: 'Family Dinner',
      description: 'Grilled salmon, roasted vegetables, rice',
      calories: 0,
      planned: true,
      consumed: false
    }
  ];

  // Kids' meals
  const kidsMeals = [
    {
      date: today,
      meal_type: 'snack',
      person: 'Emma',
      name: 'Apple and Peanut Butter',
      description: 'Sliced apple with peanut butter',
      calories: 0,
      planned: true,
      consumed: false
    },
    {
      date: today,
      meal_type: 'snack',
      person: 'Toby',
      name: 'Yogurt and Berries',
      description: 'Greek yogurt with mixed berries',
      calories: 0,
      planned: true,
      consumed: false
    }
  ];

  // Insert all meals
  const allMeals = [...jasonMeals, ...familyMeals, ...kidsMeals];

  for (const meal of allMeals) {
    try {
      await supabase.from('meals').insert(meal);
      console.log(`✓ Added: ${meal.person}'s ${meal.meal_type} - ${meal.name}`);
    } catch (error: any) {
      if (error.code !== '23505') { // Ignore duplicate key errors
        console.error(`✗ Failed to add ${meal.name}:`, error.message);
      }
    }
  }

  // Create calorie summary for Jason
  const totalJasonCalories = jasonMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  try {
    await supabase.from('daily_calorie_summary').upsert({
      date: today,
      person: 'Jason',
      target_calories: 1600,
      total_planned: totalJasonCalories,
      total_consumed: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0
    }, {
      onConflict: 'date,person'
    });
    console.log(`\n✓ Created calorie summary for Jason: ${totalJasonCalories} cal planned`);
  } catch (error: any) {
    console.error('✗ Failed to create calorie summary:', error.message);
  }

  console.log('\n✅ Meal plan seeded successfully!');
}

seedMeals().catch(console.error);
