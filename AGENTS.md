# Agent notes

Plain **Vite + React** single-page app, deployed as a static build on Vercel.

- `npm run dev` — local dev server
- `npm run build` — static bundle to `dist/`
- `npm run typecheck` / `npm run lint`

Routing is React Router (`src/App.tsx`); pages live in `src/pages/`.
The backend is Supabase (project `bevfeigrtnvmnddfjjti`), reached only from the
browser via `src/integrations/supabase/client.ts`. There is no server runtime:
every data access goes through Supabase with RLS enforcing per-user isolation.

`src/integrations/supabase/types.ts` is generated from the database schema —
regenerate it rather than hand-editing when the schema changes.
