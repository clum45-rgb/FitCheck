# Fitspo
DubHacks'26 — save a personal style profile, then match pieces while you shop.

npm workspace with two apps plus a Next.js API:

- `apps/desktop` — web app for sign-in, inspiration photos, and the style profile
- `apps/extension` — Chrome side panel to scan a store, rank matches, and save a cart
- `server` — Shopify scan, tagging, embeddings, match ranking, and cart APIs

```bash
npm install
npm run dev:desktop
npm run dev:extension
```

In a separate terminal:

```bash
cd server
npm install
npm run dev
```

The desktop app is at `http://localhost:5173` (Vite may pick `5174` if that port is taken). The API is at `http://localhost:3000`.

Load the extension from `apps/extension/dist` on `chrome://extensions`. `npm run dev:extension` rebuilds that folder as you edit; reload the extension card after each rebuild. `npm run build` typechecks and builds both workspace apps.

## Environment

Create `apps/desktop/.env.local` with the shared project's browser-facing keys:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The extension reads the same file. Never put a service-role key or other privileged secret in either Vite app. The root `.gitignore` excludes `.env` files.

Photo analysis and the scan/match server need privileged keys. Put these in the **root** `.env` (copy from `.env.example`) and in `server/.env.local` (copy from `server/.env.example`):

```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Restart the desktop and Next servers after changing env files.

## Data and matching

Authentication, profile rows, style profiles, photo metadata, and the private `style-photos` bucket use the existing Supabase project and its user-scoped policies. Up to 9 inspiration photos can be saved per user.

The desktop app analyzes those photos through `/api/analyze-style` on the Vite server. It does not call an LLM provider from the browser. After a profile is saved, the desktop app asks `POST http://localhost:3000/api/profile-embedding` to store a match vector.

The extension scans the current store tab, then ranks products against that vector. A cosine similarity of 60 is a good match; 75 is a great match. Run `supabase/embeddings.sql` in the Supabase SQL editor so `scanned_products` and `style_profiles` have `embedding` columns, then restart the Next server.

## Tests

```bash
npm test -w @fitcheck/desktop
```

These tests use local fixtures and fake persistence; they do not connect to Supabase. Live Auth, RLS, Storage, and cross-user isolation still require manual checks against the configured project.
