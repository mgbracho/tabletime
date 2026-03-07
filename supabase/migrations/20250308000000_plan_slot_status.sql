-- Slot status: recipe (default) | leftovers | skip | eating_out
-- When status is not 'recipe', recipe_id may be NULL (no grocery items).

ALTER TABLE plan_slots
  ADD COLUMN IF NOT EXISTS slot_status TEXT NOT NULL DEFAULT 'recipe'
  CHECK (slot_status IN ('recipe', 'leftovers', 'skip', 'eating_out'));

ALTER TABLE plan_slots
  ALTER COLUMN recipe_id DROP NOT NULL;

COMMENT ON COLUMN plan_slots.slot_status IS 'recipe = normal slot with recipe_id; leftovers/skip/eating_out = no recipe, excluded from grocery list';
