-- TableTime: esquema inicial para planificación familiar
-- Ejecutar en Supabase SQL Editor o via CLI

-- Households (hogares familiares)
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Mi hogar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Miembros del hogar (vincula auth.users con households)
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- Recetas (por hogar) - id TEXT para compatibilidad con localStorage
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  ingredients TEXT,
  instructions TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slots del plan semanal (YYYY-MM-DD-Comida)
CREATE TABLE IF NOT EXISTS plan_slots (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  slot_key TEXT NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, slot_key)
);

-- Items de la lista de la compra - id TEXT para UUID o m-xxx
CREATE TABLE IF NOT EXISTS grocery_items (
  id TEXT PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('plan', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Temas por día/comida (0=Lun..6=Dom)
CREATE TABLE IF NOT EXISTS theme_days (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  day_index SMALLINT NOT NULL CHECK (day_index >= 0 AND day_index <= 6),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('Desayuno', 'Comida', 'Cena')),
  theme TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, day_index, meal_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recipes_household ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_plan_slots_household ON plan_slots(household_id);
CREATE INDEX IF NOT EXISTS idx_grocery_items_household ON grocery_items(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);

-- RLS: habilitar y políticas básicas
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_days ENABLE ROW LEVEL SECURITY;

-- Política: usuarios ven/editan solo hogares donde son miembros
CREATE POLICY "households_select" ON households FOR SELECT
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "households_insert" ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "households_update" ON households FOR UPDATE
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "household_members_select" ON household_members FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "household_members_insert" ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "household_members_update" ON household_members FOR UPDATE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "household_members_delete" ON household_members FOR DELETE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "recipes_all" ON recipes FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "plan_slots_all" ON plan_slots FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "grocery_items_all" ON grocery_items FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "theme_days_all" ON theme_days FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
