import "./components/app-sidebar.js";
import { mountPage } from "./router.js";

/* one-time guard for dev server */
if (!window.__scryptPwaBooted) {
    window.__scryptPwaBooted = true;

    // console.log("👂 Attaching nav listener");

    document.querySelector("app-sidebar").addEventListener("nav", ev => {
      // console.log("Nav event:", ev.detail);
      mountPage(ev.detail);
    });

    document.body.addEventListener("load-script", ev => {
      console.log("Load Scrypt event:", ev.detail);
      const scriptObj = ev.detail;
      mountPage("editor", scriptObj);
    });

    /* initial splash */
    mountPage("splash");
}