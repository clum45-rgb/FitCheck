# FitCheck
DubHacks'26 project

React and TypeScript Chrome extension. The interface is bundled into `dist/`.

```bash
npm install
npm run dev
```

`npm run dev` rebuilds `dist/` as you edit. In Chrome, open `chrome://extensions`, turn on Developer mode, and load the `dist` folder. Reload the extension there after each rebuild. `npm run build` typechecks and writes a production bundle.
