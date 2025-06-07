(map => {
  const mapUrl = document.currentScript.src;
  const resolve = imports => Object.fromEntries(Object.entries(imports ).map(([k, v]) => [k, new URL(v, mapUrl).href]));
  document.head.appendChild(Object.assign(document.createElement("script"), {
    type: "importmap",
    innerHTML: JSON.stringify({
      imports: resolve(map.imports),
      scopes: Object.fromEntries(Object.entries(map.scopes).map(([k, v]) => [new URL(k, mapUrl).href, resolve(v)]))
    })
  }));
})
({
  "imports": {
    "scrypt-cm6": "./src/main.js",
    "scrypt-cm6/app-sidebar": "./src/components/app-sidebar.js",
    "scrypt-cm6/editor-setup": "./src/editor-setup.js"
  },
  "scopes": {
    "./": {
      "@codemirror/commands": "https://ga.jspm.io/npm:@codemirror/commands@6.8.1/dist/index.js",
      "@codemirror/state": "https://ga.jspm.io/npm:@codemirror/state@6.5.2/dist/index.js",
      "@codemirror/theme-one-dark": "https://ga.jspm.io/npm:@codemirror/theme-one-dark@6.1.2/dist/index.js",
      "@codemirror/view": "https://ga.jspm.io/npm:@codemirror/view@6.37.1/dist/index.js",
      "lit": "https://ga.jspm.io/npm:lit@3.3.0/index.js"
    },
    "https://ga.jspm.io/npm:@codemirror/commands@6.8.1/": {
      "@codemirror/language": "https://ga.jspm.io/npm:@codemirror/language@6.11.1/dist/index.js",
      "@codemirror/state": "https://ga.jspm.io/npm:@codemirror/state@6.5.2/dist/index.js",
      "@codemirror/view": "https://ga.jspm.io/npm:@codemirror/view@6.37.1/dist/index.js",
      "@lezer/common": "https://ga.jspm.io/npm:@lezer/common@1.2.3/dist/index.js"
    },
    "https://ga.jspm.io/npm:@codemirror/language@6.11.1/": {
      "@codemirror/state": "https://ga.jspm.io/npm:@codemirror/state@6.5.2/dist/index.js",
      "@codemirror/view": "https://ga.jspm.io/npm:@codemirror/view@6.37.1/dist/index.js",
      "@lezer/common": "https://ga.jspm.io/npm:@lezer/common@1.2.3/dist/index.js",
      "@lezer/highlight": "https://ga.jspm.io/npm:@lezer/highlight@1.2.1/dist/index.js",
      "style-mod": "https://ga.jspm.io/npm:style-mod@4.1.2/src/style-mod.js"
    },
    "https://ga.jspm.io/npm:@codemirror/state@6.5.2/": {
      "@marijn/find-cluster-break": "https://ga.jspm.io/npm:@marijn/find-cluster-break@1.0.2/src/index.js"
    },
    "https://ga.jspm.io/npm:@codemirror/theme-one-dark@6.1.2/": {
      "@codemirror/language": "https://ga.jspm.io/npm:@codemirror/language@6.11.1/dist/index.js",
      "@codemirror/view": "https://ga.jspm.io/npm:@codemirror/view@6.37.1/dist/index.js",
      "@lezer/highlight": "https://ga.jspm.io/npm:@lezer/highlight@1.2.1/dist/index.js"
    },
    "https://ga.jspm.io/npm:@codemirror/view@6.37.1/": {
      "@codemirror/state": "https://ga.jspm.io/npm:@codemirror/state@6.5.2/dist/index.js",
      "crelt": "https://ga.jspm.io/npm:crelt@1.0.6/index.js",
      "style-mod": "https://ga.jspm.io/npm:style-mod@4.1.2/src/style-mod.js",
      "w3c-keyname": "https://ga.jspm.io/npm:w3c-keyname@2.2.8/index.js"
    },
    "https://ga.jspm.io/npm:@lezer/highlight@1.2.1/": {
      "@lezer/common": "https://ga.jspm.io/npm:@lezer/common@1.2.3/dist/index.js"
    },
    "https://ga.jspm.io/npm:lit-element@4.2.0/": {
      "@lit/reactive-element": "https://ga.jspm.io/npm:@lit/reactive-element@2.1.0/development/reactive-element.js",
      "lit-html": "https://ga.jspm.io/npm:lit-html@3.3.0/development/lit-html.js"
    },
    "https://ga.jspm.io/npm:lit@3.3.0/": {
      "@lit/reactive-element": "https://ga.jspm.io/npm:@lit/reactive-element@2.1.0/development/reactive-element.js",
      "lit-element/lit-element.js": "https://ga.jspm.io/npm:lit-element@4.2.0/development/lit-element.js",
      "lit-html": "https://ga.jspm.io/npm:lit-html@3.3.0/development/lit-html.js",
      "lit-html/is-server.js": "https://ga.jspm.io/npm:lit-html@3.3.0/development/is-server.js"
    }
  }
});
