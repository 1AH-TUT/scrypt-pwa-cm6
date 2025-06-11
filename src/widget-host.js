// src/widget-host.js
export function ensureWidgetHost() {
  let host = document.getElementById('widget-host');
  if (!host) {
    host = Object.assign(document.createElement('div'), { id:'widget-host' });
    host.style = 'position:fixed; inset:0; display:none; place-items:center;';
    document.body.appendChild(host);
  }
  return host;
}
