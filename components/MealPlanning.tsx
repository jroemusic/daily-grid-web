'use client';

import { useState, useEffect } from 'react';
import { Meal, DailyCalorieSummary, MealType, Person } from '@/lib/types-meals';

interface MealPlanningProps {
  date: string;
}

export function MealPlanning({ date }: MealPlanningProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [calorieSummary, setCalorieSummary] = useState<DailyCalorieSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMealPlan();
  }, [date]);

  async function loadMealPlan() {
    try {
      const res = await fetch(`/api/meals/${date}?full=true`);
      if (res.ok) {
        const data = await res.json();
        setMeals(data.meals || []);
        setCalorieSummary(data.calorieSummary || null);
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading meal plan...</div>;
  }

  const jasonMeals = meals.filter(m => m.person === 'Jason');
  const familyMeals = meals.filter(m => m.person === 'Family' || m.person !== 'Jason');

  return (
    <div className="space-y-6">
      {/* Jason's Calorie Tracking */}
      {calorieSummary && (
        <CalorieTracker summary={calorieSummary} />
      )}

      {/* Jason's Meal Plan */}
      <MealPlanSection
        title="Jason's Meals (1,600 cal/day)"
        meals={jasonMeals}
        date={date}
        onUpdate={loadMealPlan}
        showCalories
        targetCalories={1600}
      />

      {/* Family Meal Plan */}
      <MealPlanSection
        title="Family Meals"
        meals={familyMeals}
        date={date}
        onUpdate={loadMealPlan}
        showCalories={false}
      />
    </div>
  );
}

function CalorieTracker({ summary }: { summary: DailyCalorieSummary }) {
  const percentage = Math.round((summary.totalConsumed / summary.targetCalories) * 100);
  const remaining = summary.targetCalories - summary.totalConsumed;
  const isOver = summary.totalConsumed > summary.targetCalories;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-l-4 border-green-500">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Jason's Calorie Tracker</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded p-3">
          <div className="text-2xl font-bold text-green-600">{summary.targetCalories}</div>
          <div className="text-sm text-gray-600">Target</div>
        </div>
        <div className="bg-white rounded p-3">
          <div className="text-2xl font-bold text-blue-600">{summary.totalConsumed}</div>
          <div className="text-sm text-gray-600">Consumed</div>
        </div>
        <div className="bg-white rounded p-3">
          <div className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-orange-600'}`}>
            {remaining}
          </div>
          <div className="text-sm text-gray-600">Remaining</div>
        </div>
        <div className="bg-white rounded p-3">
          <div className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-green-600'}`}>
            {percentage}%
          </div>
          <div className="text-sm text-gray-600">Progress</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              isOver ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Macros */}
      {summary.totalProtein > 0 && (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-white rounded p-2 text-center">
            <div className="font-bold text-gray-900">{summary.totalProtein.toFixed(1)}g</div>
            <div className="text-gray-600">Protein</div>
          </div>
          <div className="bg-white rounded p-2 text-center">
            <div className="font-bold text-gray-900">{summary.totalCarbs.toFixed(1)}g</div>
            <div className="text-gray-600">Carbs</div>
          </div>
          <div className="bg-white rounded p-2 text-center">
            <div className="font-bold text-gray-900">{summary.totalFat.toFixed(1)}g</div>
            <div className="text-gray-600">Fat</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MealPlanSection({
  title,
  meals,
  date,
  onUpdate,
  showCalories,
  targetCalories
}: {
  title: string;
  meals: Meal[];
  date: string;
  onUpdate: () => void;
  showCalories: boolean;
  targetCalories?: number;
}) {
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {showCalories && targetCalories && (
          <span className={`font-bold ${totalCalories > targetCalories ? 'text-red-600' : 'text-green-600'}`}>
            {totalCalories} / {targetCalories} cal
          </span>
        )}
      </div>

      <div className="space-y-4">
        {mealTypes.map(type => (
          <MealCard
            key={type}
            mealType={type}
            meals={meals.filter(m => m.mealType === type)}
            date={date}
            onUpdate={onUpdate}
            showCalories={showCalories}
          />
        ))}
      </div>
    </div>
  );
}

function MealCard({
  mealType,
  meals,
  date,
  onUpdate,
  showCalories
}: {
  mealType: MealType;
  meals: Meal[];
  date: string;
  onUpdate: () => void;
  showCalories: boolean;
}) {
  const mealTypeIcons = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍎'
  };

  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-gray-900">
          {mealTypeIcons[mealType]} {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
        </h4>
        {showCalories && meals.length > 0 && (
          <span className="text-sm font-medium text-gray-600">
            {totalCalories} cal
          </span>
        )}
      </div>

      {meals.length === 0 ? (
        <div className="text-gray-500 text-sm italic">No meals planned</div>
      ) : (
        <div className="space-y-2">
          {meals.map(meal => (
            <div
              key={meal.id}
              className={`flex justify-between items-start p-3 rounded ${
                meal.consumed ? 'bg-green-100' : 'bg-white'
              }`}
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">{meal.name}</div>
                {meal.description && (
                  <div className="text-sm text-gray-600">{meal.description}</div>
                )}
                {showCalories && meal.calories > 0 && (
                  <div className="text-sm text-gray-600">{meal.calories} cal</div>
                )}
                {meal.protein && (
                  <div className="text-xs text-gray-500">
                    P: {meal.protein}g | C: {meal.carbs || 0}g | F: {meal.fat || 0}g
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => markConsumed(meal.id)}
                  className={`px-2 py-1 rounded text-xs ${
                    meal.consumed
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-green-200'
                  }`}
                >
                  {meal.consumed ? '✓ Eaten' : 'Mark Eaten'}
                </button>
                <button
                  onClick={() => deleteMeal(meal.id)}
                  className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function markConsumed(mealId: string) {
  try {
    await fetch(`/api/meals/${new Date().toISOString().split('T')[0]}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: mealId,
        consumed: true
      })
    });
    window.location.reload();
  } catch (error) {
    console.error('Error marking meal as consumed:', error);
  }
}

async function deleteMeal(mealId: string) {
  if (!confirm('Delete this meal?')) return;

  try {
    await fetch(`/api/meals/${new Date().toISOString().split('T')[0]}?id=${mealId}`, {
      method: 'DELETE'
    });
    window.location.reload();
  } catch (error) {
    console.error('Error deleting meal:', error);
  }
}
