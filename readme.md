# Scrypt CM6 PWA Playground

A minimal, no-build, offline-first Progressive Web App using CodeMirror 6 as a screenplay/script editor.

## Quick Start
(assumes `npm` & `npx`)

### 1. Clone the repository

```sh
git clone https://github.com/1AH-TUT/scrypt-pwa-cm6.git
cd scrypt-pwa-cm6
````

### 2. Run a Static HTTP Server

Any static server will do. `python -m http.server 8080`, `npx http-server . -p 8080` etc.

Recommended: use JSPM serve for a better DX (hot reload, HTTPS, correct MIME, CORS etc.)
1. [Install JSPM CLI if needed](https://jspm.org/docs/getting-started):

   ```sh
   npm install --save-dev jspm
   ```
2. Serve local 
    ```sh
    npx jspm serve
    ```

### 3. Open in Chrome browser
To avoid local CORS/MIME issues, use Chrome (local development is currently smoother than Firefox/Safari/Edge).

The app is installable & will work offline after the first load.

---

## Dependency Management

This project uses **JSPM import maps** for all JavaScript dependencies:

* All third-party JS libraries are loaded via ESM CDN and managed via `importmap.js`.
* `importmap.js` is the canonical dependency manifest and is checked into version control.

### To add or update dependencies

1. [Install JSPM CLI if needed](https://jspm.org/docs/getting-started):

   ```sh
   npm install --save-dev jspm
   ```
   
2. If the importing file is not pulled in by an existing path, add the new root to  `exports` field in `package.json` to ensure inclusion in the generated `importmap.js`.
  e.g.
    ```json
    {
      "exports": {
        ".": "./src/main.js",
        "./app-sidebar": "./src/components/app-sidebar.js",
      }
    }
    ```

3. Use JSPM to add or upgrade a package:

   ```sh
   npx jspm install @codemirror/commands@latest
   ```
   
4. Or to regenerate `importmap.js`
  
    ```sh
    npx jspm install
    ```

4. Commit the new `importmap.js` to git.

---

## Troubleshooting

* **Service Worker:**
  If you change static files and don’t see updates, do a hard reload or unregister the service worker in browser dev tools.

* **Offline mode:**
  If you want to force a cache update, bump the `CACHE` string in `sw.js` and reload.

---

## Project Layout

```text
index.html              # App shell: loads importmap.js, theme.css, registers SW, and src/main.js
importmap.js            # JSPM-generated import map; canonical lockfile for all JS dependencies
manifest.webmanifest    # PWA manifest (icons, name, colors, display)
package.json            # Project metadata, JSPM “exports” roots, devDependencies
readme.md               # This overview, Quick Start, Dependency Management, Project Layout, etc.
sw.js                   # Service worker: offline-first app shell & JSPM CDN caching

assets/
  fonts/                # Courier Prime font family (TTF, WOFF2)
  icons/                # PWA and browser icons

dev/
  data/                 # Sample/demo scripts in JSON format
  python/               # Utility scripts for export/dump (not required to run app)

styles/
  theme.css             # Global design tokens & layout CSS

src/
  main.js               # App bootstrap: registers nav/listeners, handles event routing, initial page mount
  router.js             # Static router: mounts page modules into #page-slot
  components/
    app-sidebar.js      # <app-sidebar> Lit component for sidebar navigation
  controllers/
    editor-controller.js# Editor page controller: manages line meta and selection
  data-layer/
    db.js               # IndexedDB access: load/save/delete scrypts
    schema_v0.1.json    # JSON Schema for script validation
    validator.js        # Ajv-powered JSON validator, loads schema at runtime
  pages/
    editor.js           # Editor page: loads current script, creates controller, CM6 view
    workspace.js          # Workspace page: browse/import/delete scripts
    splash.js           # Splash page: PWA welcome/loading screen
    index.js            # Page export barrel (optional, for router)
  scrypt/
    scrypt.js           # Scrypt class: canonical screenplay object, autosave logic
  state/
    current-scrypt.js   # Holds current in-memory Scrypt object
    state.js            # Script ID/session tracking for current/last script
  views/
    editor-view.js      # CodeMirror 6 setup: layout, highlighting, navigation, selection
    editor-view-element-utils.js    # Helpers to explode elements into lines + meta for CM6
```

---

## Contributing

* Update `importmap.js` using JSPM for any dependency changes.
* Keep it lean, minimal and no-build.

---

## Credits

* Built with [CodeMirror 6](https://codemirror.net/6/), [Lit](https://lit.dev/) and [JSPM](jspm.org).
* Uses the [Courier Prime](https://quoteunquoteapps.com/courierprime/) font by Quote-Unquote Apps.

---
