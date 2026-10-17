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
