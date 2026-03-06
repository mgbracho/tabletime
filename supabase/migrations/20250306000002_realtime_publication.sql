-- Habilitar Realtime para sincronización entre dispositivos del hogar.
-- Si da error "already in publication", las tablas ya están; puedes ignorarlo.
ALTER PUBLICATION supabase_realtime ADD TABLE grocery_checked;
ALTER PUBLICATION supabase_realtime ADD TABLE grocery_items;
ALTER PUBLICATION supabase_realtime ADD TABLE recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE plan_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE theme_days;
