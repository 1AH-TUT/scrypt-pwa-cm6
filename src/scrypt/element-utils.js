import { SCRYPT_LINES_PER_PAGE, TOP_MARGIN_LINES, BOTTOM_MARGIN_LINES, MAX_CHARS_PER_LINE } from './default-options.js'


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
  let page_no = 0

  const blank = (n= 1) => {
    lines.push(...Array(n).fill(""));
    lineMap.push(...Array(n).fill(null));
  }
  const newPage = (page_number) => {
    blank(BOTTOM_MARGIN_LINES);
    lines.push("")
    lineMap.push({ "type": "page_break", "page": page_number + '.' });
    blank(TOP_MARGIN_LINES);
  }
  const capitalizeFirst = (str) => { if (!str) return str; return str.charAt(0).toUpperCase() + str.slice(1); }

  // Title Page
  const totalTitlePageLines = SCRYPT_LINES_PER_PAGE + TOP_MARGIN_LINES;
  const pushLine = (key) => {
      lines.push(json["titlePage"][key]);
      lineMap.push({ id:`tp_${key}`, type:key, field:'text', idx:0, label: `${capitalizeFirst(key)}:` });
  }

  for (let line = 0; line < totalTitlePageLines; line++) {
    if (line === 7) {
     pushLine("title");
    } else if (line === 9) {
     pushLine("byline");
    } else if (line === 12) {
     pushLine("source");
    } else if (line === 17) {
     pushLine("copyright");
    } else if (line === 53) {
      const key = "contact";
      const splitValue = json["titlePage"][key].split(/\r?\n/).slice(0,4);
      splitValue.forEach((t,i)=>{
        lines.push(t);
        const data = { id:`tp_${key}`, type:key, field:'text', idx:i }
        if (i===0) data['label'] = `${capitalizeFirst(key)}:`;
        lineMap.push(data);
      });
      line += splitValue.length -1;
    } else if (line === 59) {
     pushLine("date");
    } else {
      blank();
    }
  }
  newPage(++page_no);

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
