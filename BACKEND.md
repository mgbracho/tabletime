# Backend TableTime (Supabase)

## Stack

- **Supabase**: PostgreSQL + Auth + Realtime
- **Next.js 16**: API routes, Server Components

## Configuración

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto.
2. En **Settings → API**, copia:
   - Project URL
   - anon/public key

### 2. Variables de entorno

Copia `.env.local.example` a `.env.local`:

```bash
cp .env.local.example .env.local
```

Rellena:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Ejecutar migraciones

En el **SQL Editor** de Supabase, ejecuta en orden:

1. `supabase/migrations/20250306000000_initial_schema.sql`
2. `supabase/migrations/20250306000001_grocery_checked.sql`
3. `supabase/migrations/20250306000002_realtime_publication.sql` (para lista en tiempo real)
4. `supabase/migrations/20250306100000_fix_household_members_rls.sql`
5. `supabase/migrations/20250306200000_recipes_default_servings.sql`
6. `supabase/migrations/20250307000000_household_profiles.sql` (perfiles: nombre y porciones por miembro)
7. `supabase/migrations/20250307100000_dietary_restrictions.sql` (restricciones dietéticas por miembro)
8. `supabase/migrations/20250307200000_household_invites.sql` (invitar por enlace)
9. `supabase/migrations/20250307300000_household_share_tokens.sql` (compartir plan/lista por enlace, solo lectura)

### 4. Auth redirect (opcional)

Si usas OAuth (Google, etc.), en **Authentication → URL Configuration** añade:

- Site URL: `http://localhost:3000` (o tu dominio)
- Redirect URLs: `http://localhost:3000/auth/callback`

### 5. Desactivar confirmación de email (desarrollo)

En **Authentication → Providers → Email** puedes desactivar "Confirm email" para probar sin verificar el correo.

## Esquema

| Tabla | Descripción |
|-------|-------------|
| `households` | Hogares familiares |
| `household_members` | Usuarios ↔ hogares |
| `recipes` | Recetas por hogar |
| `plan_slots` | Plan semanal (slot_key → recipe_id) |
| `grocery_items` | Lista de la compra |
| `theme_days` | Temas por día/comida |

## Uso desde el frontend

El cliente Supabase se usa directamente con RLS. La **lista de la compra** se sincroniza en tiempo real entre dispositivos del mismo hogar vía Supabase Realtime (`grocery_checked` y `grocery_items`).

```ts
const supabase = createClient();
const { data } = await supabase
  .from("recipes")
  .select("*")
  .eq("household_id", householdId);
```

## API routes

- `POST /api/household/ensure` – Crea hogar + miembro si el usuario no tiene ninguno
- `GET /auth/callback` – Callback OAuth
