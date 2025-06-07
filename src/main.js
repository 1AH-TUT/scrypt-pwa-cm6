import "./components/app-sidebar.js";
import { mountPage } from "./router.js";

/* one-time guard for dev server */
if (!window.__scryptPwaBooted) {
    window.__scryptPwaBooted = true;

    // console.log("👂 Attaching nav listener");

    document.querySelector("app-sidebar").addEventListener("nav", ev => {
      // console.log("🗺️  nav event:", ev.detail);
      mountPage(ev.detail);
    });

    /* initial splash */
    mountPage("splash");
}