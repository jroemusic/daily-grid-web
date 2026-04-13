# 🍽️ Meal Planning System - Complete Guide

## What Was Built

A comprehensive meal planning system integrated into your Daily Grid that includes:

### 1. **Jason's Calorie Tracking (1,600 cal/day)**
- Visual calorie tracker with progress bar
- Real-time consumed vs. remaining calories
- Macronutrient tracking (protein, carbs, fat)
- Color-coded progress (green → yellow → red as you approach limit)

### 2. **Family Meal Planning**
- Plan meals for everyone: Jason, Kay, Emma, Toby, or Family
- Four meal types: Breakfast, Lunch, Dinner, Snacks
- Quick mark-as-eaten functionality
- Clear meal organization

### 3. **Integration with Daily Grid**
- Meals appear on printable schedules
- Shows in preview/export views
- Color-coded meal sections (warm orange theme)

---

## Database Schema

### `meals` Table
```sql
- id: UUID (primary key)
- date: TEXT (YYYY-MM-DD)
- meal_type: TEXT ('breakfast', 'lunch', 'dinner', 'snack')
- person: TEXT ('Jason', 'Kay', 'Emma', 'Toby', 'Family')
- name: TEXT
- description: TEXT (optional)
- calories: INTEGER (for Jason)
- protein: NUMERIC (grams, for Jason)
- carbs: NUMERIC (grams, for Jason)
- fat: NUMERIC (grams, for Jason)
- planned: BOOLEAN
- consumed: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### `daily_calorie_summary` Table
```sql
- id: UUID (primary key)
- date: TEXT (YYYY-MM-DD)
- person: TEXT
- target_calories: INTEGER (1600 for Jason, 2000 for others)
- total_planned: INTEGER
- total_consumed: INTEGER
- total_protein: NUMERIC
- total_carbs: NUMERIC
- total_fat: NUMERIC
```

---

## API Endpoints

### Get Meals for a Date
```bash
GET /api/meals/2026-03-20
GET /api/meals/2026-03-20?person=Jason
GET /api/meals/2026-03-20?full=true  # Includes calorie summary
```

### Create a Meal
```bash
POST /api/meals/2026-03-20
{
  "mealType": "breakfast",
  "person": "Jason",
  "name": "Protein Smoothie",
  "description": "Spinach, protein powder, banana, almond milk",
  "calories": 350,
  "protein": 30,
  "carbs": 45,
  "fat": 8
}
```

### Update a Meal
```bash
PUT /api/meals/2026-03-20
{
  "id": "meal-uuid",
  "consumed": true  # Mark as eaten
}
```

### Delete a Meal
```bash
DELETE /api/meals/2026-03-20?id=meal-uuid
```

---

## Sample Daily Meal Plan

Based on your typical eating patterns:

### Jason's Meals (1,500 cal total)
```
🌅 Breakfast (350 cal)
  Protein Smoothie - Spinach, protein powder, banana, almond milk
  P: 30g | C: 45g | F: 8g

☀️ Lunch (450 cal)
  Grilled Chicken Salad - Mixed greens, cherry tomatoes, cucumber
  P: 40g | C: 20g | F: 22g

🍎 Snack (100 cal)
  Special K Bar - Chocolate almond
  P: 2g | C: 18g | F: 3g

🌙 Dinner (550 cal)
  Salmon with Vegetables - Grilled salmon, broccoli, brown rice
  P: 35g | C: 40g | F: 25g
```

---

## How to Use

### 1. **Run Database Migration**
```bash
cd ~/dev/daily-grid-web
npm run migrate:setup | psql $DATABASE_URL
```

### 2. **Seed Sample Meals**
```bash
npm run seed:meals
# or
tsx scripts/seed-meals.ts
```

### 3. **View Meals in Daily Grid**
- Open any schedule in the editor
- Meals will appear in the preview/print view
- Calorie tracker shows at top for Jason

### 4. **Manage Meals**
- Mark meals as eaten with one click
- Delete meals you didn't eat
- Calorie summary updates automatically

---

## File Structure

```
daily-grid-web/
├── lib/
│   ├── types-meals.ts        # Meal planning types
│   └── db-meals.ts           # Database functions for meals
├── app/api/meals/
│   └── [date]/route.ts       # API endpoints
├── components/
│   └── MealPlanning.tsx      # UI component (for future use)
├── prisma/migrations/
│   └── 002_add_meals.sql     # Database schema
└── scripts/
    └── seed-meals.ts         # Sample meal data
```

---

## Features

### ✅ Implemented
- [x] Database schema for meals and calorie tracking
- [x] API endpoints for CRUD operations
- [x] Automatic calorie summary calculation
- [x] Integration with printable schedule
- [x] Visual calorie tracker with progress bar
- [x] Macronutrient tracking (protein, carbs, fat)
- [x] Mark meals as consumed
- [x] Sample meal seeding script

### 🚧 Ready for Deployment
- Database migration needs to be run on production Supabase
- All code is production-ready
- Timezone bug fixed (dates now use local time)

### 📋 Future Enhancements (Optional)
- [ ] Meal planning UI in the editor
- [ ] Meal suggestions based on calorie goals
- [ ] Weekly meal planning view
- [ ] Grocery list generation
- [ ] Nutrition goal tracking

---

## Calorie Targets

| Person | Target | Notes |
|--------|--------|-------|
| Jason | 1,600 | Weight loss goal (returning to 128 lbs) |
| Kay | 2,000 | Standard maintenance |
| Emma | 1,400 | Growing kid (age-adjusted) |
| Toby | 1,200 | Growing kid (age-adjusted) |

---

## Quick Start

1. **Run migration on production database**
2. **Seed sample meals**: `npm run seed:meals`
3. **Deploy to Vercel**: `git push origin main`
4. **Test live**: https://grid.jandkay.com

---

## Notes

- Calorie tracking is automatic based on meals marked as "consumed"
- Meal plans integrate seamlessly with your existing schedule
- All meal data appears on printable/exported schedules
- Family meals can be planned separately from individual meals
- Kids' meals don't track calories (just planning)
