/**********************************************************************
 * element-utils.js  —  View-layer pagination helpers
 *********************************************************************/

import {
  SCRYPT_LINES_PER_PAGE,
  TOP_MARGIN_LINES,
  BOTTOM_MARGIN_LINES,
  MAX_CHARS_PER_LINE,
  MAX_CHARS_PER_DIALOGUE_LINE,
  UIstrings
} from '../scrypt/default-options.js'


/* --- Public constants / lookup tables --- */

  const COLS = Object.freeze({
    scene_heading : MAX_CHARS_PER_LINE,
    action        : MAX_CHARS_PER_LINE,
    transition    : MAX_CHARS_PER_LINE,
    character     : MAX_CHARS_PER_DIALOGUE_LINE,
    parenthetical : MAX_CHARS_PER_DIALOGUE_LINE,
    dialogue      : MAX_CHARS_PER_DIALOGUE_LINE
  });

  const BREAKS = [" ", "-", "–", "—"];


/* --- Element -> line explosion --- */

function explodeElement(el) {
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


/* --- Helpers --- */

function capitalizeFirst(str) { return str ? str[0].toUpperCase() + str.slice(1) : str; }

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

  let cursor = 0, rows = 0;

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

function estimateLines(elLines, elLineMap) {
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

/* --- Dev only Validation --- */

/**
 * Dev-only helper: Validates that each page (except possibly last) has
 * exactly the expected number of lines.
 *
 * @param {Array} lines - The array of rendered lines from toLinesAndMap
 * @param {Array} lineMap - The corresponding metadata array
 * @param {Object} opts - Optionally override margin/page sizes (for tests)
 */
function validatePageStructure(
  lines,
  lineMap,
  {
    TOP = TOP_MARGIN_LINES,
    PER = SCRYPT_LINES_PER_PAGE,
    BOTTOM = BOTTOM_MARGIN_LINES
  } = {}
) {
  let pageStart = 0, pageNo = 0, nPages = 0, issues = 0;
  let expectedTotal = TOP + PER + BOTTOM;

  // Helper to sum up rows
  const sumRows = (start, end) => {
    let sum = 0;
    for (let i = start; i <= end; i++) {
      const meta = lineMap[i];
      // Only count visible/real lines
      if (meta?.type === "page_break") continue;
      sum += typeof meta?.rows === "number" ? meta.rows : 1;
    }
    return sum;
  };

  for (let i = 0; i < lineMap.length; i++) {
    const meta = lineMap[i];
    if (meta && meta.type === "page_break") {
      const pageEnd = i;
      const rowSum = sumRows(pageStart, pageEnd);
      if (nPages > 0 && rowSum !== expectedTotal) {
        console.warn(
          `Page ${pageNo} has ${rowSum} "rows" (expected ${expectedTotal}) [${pageStart}-${pageEnd}]`
        );
        // Optional: Log which lines over/underflowed
        // console.log(lineMap.slice(pageStart, pageEnd+1));
        issues++;
      }
      nPages++;
      pageNo++;
      pageStart = pageEnd + 1;
    }
  }

  console.info(
    `validatePageStructure: Parsed ${nPages} pages, total (logical) lines: ${lines.length}, issues: ${issues ? issues.length : 0 }` +
      (issues ? `, ${issues} page(s) with incorrect line count` : "")
  );
}

/* --- Main pagination engine --- */

/**
  Converts scrypt JSON data into paginated lines and meta for CM6 editor view.
  Handles page breaks, element splitting, and screenwriting formatting.

  @param {object} json - Normalized screenplay structure.

  @returns {{ lines: string[], lineMap: object[] }}
*/
function toLinesAndMap(json) {
  const lines = [];
  const lineMap = [];
  let page_no = 0
  let lastElementType = null;
  let lastDialogueChar = null;

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

  // Title Page
  const totalTitlePageLines = SCRYPT_LINES_PER_PAGE + TOP_MARGIN_LINES;
  const pushLine = (key) => {
    lines.push(json["titlePage"][key]);
    lineMap.push({ id:`tp_${key}`, type:key, field:'text', idx:0, label: `${capitalizeFirst(key)}:` });
  }

  const popLastBlank = () => {
    if (lines.length && lineMap[lines.length - 1] === null) {
      lines.pop();
      lineMap.pop();
      pageLines -= 1;
    }
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

  const addAndMaybeBreak = (elLines, elLineMap) => {
    let extra = estimateLines(elLines, elLineMap);

    // Will it fit on this page?
    let elLinesAlreadyPushed = 0;
    if (pageLines + extra > SCRYPT_LINES_PER_PAGE) {
      // if not, split page wrap-able elements or fill with blanks
      const remainder = SCRYPT_LINES_PER_PAGE - pageLines;
      if (remainder > 0) {
        const elType = elLineMap[0].type;

        if (elType === 'action') {
          // walk the lines adding any that fit on the page [may MUTATE lines & LineMap]
          let rowsLeft = remainder;
          let i = 0;
          while (i < elLines.length && rowsLeft > 0) {
            const meta  = elLineMap[i];
            const rows  = meta.rows;
            if (rows <= rowsLeft) {
              /* whole logical line fits */
              lines.push(elLines[i]);
              const headMeta = { ...meta, rows };
              lineMap.push(headMeta);
              elLinesAlreadyPushed++;
              pageLines += rows;
              rowsLeft  -= rows;
              i++;
            } else {
              // split this logical line
              const maxCols = COLS.action;
              const [head, tail] = splitLine(elLines[i], rowsLeft, maxCols);
              const headRows = wrappedRowsFast(head, COLS.action);

              // push head fragment to current page
              lines.push(head);
              lineMap.push({ ...meta, rows: headRows });
              pageLines += headRows;
              rowsLeft -= headRows;
              // mutate elLines so only tail is carried
              elLines[i] = tail;
              elLineMap[i].rows = rows - headRows;
            }
          }
        } else if (elType === 'dialogue')  {
          // todo handle split dialogue
          blank(remainder);
        } else {
          blank(remainder);
        }
      }

      // then start a new page
      pageLines = 0;
      newPage(++page_no);
    }

    // add the element (or remainder of)
    if (elLinesAlreadyPushed > 0) {
      const elLinesTail = elLines.slice(elLinesAlreadyPushed)
      const elLineMapTail = elLineMap.slice(elLinesAlreadyPushed)
      // recurse to handle multiple page spanning elements
      addAndMaybeBreak(elLinesTail, elLineMapTail);
      return;
    } else {
      lines.push(...elLines);
      lineMap.push(...elLineMap);
      // `extra` may be stale if lines/lineMap were mutated, recalculate
      const extraRows = elLineMap.reduce((sum, m) => sum + (m.rows ?? 0), 0);
      pageLines += extraRows;
    }
    // blank line spacer after the block (if it still fits on this page)
    if (pageLines + 1 <= SCRYPT_LINES_PER_PAGE) {
      blank();
      pageLines += 1;
    }
  }

  // loop through the scenes and elements
  json.data.scenes.forEach((sc, sceneIdx) => {
    sc.elements.forEach((el, elIdx) => {
      if (el.type === 'scene_heading') {
        lastDialogueChar = null;
      }

      const isFoldedDialogue =  el.type === 'dialogue' && lastElementType === 'dialogue' && el.character.trim().toUpperCase() === lastDialogueChar;
      // const isDialogueContinuation = el.type === 'dialogue' && lastDialogueChar && el.character.trim().toUpperCase() === lastDialogueChar
      const isDialogueContinuation = el.type === 'dialogue' &&  el.contd;

      const { lines: elLines, meta: elLineMap } = explodeElement(el)

      if (isFoldedDialogue) {
        popLastBlank();
        // Drop the “CHARACTER” line + its meta
        elLines.shift();
        elLineMap.shift();
      } else if (isDialogueContinuation) {
        const contd = UIstrings.contd || ' (CONT’D)';
        if (!elLines[0].endsWith(contd)) elLines[0] += contd;
      }

      elLineMap[0]['sceneNo'] = sceneIdx
      elLineMap[0]['elementNo'] = elIdx
      addAndMaybeBreak(elLines, elLineMap);

      lastElementType  = el.type;
      lastDialogueChar = (el.type === 'dialogue') ? el.character.trim().toUpperCase() : lastDialogueChar;
    });
  });

  /*
   * Ensure that the last line is a blank (it may have been skipped at the end of a full page.)
   * This is needed to ensure proper layout of the insert bar at bottom.
   * Either add one (if there is room) or start a new page.
   */
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

  /* dev only ! */
  validatePageStructure(lines, lineMap);

  return { lines, lineMap };
}


export { toLinesAndMap  }