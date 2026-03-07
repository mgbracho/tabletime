-- PF-03: Raciones por defecto en recetas para escalar ingredientes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS default_servings INTEGER DEFAULT 4;
