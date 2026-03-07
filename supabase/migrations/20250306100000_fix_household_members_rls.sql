-- Fix: evita recursión infinita en RLS de household_members.
-- Las políticas anteriores hacían SELECT en household_members para decidir acceso,
-- lo que provocaba recursión. Ahora se usa solo user_id = auth.uid().

DROP POLICY IF EXISTS "household_members_select" ON household_members;
DROP POLICY IF EXISTS "household_members_update" ON household_members;
DROP POLICY IF EXISTS "household_members_delete" ON household_members;

CREATE POLICY "household_members_select" ON household_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "household_members_update" ON household_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "household_members_delete" ON household_members FOR DELETE
  USING (user_id = auth.uid());

-- INSERT se mantiene: WITH CHECK (user_id = auth.uid()) ya no referencia la tabla.
