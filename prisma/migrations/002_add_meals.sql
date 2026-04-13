-- Add meals table
CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
  person TEXT NOT NULL, -- 'Jason', 'Kay', 'Emma', 'Toby', 'Family'

  -- Meal details
  name TEXT NOT NULL,
  description TEXT,

  -- Nutrition for Jason
  calories INTEGER DEFAULT 0,
  protein NUMERIC(5,1), -- grams
  carbs NUMERIC(5,1), -- grams
  fat NUMERIC(5,1), -- grams

  -- Status
  planned BOOLEAN DEFAULT true,
  consumed BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_meal UNIQUE(date, meal_type, person)
);

CREATE INDEX idx_meals_date ON meals(date);
CREATE INDEX idx_meals_person ON meals(person);

-- Add daily calorie tracking table
CREATE TABLE IF NOT EXISTS daily_calorie_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL UNIQUE,
  person TEXT NOT NULL,

  -- Calorie targets and actuals
  target_calories INTEGER DEFAULT 1600,
  total_planned INTEGER DEFAULT 0,
  total_consumed INTEGER DEFAULT 0,

  -- Macronutrient totals
  total_protein NUMERIC(6,1) DEFAULT 0,
  total_carbs NUMERIC(6,1) DEFAULT 0,
  total_fat NUMERIC(6,1) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_daily_calorie_date ON daily_calorie_summary(date);
CREATE INDEX idx_daily_calorie_person ON daily_calorie_summary(person);

-- Add meals column to schedules table for quick reference
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS has_meal_plan BOOLEAN DEFAULT false;
