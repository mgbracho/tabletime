# Guía paso a paso: Configurar Supabase para TableTime

Esta guía te lleva de la mano para crear tu cuenta en Supabase y dejar TableTime listo para usar.

---

## Paso 1: Crear cuenta en Supabase

1. Abre tu navegador y ve a: **https://supabase.com**
2. Haz clic en **"Start your project"** (o "Iniciar proyecto")
3. Elige **"Sign in with GitHub"** (recomendado) o **"Sign in with Google"**
4. Autoriza el acceso si te lo pide
5. Ya tienes cuenta en Supabase

---

## Paso 2: Crear un proyecto nuevo

1. Una vez dentro, haz clic en **"New Project"** (Nuevo proyecto)
2. Rellena:
   - **Name:** `tabletime` (o el nombre que quieras)
   - **Database Password:** inventa una contraseña segura y **guárdala** (la necesitarás si accedes a la base de datos directamente)
   - **Region:** elige la más cercana (ej. `West EU` si estás en España)
3. Haz clic en **"Create new project"**
4. Espera 1-2 minutos mientras Supabase crea todo

---

## Paso 3: Obtener las credenciales (URL y clave)

1. En el menú izquierdo, haz clic en el icono de **engranaje** (Settings / Configuración)
2. Haz clic en **"API"** en el submenú
3. Verás dos cosas importantes:

   **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - Haz clic en el icono de **copiar** al lado para copiarla

   **Project API keys** → sección **"anon" "public"**
   - Copia la clave que dice **"anon"** o **"public"** (es larga, empieza por `eyJ...`)

4. Guárdalas en un bloc de notas temporal; las usarás en el siguiente paso

---

## Paso 4: Crear el archivo de configuración en tu proyecto

1. Abre la carpeta del proyecto TableTime en tu ordenador:
   ```
   c:\Users\mildr\OneDrive\MealPlan\MPCursor\tabletime
   ```

2. Busca si existe un archivo llamado **`.env.local`**
   - Si **no existe**, crea un archivo nuevo con ese nombre exacto
   - Si **existe**, ábrelo con el Bloc de notas

3. Escribe o pega esto (sustituyendo con tus datos reales):

   ```
   NEXT_PUBLIC_SUPABASE_URL=pega_aquí_tu_Project_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=pega_aquí_tu_clave_anon
   ```

   Ejemplo (con datos inventados):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xyzabc123.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
   ```

4. **Importante:** No dejes espacios antes ni después del `=`
5. Guarda el archivo

---

## Paso 5: Ejecutar el SQL (crear las tablas)

1. En Supabase, en el menú izquierdo, haz clic en **"SQL Editor"** (icono que parece `</>`)
2. Haz clic en **"New query"** (Nueva consulta)

3. **Primera migración:**
   - Abre el archivo `supabase/migrations/20250306000000_initial_schema.sql` de tu proyecto con el Bloc de notas
   - Copia **todo** el contenido (Ctrl+A, Ctrl+C)
   - Pégalo en el editor SQL de Supabase
   - Haz clic en **"Run"** (o Ctrl+Enter)
   - Debe aparecer **"Success"** en verde

4. **Segunda migración:**
   - Borra el contenido del editor (o haz "New query")
   - Abre `supabase/migrations/20250306000001_grocery_checked.sql`
   - Copia todo, pega en Supabase, haz clic en **"Run"**
   - Debe aparecer **"Success"**

5. **Tercera migración:**
   - Borra el contenido (o "New query")
   - Abre `supabase/migrations/20250306000002_realtime_publication.sql`
   - Copia todo, pega en Supabase, haz clic en **"Run"**
   - Si aparece **"Success"**, perfecto
   - Si aparece un error tipo **"already in publication"**, no pasa nada: significa que ya estaba. Puedes ignorarlo.

---

## Paso 6: (Opcional) Desactivar confirmación de email

Para probar más rápido sin tener que confirmar el email:

1. En Supabase, menú izquierdo → **Authentication** → **Providers**
2. Haz clic en **"Email"**
3. Desactiva **"Confirm email"**
4. Haz clic en **"Save"**

---

## Paso 7: Probar que funciona

1. Abre una terminal en la carpeta del proyecto
2. Ejecuta: `npm run dev`
3. Abre el navegador en: **http://localhost:3000**
4. Haz clic en **"Entrar"** (arriba a la derecha)
5. Regístrate con un email y contraseña
6. Si entras sin errores, **todo está bien configurado**

---

## Resumen de archivos que necesitas

| Archivo | Dónde está |
|---------|------------|
| `.env.local` | En la raíz del proyecto `tabletime` (tú lo creas) |
| `20250306000000_initial_schema.sql` | `tabletime/supabase/migrations/` |
| `20250306000001_grocery_checked.sql` | `tabletime/supabase/migrations/` |
| `20250306000002_realtime_publication.sql` | `tabletime/supabase/migrations/` |

---

## ¿Algo falla?

- **"Invalid API key"**: Revisa que copiaste bien la URL y la clave en `.env.local`, sin espacios extra
- **"relation does not exist"**: Falta ejecutar alguna migración SQL; vuelve al Paso 5
- **No me deja registrarme**: Si activaste "Confirm email", revisa la carpeta de spam o desactívalo (Paso 6)

---

## App en Vercel (producción): configurar URLs en Supabase

Para que el login y el guardado de datos funcionen en la URL de Vercel:

1. En Supabase, menú izquierdo → **Authentication** → **URL Configuration** (o **Configuration** → **URL Configuration**).
2. En **Site URL** pon la URL de tu app en Vercel, por ejemplo:
   ```
   https://tabletime-ten.vercel.app
   ```
   (sustituye por tu URL real si es distinta).
3. En **Redirect URLs** añade la misma URL:
   ```
   https://tabletime-ten.vercel.app/**
   ```
   o solo `https://tabletime-ten.vercel.app` si no permite el `**`.
4. Guarda los cambios.

Así Supabase reconoce tu dominio y las cookies de sesión funcionan en producción.
