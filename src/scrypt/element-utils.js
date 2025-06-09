export function explodeElement(el) {
  const id = el.id;
  const lines = [], meta = [];

  switch (el.type) {
    case "dialogue":
      lines.push(el.character.toUpperCase());
      meta.push({id, type: "dialogue", field:"character", idx:0});
      if (el.parenthetical) {
        lines.push(`(${el.parenthetical})`);
        meta .push({id, type:"dialogue", field:"parenthetical", idx:0});
      }
      el.text.split(/\r?\n/).forEach((t,i)=>{
        lines.push(t);
        meta .push({id, type:"dialogue", field:"text", idx:i});
      });
      break;
    default:
      el.text.split(/\r?\n/).forEach((t,i)=>{
        lines.push(t);
        meta .push({id, type: el.type, field:"text", idx:i});
      });
  }
  return {lines, meta};
}

export function toPlainText(json) {
  const lines   = [];
  const lineMap = [];          // [{id, field}]  -> keep for reverse lookup

  const blank = () => { lines.push(""); lineMap.push(null); }
  const newPage = () => { lines.push(""); lineMap.push({"type": "page_break"}); }

  // Add script meta
  blank();
  ['title', 'byline', 'source', 'address', 'copyright', 'date'].forEach(k => {
    if (k in json["titlePage"]) {
      lines.push(`${json["titlePage"][k]}`);
      lineMap.push({ "type":`${k}`});
      blank();
    }
  });
  newPage();

  json.scenes.forEach(sc => {
    sc.elements.forEach(el => {
      const { lines: elLines, meta: elLineMap } = explodeElement(el)
      lines.push(...elLines);
      lineMap.push(...elLineMap)

      // blank line between blocks
      blank();
    });
  });

  return {text: lines.join("\n"), lineMap};
}
