-- Añadir URL de imagen a recetas
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url TEXT;
