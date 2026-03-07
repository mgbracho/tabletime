-- Añadir 'Snacks' como tipo de comida en theme_days (CP-01)
ALTER TABLE theme_days
  DROP CONSTRAINT IF EXISTS theme_days_meal_type_check;

ALTER TABLE theme_days
  ADD CONSTRAINT theme_days_meal_type_check
  CHECK (meal_type IN ('Desayuno', 'Comida', 'Cena', 'Snacks'));
