import { supabase } from './db';
import { Meal, DailyCalorieSummary, MealPlan, MealType, Person } from './types-meals';

// Database types
export interface DatabaseMeal {
  id: string;
  date: string;
  meal_type: string;
  person: string;
  name: string;
  description: string | null;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  planned: boolean;
  consumed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseCalorieSummary {
  id: string;
  date: string;
  person: string;
  target_calories: number;
  total_planned: number;
  total_consumed: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get meals for a specific date and person
 */
export async function getMeals(date: string, person?: Person): Promise<Meal[]> {
  if (!supabase) throw new Error('Database not configured');

  let query = (supabase as any)
    .from('meals')
    .select('*')
    .eq('date', date)
    .order('meal_type', { ascending: true });

  if (person) {
    query = query.eq('person', person);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []).map(transformMeal);
}

/**
 * Get or create daily calorie summary
 */
export async function getCalorieSummary(date: string, person: Person): Promise<DailyCalorieSummary | null> {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await (supabase as any)
    .from('daily_calorie_summary')
    .select('*')
    .eq('date', date)
    .eq('person', person)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  if (!data) return null;

  return transformCalorieSummary(data);
}

/**
 * Create a new meal
 */
export async function createMeal(meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Meal> {
  if (!supabase) throw new Error('Database not configured');

  const dbMeal = {
    date: meal.date,
    meal_type: meal.mealType,
    person: meal.person,
    name: meal.name,
    description: meal.description || null,
    calories: meal.calories,
    protein: meal.protein || null,
    carbs: meal.carbs || null,
    fat: meal.fat || null,
    planned: meal.planned,
    consumed: meal.consumed
  };

  const { data, error } = await (supabase as any)
    .from('meals')
    .insert(dbMeal)
    .select()
    .single();

  if (error) throw error;

  // Update calorie summary
  await updateCalorieSummary(meal.date, meal.person);

  return transformMeal(data);
}

/**
 * Update an existing meal
 */
export async function updateMeal(id: string, updates: Partial<Omit<Meal, 'id' | 'date' | 'createdAt' | 'updatedAt'>>): Promise<Meal> {
  if (!supabase) throw new Error('Database not configured');

  const dbUpdates: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Convert mealType to meal_type for database
  if (updates.mealType) {
    dbUpdates.meal_type = updates.mealType;
    delete dbUpdates.mealType;
  }

  const { data, error } = await (supabase as any)
    .from('meals')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Update calorie summary
  const meal = await getMealById(id);
  if (meal) {
    await updateCalorieSummary(meal.date, meal.person);
  }

  return transformMeal(data);
}

/**
 * Delete a meal
 */
export async function deleteMeal(id: string): Promise<void> {
  if (!supabase) throw new Error('Database not configured');

  const meal = await getMealById(id);
  if (!meal) return;

  const { error } = await (supabase as any)
    .from('meals')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Update calorie summary
  await updateCalorieSummary(meal.date, meal.person);
}

/**
 * Mark meal as consumed
 */
export async function markMealConsumed(id: string): Promise<Meal> {
  return updateMeal(id, { consumed: true });
}

/**
 * Get full meal plan for a date
 */
export async function getMealPlan(date: string): Promise<MealPlan> {
  const meals = await getMeals(date);
  const jasonSummary = await getCalorieSummary(date, 'Jason');

  return {
    date,
    meals,
    calorieSummary: jasonSummary || undefined
  };
}

/**
 * Update calorie summary for a person and date
 */
async function updateCalorieSummary(date: string, person: Person): Promise<void> {
  if (!supabase) throw new Error('Database not configured');

  // Get all consumed meals for this person and date
  const { data: meals } = await (supabase as any)
    .from('meals')
    .select('*')
    .eq('date', date)
    .eq('person', person);

  if (!meals || meals.length === 0) return;

  // Calculate totals
  const totalPlanned = meals.filter((m: any) => m.planned).reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
  const totalConsumed = meals.filter((m: any) => m.consumed).reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
  const totalProtein = meals.filter((m: any) => m.consumed).reduce((sum: number, m: any) => sum + (m.protein || 0), 0);
  const totalCarbs = meals.filter((m: any) => m.consumed).reduce((sum: number, m: any) => sum + (m.carbs || 0), 0);
  const totalFat = meals.filter((m: any) => m.consumed).reduce((sum: number, m: any) => sum + (m.fat || 0), 0);

  // Target calories
  const targetCalories = person === 'Jason' ? 1600 : 2000;

  // Upsert calorie summary
  const { error } = await (supabase as any)
    .from('daily_calorie_summary')
    .upsert({
      date,
      person,
      target_calories: targetCalories,
      total_planned: totalPlanned,
      total_consumed: totalConsumed,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fat: totalFat,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'date,person'
    });

  if (error) throw error;
}

/**
 * Get meal by ID
 */
async function getMealById(id: string): Promise<Meal | null> {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await (supabase as any)
    .from('meals')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return transformMeal(data);
}

/**
 * Transform database meal to Meal type
 */
function transformMeal(db: DatabaseMeal): Meal {
  return {
    id: db.id,
    date: db.date,
    mealType: db.meal_type as MealType,
    person: db.person as Person,
    name: db.name,
    description: db.description || undefined,
    calories: db.calories,
    protein: db.protein || undefined,
    carbs: db.carbs || undefined,
    fat: db.fat || undefined,
    planned: db.planned,
    consumed: db.consumed,
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}

/**
 * Transform database calorie summary to DailyCalorieSummary type
 */
function transformCalorieSummary(db: DatabaseCalorieSummary): DailyCalorieSummary {
  return {
    id: db.id,
    date: db.date,
    person: db.person as Person,
    targetCalories: db.target_calories,
    totalPlanned: db.total_planned,
    totalConsumed: db.total_consumed,
    totalProtein: db.total_protein,
    totalCarbs: db.total_carbs,
    totalFat: db.total_fat,
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}
