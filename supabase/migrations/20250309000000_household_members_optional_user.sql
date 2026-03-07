-- Permitir miembros sin cuenta (solo perfil: ej. hijo que no usa la app)
-- user_id NULL = perfil creado por alguien del hogar, no tiene cuenta

ALTER TABLE household_members
  ALTER COLUMN user_id DROP NOT NULL;

-- Quitar UNIQUE(household_id, user_id) para permitir varios con user_id NULL
ALTER TABLE household_members
  DROP CONSTRAINT IF EXISTS household_members_household_id_user_id_key;

-- Un mismo usuario solo puede estar una vez por hogar
CREATE UNIQUE INDEX IF NOT EXISTS household_members_household_user_key
  ON household_members(household_id, user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN household_members.user_id IS 'Usuario que usa la app; NULL = perfil sin cuenta (ej. niño)';

-- RLS: permitir INSERT de perfil sin cuenta si eres miembro del hogar
-- (INSERT con user_id = auth.uid() ya permitido por política existente)
DROP POLICY IF EXISTS "household_members_insert" ON household_members;
CREATE POLICY "household_members_insert" ON household_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
    )
  );
