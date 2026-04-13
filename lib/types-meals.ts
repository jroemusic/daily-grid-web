/**
 * Meal planning types for Daily Grid
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Person = 'Jason' | 'Kay' | 'Emma' | 'Toby' | 'Family';

export interface Meal {
  id: string;
  date: string;
  mealType: MealType;
  person: Person;

  // Meal details
  name: string;
  description?: string;

  // Nutrition (for Jason)
  calories: number;
  protein?: number; // grams
  carbs?: number; // grams
  fat?: number; // grams

  // Status
  planned: boolean;
  consumed: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface DailyCalorieSummary {
  id: string;
  date: string;
  person: Person;
  targetCalories: number;
  totalPlanned: number;
  totalConsumed: number;

  // Macronutrients
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;

  createdAt: string;
  updatedAt: string;
}

export interface MealPlan {
  date: string;
  meals: Meal[];
  calorieSummary?: DailyCalorieSummary;
}

export interface MacroSummary {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}
