-- RC-04: Favoritos, valoración (1-5) y Family approved en recetas
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  ADD COLUMN IF NOT EXISTS family_approved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN recipes.is_favorite IS 'Receta marcada como favorita por el usuario';
COMMENT ON COLUMN recipes.rating IS 'Valoración 1-5 estrellas; NULL si sin valorar';
COMMENT ON COLUMN recipes.family_approved IS 'Marcada como aprobada por la familia para reutilización rápida';
