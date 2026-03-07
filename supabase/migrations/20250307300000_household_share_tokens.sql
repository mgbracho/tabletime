-- SE-01: Compartir plan y lista por enlace (solo lectura)
CREATE TABLE IF NOT EXISTS household_share_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  share_plan BOOLEAN NOT NULL DEFAULT true,
  share_list BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_household_share_tokens_household ON household_share_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_household_share_tokens_expires ON household_share_tokens(expires_at);

ALTER TABLE household_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_share_tokens_insert" ON household_share_tokens FOR INSERT
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "household_share_tokens_select" ON household_share_tokens FOR SELECT
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "household_share_tokens_delete" ON household_share_tokens FOR DELETE
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- La lectura pública del contenido se hace desde la API con service role usando el token.
