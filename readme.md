# Scrypt CM6 PWA Playground

A minimal, no-build, offline-first Progressive Web App for experimenting with CodeMirror 6 as a screenplay/script editor.

## Quick Start
(assumes `npm` & `npx`)

### 1. Clone the repository

```sh
git clone <repo-url>
cd <repo-name>
````

### 2. Run a Static HTTP Server

Any static server will do. `python -m http.server 8080`, `npx http-server . -p 8080` etc.

Recommended: use JSPM serve for a better DX (hot reload, HTTPS, correct MIME, CORS etc.)
1. [Install JSPM CLI if needed](https://jspm.org/docs/getting-started):

   ```sh
   npm npm install --save-dev jspm
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

* All third-party JS libraries (e.g., CodeMirror 6) are loaded via ESM CDN and managed via `importmap.js`.
* **`importmap.js` is the canonical dependency manifest and is checked into version control.**

### To add or update dependencies

1. [Install JSPM CLI if needed](https://jspm.org/docs/getting-started):

   ```sh
   npm npm install --save-dev jspm
   ```
2. Use JSPM to add or upgrade a package. Example:

   ```sh
   npx jspm install @codemirror/commands@latest
   ```
3. This updates `importmap.js`.
   **Commit the new `importmap.js` to git.**
4. Done! All collaborators will use exactly the same dependencies, fully pinned and CDN-resolved.

---

## Troubleshooting

* **Service Worker:**
  If you change static files and don’t see updates, do a hard reload or unregister the service worker in browser dev tools.

* **Offline mode:**
  If you want to force a cache update, bump the `CACHE` string in `sw.js` and reload.

---

## Project Layout

```text
index.html           # App shell, loads importmap.js and src/main.js
importmap.js         # JSPM-generated import map, tracks all JS dependencies (commit this!)
sw.js                # Service worker for offline/PWA
manifest.webmanifest # PWA manifest/icons
src/
  main.js            # App entrypoint
  sample-script.js   # Example data for demo
icons/               # App icons (PWA)
```

---

## Contributing

* Please update `importmap.js` using JSPM for any dependency changes.
* Keep it minimal and no-build.

---

## Credits

* Built with [CodeMirror 6](https://codemirror.net/6/) and JSPM.

---
