import "./components/app-sidebar.js";
import { Scrypt } from './scrypt/scrypt.js';
import { setCurrentScrypt } from './state/current-scrypt.js';
import { mountPage } from './router.js';
import {setCurrentScriptId} from "./state/state.js";

/* one-time guard for dev server */
if (!window.__scryptPwaBooted) {
    window.__scryptPwaBooted = true;

    // console.log("👂 Attaching nav listener");

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
      mountPage(view);               // router handles any valid view
    });

    /* initial splash */
    mountPage("splash");
}