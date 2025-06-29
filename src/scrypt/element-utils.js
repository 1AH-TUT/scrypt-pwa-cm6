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
        meta.push({id, type: el.type, field:"text", idx:i});
      });
  }
  return { lines, meta };
}

export function toLinesAndMap(json) {
  const lines   = [];
  const lineMap = [];          // [{id, field}]  -> keep for reverse lookup

  const blank = () => { lines.push(""); lineMap.push(null); }
  const newPage = () => { lines.push(""); lineMap.push({"type": "page_break"}); }
  const capitalizeFirst = (str) => { if (!str) return str; return str.charAt(0).toUpperCase() + str.slice(1); }

  // Add script meta
  blank();
  ['title', 'byline', 'source', 'copyright', 'contact', 'date'].forEach(key => {
    if (key in json["titlePage"]) {
      json["titlePage"][key].split(/\r?\n/).forEach((t,i)=>{
        lines.push(t);
        const data = { id:`tp_${key}`, type:key, field:'text', idx:i }
        if (i===0) data['label'] = `${capitalizeFirst(key)}:`;
        lineMap.push(data);
      });
      blank();
    }
  });
  newPage();

  json.data.scenes.forEach((sc, sceneIdx) => {
    sc.elements.forEach((el, elIdx) => {
      const { lines: elLines, meta: elLineMap } = explodeElement(el)
      elLineMap[0]['sceneNo'] = sceneIdx
      elLineMap[0]['elementNo'] = elIdx
      lines.push(...elLines);
      lineMap.push(...elLineMap)

      // blank line between blocks
      blank();
    });
  });

  return { lines, lineMap };
}
