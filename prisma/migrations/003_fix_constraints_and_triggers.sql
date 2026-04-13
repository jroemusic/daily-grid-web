-- Fix daily_calorie_summary unique constraint to be (date, person)
-- Drop the old unique constraint on just 'date'
ALTER TABLE daily_calorie_summary DROP CONSTRAINT IF EXISTS daily_calorie_summary_date_key;

-- Add new unique constraint on (date, person)
ALTER TABLE daily_calorie_summary ADD CONSTRAINT daily_calorie_summary_date_person_key UNIQUE (date, person);

-- Add triggers for meals table to auto-update updated_at
CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for daily_calorie_summary to auto-update updated_at
CREATE TRIGGER update_daily_calorie_summary_updated_at BEFORE UPDATE ON daily_calorie_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add CHECK constraints for meal_type and person
ALTER TABLE meals ADD CONSTRAINT IF NOT EXISTS check_meal_type
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));

ALTER TABLE meals ADD CONSTRAINT IF NOT EXISTS check_person
  CHECK (person IN ('Jason', 'Kay', 'Emma', 'Toby', 'Family'));
