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
    "scrypt-cm6/app-sidebar": "./src/components/app-sidebar.js"
  },
  "scopes": {
    "./": {
      "@codemirror/state": "https://ga.jspm.io/npm:@codemirror/state@6.5.2/dist/index.js",
      "@codemirror/view": "https://ga.jspm.io/npm:@codemirror/view@6.37.1/dist/index.js",
      "ajv": "https://ga.jspm.io/npm:ajv@8.17.1/dist/dev.ajv.js",
      "ajv-formats": "https://ga.jspm.io/npm:ajv-formats@3.0.1/dist/index.js",
      "idb": "https://ga.jspm.io/npm:idb@8.0.3/build/index.js",
      "lit": "https://ga.jspm.io/npm:lit@3.3.0/index.js",
      "lit/directives/if-defined.js": "https://ga.jspm.io/npm:lit@3.3.0/directives/if-defined.js"
    },
    "https://ga.jspm.io/npm:@codemirror/state@6.5.2/": {
      "@marijn/find-cluster-break": "https://ga.jspm.io/npm:@marijn/find-cluster-break@1.0.2/src/index.js"
    },
    "https://ga.jspm.io/npm:@codemirror/view@6.37.1/": {
      "@codemirror/state": "https://ga.jspm.io/npm:@codemirror/state@6.5.2/dist/index.js",
      "crelt": "https://ga.jspm.io/npm:crelt@1.0.6/index.js",
      "style-mod": "https://ga.jspm.io/npm:style-mod@4.1.2/src/style-mod.js",
      "w3c-keyname": "https://ga.jspm.io/npm:w3c-keyname@2.2.8/index.js"
    },
    "https://ga.jspm.io/npm:ajv-formats@3.0.1/": {
      "ajv": "https://ga.jspm.io/npm:ajv@8.17.1/dist/dev.ajv.js",
      "ajv/dist/compile/codegen": "https://ga.jspm.io/npm:ajv@8.17.1/dist/compile/codegen/index.js"
    },
    "https://ga.jspm.io/npm:ajv@8.17.1/": {
      "fast-deep-equal": "https://ga.jspm.io/npm:fast-deep-equal@3.1.3/index.js",
      "fast-uri": "https://ga.jspm.io/npm:fast-uri@3.0.6/index.js",
      "json-schema-traverse": "https://ga.jspm.io/npm:json-schema-traverse@1.0.0/index.js"
    },
    "https://ga.jspm.io/npm:lit-element@4.2.0/": {
      "@lit/reactive-element": "https://ga.jspm.io/npm:@lit/reactive-element@2.1.0/development/reactive-element.js",
      "lit-html": "https://ga.jspm.io/npm:lit-html@3.3.0/development/lit-html.js"
    },
    "https://ga.jspm.io/npm:lit@3.3.0/": {
      "@lit/reactive-element": "https://ga.jspm.io/npm:@lit/reactive-element@2.1.0/development/reactive-element.js",
      "lit-element/lit-element.js": "https://ga.jspm.io/npm:lit-element@4.2.0/development/lit-element.js",
      "lit-html": "https://ga.jspm.io/npm:lit-html@3.3.0/development/lit-html.js",
      "lit-html/directives/if-defined.js": "https://ga.jspm.io/npm:lit-html@3.3.0/development/directives/if-defined.js",
      "lit-html/is-server.js": "https://ga.jspm.io/npm:lit-html@3.3.0/development/is-server.js"
    }
  }
});
