-- CP-05: Perfiles de hogar — nombre de miembro y porciones por persona
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS default_servings SMALLINT NOT NULL DEFAULT 1 CHECK (default_servings >= 1 AND default_servings <= 20);

COMMENT ON COLUMN household_members.display_name IS 'Nombre para mostrar en casa (ej. "Mamá", "Pepe")';
COMMENT ON COLUMN household_members.default_servings IS 'Porciones que suele comer esta persona (para escalar recetas)';
