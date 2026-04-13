import { NextRequest, NextResponse } from 'next/server';
import { getMeals, createMeal, updateMeal, deleteMeal, markMealConsumed, getMealPlan } from '@/lib/db-meals';

/**
 * GET /api/meals/[date] - Get meals for a date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    // Check if full meal plan is requested
    const searchParams = request.nextUrl.searchParams;
    const fullPlan = searchParams.get('full') === 'true';

    if (fullPlan) {
      const mealPlan = await getMealPlan(date);
      return NextResponse.json(mealPlan);
    }

    // Otherwise return just meals
    const person = searchParams.get('person') as 'Jason' | 'Kay' | 'Emma' | 'Toby' | 'Family' | undefined;
    const meals = await getMeals(date, person);

    return NextResponse.json({ meals, date });
  } catch (error) {
    console.error('Error fetching meals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meals/[date] - Create a new meal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    const body = await request.json();

    const meal = await createMeal({
      date,
      mealType: body.mealType,
      person: body.person,
      name: body.name,
      description: body.description,
      calories: body.calories || 0,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
      planned: body.planned !== false,
      consumed: body.consumed || false
    });

    return NextResponse.json({ meal }, { status: 201 });
  } catch (error) {
    console.error('Error creating meal:', error);
    return NextResponse.json(
      { error: 'Failed to create meal' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/meals/[date] - Update a meal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Meal ID is required' },
        { status: 400 }
      );
    }

    const meal = await updateMeal(id, body);

    return NextResponse.json({ meal });
  } catch (error) {
    console.error('Error updating meal:', error);
    return NextResponse.json(
      { error: 'Failed to update meal' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meals/[date] - Delete a meal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Meal ID is required' },
        { status: 400 }
      );
    }

    await deleteMeal(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meal:', error);
    return NextResponse.json(
      { error: 'Failed to delete meal' },
      { status: 500 }
    );
  }
}
