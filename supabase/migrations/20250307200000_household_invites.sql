-- SE-01: Invitar miembros por enlace
CREATE TABLE IF NOT EXISTS household_invites (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_household_invites_household ON household_invites(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invites_expires ON household_invites(expires_at);

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

-- Solo miembros del hogar pueden ver sus invites (y el join los consume sin SELECT aquí)
CREATE POLICY "household_invites_insert" ON household_invites FOR INSERT
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "household_invites_select" ON household_invites FOR SELECT
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "household_invites_delete" ON household_invites FOR DELETE
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Nota: el join (validar token y añadir miembro) se hace desde la API con service role para poder insertar en household_members.
