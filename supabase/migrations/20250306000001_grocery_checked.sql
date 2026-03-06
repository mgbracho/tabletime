-- Estado de items marcados en la lista (plan + manual)
CREATE TABLE IF NOT EXISTS grocery_checked (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_grocery_checked_household ON grocery_checked(household_id);

ALTER TABLE grocery_checked ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grocery_checked_all" ON grocery_checked FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
