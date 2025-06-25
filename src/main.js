import "./components/app-sidebar.js";
import { Scrypt } from './scrypt/scrypt.js';
import { setCurrentScrypt } from './state/current-scrypt.js';
import { mountPage } from './router.js';
import { getCurrentScriptId, setCurrentScriptId } from "./state/state.js";
import { exportScript } from "./services/export-service.js";


/* one-time guard for dev server */
if (!window.__scryptPwaBooted) {
    window.__scryptPwaBooted = true;

    document.querySelector("app-sidebar").addEventListener("nav", ev => {
      // console.log("Nav event:", ev.detail);
      mountPage(ev.detail);
    });

    window.addEventListener('open-scrypt', async (e) => {
      const { id, view = 'editor' } = e.detail;
      const s = await Scrypt.load(id);
      if (!s) {
        console.error(`Script ${id} failed to load`);
        return;
      }

      setCurrentScriptId(id);
      setCurrentScrypt(s);
      mountPage(view);
    });

    document.addEventListener("export-current", async () => {
      const id = getCurrentScriptId();
      if (id != null) await exportScript({ id, format:"scrypt" });
    });

    /* initial splash */
    mountPage("workspace");

    /* debug dump cache version */
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.type === 'CACHE_VERSION') {
              console.log('Cache version from SW:', event.data.value);
            }
          });

        navigator.serviceWorker.controller.postMessage('GET_CACHE_VERSION');
      }
    });
  }

}