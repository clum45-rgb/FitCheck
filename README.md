# FitCheck
DubHacks'26 project

npm workspace with two apps:

- `apps/extension` — Chrome extension
- `apps/desktop` — desktop app

```bash
npm install
npm run dev:extension
npm run dev:desktop
```

Load the extension from `apps/extension/dist` on `chrome://extensions`. `npm run dev:extension` rebuilds that folder as you edit; reload the extension card after each rebuild. `npm run build` typechecks and builds both apps.

## Onboarding web app

Create `apps/desktop/.env.local` from `apps/desktop/.env.example` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the shared Supabase project. These values are browser-facing; never put a service-role key or other privileged secret in this app. The root `.gitignore` excludes `.env` files.

Run the web app with `npm run dev:desktop`. Authentication, profile rows, style profiles, photo metadata, and the private `style-photos` bucket use the existing Supabase project and its user-scoped policies.

Photo analysis is currently a clearly labeled development mock. Before replacing it, agree with the pipeline teammate on the invocation mechanism, request/response shape, synchronous or asynchronous status behavior, retry semantics, and how confirmed profiles trigger vectorization. The frontend does not call an LLM provider directly.

Run onboarding unit tests with `npm test -w @fitcheck/desktop`. These tests use local fixtures and fake persistence repositories; they do not connect to Supabase. Live Auth, RLS, Storage, and cross-user isolation still require manual integration verification against the configured project.
