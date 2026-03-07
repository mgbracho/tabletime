-- NG-03: Restricciones dietéticas por miembro (etiquetas que debe cumplir la receta)
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';

COMMENT ON COLUMN household_members.dietary_restrictions IS 'Etiquetas que deben tener las recetas para este miembro (ej. sin gluten, vegetariana)';
