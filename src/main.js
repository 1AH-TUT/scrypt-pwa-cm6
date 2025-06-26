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

    /* debug dump cache version & add to top-bar */
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', evt => {
      if (evt.data?.type !== 'CACHE_VERSION') return;

      const ver = evt.data.value;
      console.log('SW cache version:', ver);

      const bar  = document.getElementById('top-bar');
      if (!bar) return;

      let tag = bar.querySelector('.cache-version');
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'cache-version';
        tag.style.marginLeft = 'auto';
        tag.style.opacity    = '0.7';
        bar.appendChild(tag);
      }
      tag.textContent = `SW cache: ${ver}`;
    });

    function askForCacheVersion(reg) {
      if (reg?.active) {
        reg.active.postMessage('GET_CACHE_VERSION');
      }
      else if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('GET_CACHE_VERSION');
      }
    }

    navigator.serviceWorker.ready.then(reg => askForCacheVersion(reg));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      navigator.serviceWorker.ready.then(reg => askForCacheVersion(reg));
    });
  }

}