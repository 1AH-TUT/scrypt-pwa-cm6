import {
  SCRYPT_LINES_PER_PAGE,
  TOP_MARGIN_LINES,
  BOTTOM_MARGIN_LINES,
  MAX_CHARS_PER_LINE,
  MAX_CHARS_PER_DIALOGUE_LINE
} from '../scrypt/default-options.js'


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
  const lineMap = [];
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

  // Rest of Scrypt
  let pageLines = 0;

  const COLS = Object.freeze({
    scene_heading : MAX_CHARS_PER_LINE,
    action        : MAX_CHARS_PER_LINE,
    transition    : MAX_CHARS_PER_LINE,
    character     : MAX_CHARS_PER_DIALOGUE_LINE,
    parenthetical : MAX_CHARS_PER_DIALOGUE_LINE,
    dialogue      : MAX_CHARS_PER_DIALOGUE_LINE
  });
  const BREAKS = [" ", "-", "–", "—"];

  function wrappedRowsFast(str, max) {

    function rightmostBreak(str, from, to) {
      let best = -1;
      for (const ch of BREAKS) {
        const idx = str.lastIndexOf(ch, to);
        if (idx >= from && idx > best) best = idx;
      }
      return best; // −1 = no breakable char
    }

    if (str.length <= max) return 1;

    let rows = 0, cursor = 0;
    const len = str.length;

    while (cursor < len) {
      const hardEnd = Math.min(cursor + max, len - 1);

      if (hardEnd === len - 1) { rows++; break; }  // last chunk fits exactly

      const br = rightmostBreak(str, cursor, hardEnd);
      if (br >= cursor) {             // found a soft break inside window
        rows++;
        cursor = br + 1;              // skip the break glyph itself
      } else {                        // single long word
        rows++;
        cursor = hardEnd + 1;         // hard-wrap after max cols
      }
    }
    return rows;
  }

  function splitLine(str, rowsLeft, maxCols) {
    if (rowsLeft <= 0) return ["", str];      // nothing fits

    let cursor = 0, rows = 0, lastBreak = -1;

    while (cursor < str.length && rows < rowsLeft) {
      const hardEnd = Math.min(cursor + maxCols, str.length);

      // look for the right-most break char within the window
      let br = -1;
      for (const ch of BREAKS) {
        const idx = str.lastIndexOf(ch, hardEnd);
        if (idx >= cursor && idx > br) br = idx;
      }

      // if no word break found or long word itself is too tall, hard-wrap
      cursor = (br >= cursor) ? br + 1 : hardEnd;
      rows++;
    }

    // cursor now sits **after** the last char we can keep
    return [str.slice(0, cursor).trimEnd(), str.slice(cursor).trimStart()];
  }


  const estimateLines = (elLines, elLineMap) => {
    let total = 0;

    for (let i = 0; i < elLines.length; i++) {
      const meta = elLineMap[i];                 // { type, field, … }
      let   key  = meta.type;                    // default: action, scene_heading …

      /* Dialogue block gets special widths */
      if (meta.type === "dialogue") {
        key = meta.field === "character"     ? "character"
            : meta.field === "parenthetical" ? "parenthetical"
            : "dialogue";
      }

      const cols = COLS[key] ?? MAX_CHARS_PER_LINE;
      const wrapped = wrappedRowsFast(elLines[i], cols);

      total += wrapped;
      elLineMap[i]['rows'] = wrapped;
    }

    return total;
  }

  /* this function is a WIP - todo: handle splitting elements dialogue/action across pages (and handle when > 1 page) */
  const addAndMaybeBreak = (elLines, elLineMap) => {
    let extra = estimateLines(elLines, elLineMap);

    // Hack - No way to handle elements > 1 page yet, this at least renders them on screen...
    // todo handle split dialogue/action elements
    if (extra > SCRYPT_LINES_PER_PAGE) extra = SCRYPT_LINES_PER_PAGE;

    // Will it fit on this page?
    let elLinesAlreadyPushed = 0;
    if (pageLines + extra > SCRYPT_LINES_PER_PAGE) {
      // if not, fill out the previous page to the footer
      const remainder = SCRYPT_LINES_PER_PAGE - pageLines;
      if (remainder > 0) {
        const elType = elLineMap[0].type;
        if (elType === 'action') {
          // walk the lines adding any that fit on the page
          let rowsLeft = remainder;
          // let i = 0;
          // while (i < elLines.length && rowsLeft >= elLineMap[i].rows) {
          //   const actualLines = elLineMap[i].rows;
          //   if (pageLines + actualLines <= SCRYPT_LINES_PER_PAGE) {
          //     // this line fits
          //     lines.push(elLines[i]);
          //     lineMap.push(elLineMap[i]);
          //     elLinesAlreadyPushed += 1;
          //     pageLines += actualLines;
          //     rowsLeft -= actualLines;
          //     i++;
          //   }
          // }

          let i = 0;
          while (i < elLines.length && rowsLeft > 0) {
            const meta  = elLineMap[i];
            const rows  = meta.rows;
            if (rows <= rowsLeft) {
              /* whole logical line fits */
              lines.push(elLines[i]);
              lineMap.push(meta);
              elLinesAlreadyPushed++;
              pageLines += rows;
              rowsLeft  -= rows;
              i++;
            } else {
              /* split this logical line */
              const maxCols = COLS.action;
              const [head, tail] = splitLine(elLines[i], rowsLeft, maxCols);

              // push head fragment to current page
              lines.push(head);
              lineMap.push({ ...meta });          // shallow copy is fine
              pageLines += rowsLeft;
              // elLinesAlreadyPushed++;           // we consumed one logical line
              // mutate the original arrays so tail replaces current index
              elLines[i] = tail;
              elLineMap[i].rows = rows - rowsLeft;   // tail rows
              rowsLeft = 0;                          // page full
            }
          }

          if (SCRYPT_LINES_PER_PAGE - pageLines > 0) blank(SCRYPT_LINES_PER_PAGE - pageLines)
        } else {
          blank(remainder);
        }
      }

      // then start a new one
      pageLines = 0;
      newPage(++page_no);
    }

    // add the element (or remainder of)
    if (elLinesAlreadyPushed > 0) {
      const elLinesTail = elLines.slice(elLinesAlreadyPushed)
      const elLineMapTail = elLineMap.slice(elLinesAlreadyPushed)
      lines.push(...elLinesTail);
      lineMap.push(...elLineMapTail);
      pageLines += elLineMapTail.reduce((sum, m) => sum + (m.rows ?? 0), 0);
    } else {
      lines.push(...elLines);
      lineMap.push(...elLineMap);
      pageLines += extra;
    }
    // blank line spacer after the block (if it still fits on this page)
    if (pageLines + 1 <= SCRYPT_LINES_PER_PAGE) {
      blank();
      pageLines += 1;
    }
  }

  json.data.scenes.forEach((sc, sceneIdx) => {
    sc.elements.forEach((el, elIdx) => {
      const { lines: elLines, meta: elLineMap } = explodeElement(el)
      elLineMap[0]['sceneNo'] = sceneIdx
      elLineMap[0]['elementNo'] = elIdx
      addAndMaybeBreak(elLines, elLineMap);
    });
  });

  // ensure last line is a blank (it may have been skipped at the end of a page) - needed to ensure proper layout of insert bar at bottom
  // add one if not / start a new page if required
  const lastMeta = lineMap[lineMap.length - 1];

  if (lastMeta !== null) {
    if (pageLines < SCRYPT_LINES_PER_PAGE) {
      blank();
      pageLines += 1;
    } else {
      newPage(++page_no);
      pageLines = 0;
    }
  }
  return { lines, lineMap };
}
