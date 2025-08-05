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


/** Element -> line explosion */
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


/* --- Main pagination engine --- */
class PageManager {
  #lines = [];
  #lineMap = [];
  #pageNo = 0;
  #pageLines = 0;
  #lastElementType = null;
  #lastDialogueChar = null;
  #validate = false;
  #verbose = false;
  #strings = { cont: UIstrings.contd || ' (CONT’D)' };
  #nLinesPerPage = SCRYPT_LINES_PER_PAGE;
  #nLinesTopMargin = TOP_MARGIN_LINES;
  #nLinesBottomMargin = BOTTOM_MARGIN_LINES;
  #colsLookup = COLS;
  #splitLineOnSentences = false;

  /**
   * @param {object} [options] - Pagination config.
   * @param {number} [options.linesPerPage] - Number of lines per page.
   * @param {number} [options.topMargin] - Number of lines in top margin.
   * @param {number} [options.bottomMargin] - Number of lines in bottom margin.
   * @param {string} [options.contdToken] - String to append for continued dialogue.
   * @param {object} [options.colsLookup] - Mapping of element type to max chars/line.@param {object} [options.colsLookup] - Mapping of element type to max chars/line.
   * @param {boolean} [options.splitLineOnSentences] - Whether to respect sentence boundaries when splitting lines.
   * @param {boolean} [options.validate] - Whether to validate page structure.
   * @param {boolean} [options.verbose] - Enable verbose debug output.
   */
  constructor({
                linesPerPage = SCRYPT_LINES_PER_PAGE,
                topMargin = TOP_MARGIN_LINES,
                bottomMargin = BOTTOM_MARGIN_LINES,
                contdToken = UIstrings.contd || ' (CONT’D)',
                colsLookup = COLS,
                splitLineOnSentences = false,
                validate=false, verbose=false
  } = {}) {
    this.#validate = validate;
    this.#verbose = verbose;
    this.#nLinesPerPage = linesPerPage;
    this.#nLinesTopMargin = topMargin;
    this.#nLinesBottomMargin = bottomMargin;
    this.#strings = { contd: contdToken };
    this.#colsLookup = colsLookup;
    this.#splitLineOnSentences = splitLineOnSentences;
  }

  /* --- public interface --- */

  /** Adds an element (lines + meta) to the current page, splitting across pages if needed. */
  addElement(elLines, elMeta) {
    const emit = (l, m) => {
      const elType = m[0].type;
      let character = null;
      if (elType === 'dialogue') {
        character = l[0].toUpperCase().trim();

        const isFoldedDialogue =  this.#lastElementType === 'dialogue' && character === this.#lastDialogueChar;
        let isDialogueContinuation = m[0].contd === true;
        if (isFoldedDialogue) {
          if (this.#pageLines === 0) {
            // don't fold at top of page, just ensure contd
            if (this.#verbose) {
              console.info(`${String(this.#pageNo).padStart(3, "0")} Not folding Dialogue ${m[0].id} (top of page): ${l.join('|').slice(0, 80)}`);
            }
            isDialogueContinuation = true;
          } else {
            // Hide the preceding blank & drop the “CHARACTER” line + its meta
            if (this.#verbose) {
              console.info(`${String(this.#pageNo).padStart(3, "0")} Folding Dialogue ${m[0].id} : ${l.join('|').slice(0, 80)}`);
            }
            this.#hideLastBlank();
            l.shift();
            m.shift();
          }
        }
        if (isDialogueContinuation) {
          if (this.#verbose) {
            console.info(`${String(this.#pageNo).padStart(3, "0")} Marking Dialogue ${m[0].id} continued (${m[0].contd ? 'user' : 'system'}): ${l.join('|').slice(0, 80)}`);
          }
          if (!l[0].endsWith(this.#strings.contd)) l[0] += this.#strings.contd;
        }
      } else {
        this.#lastDialogueChar = null;
      }

      this.#lines.push(...l);
      this.#lineMap.push(...m);
      this.#lastElementType = elType;
      this.#lastDialogueChar = (elType === 'dialogue') ? character : this.#lastDialogueChar;

      const linesPushed = m.reduce(
        (sum, meta) => (!meta || meta.type === "page_break" || meta.type === "fold_spacer")
          ? sum : sum + (typeof meta.rows === "number" ? meta.rows : 1), 0);

      if (this.#verbose) {
        console.debug(`${String(this.#pageNo).padStart(3, "0")} Emitted ${linesPushed} line(s) of element ${m[0].id} [${m[0].type}]: ${l.join('|').slice(0, 80)}`);
      }

      this.#pageLines += linesPushed;
    }

    const rowsNeeded = this._estimateLines(elLines, elMeta);

    // Start a new page if we are at the end
    if (this.#rowsFree() === 0) {
      this.#breakPage()
    }

    // If whole element fits on page
    if (rowsNeeded <= this.#rowsFree()) {
      emit(elLines, elMeta);

      // add a blank line if there is room
      if (this.#rowsFree() > 0) this.#pushBlank(1);

      return;
    }

    if (this.#verbose) {
      console.info(`element ${elMeta[0].id} [${elMeta[0].type}] does not fit entirely on page ${this.#pageNo}: needed ${rowsNeeded}; left ${this.#rowsFree()}`);
    }

    const { head: headSplit, tail: tailSplit } = this._splitElement(elLines, elMeta, this.#rowsFree());

    // If there is a head that fits on this page
    if (headSplit.lines.length > 0) emit(headSplit.lines, headSplit.map);

    this.#breakPage()

    // Recurse anything left
    if (tailSplit.lines.length) {
      this.addElement(tailSplit.lines, tailSplit.map);
    }

  }

  /** Emits the title page content, laying out the initial (cover) page. */
  pushTitlePage(json) {
    const capitalizeFirst = (str) => { return str ? str[0].toUpperCase() + str.slice(1) : str; }
    const pushTitlePageLinesAndMap = (key) => {
      this.#lines.push(json[key]);
      this.#lineMap.push({ id:`tp_${key}`, type:key, field:'text', idx:0, label: `${capitalizeFirst(key)}:` });
    }

    const totalTitlePageLines = this.#nLinesPerPage + this.#nLinesTopMargin;

    for (let line = 0; line < totalTitlePageLines; line++) {
      if (line === 7) {
       pushTitlePageLinesAndMap("title");
      } else if (line === 9) {
       pushTitlePageLinesAndMap("byline");
      } else if (line === 12) {
       pushTitlePageLinesAndMap("source");
      } else if (line === 17) {
       pushTitlePageLinesAndMap("copyright");
      } else if (line === 53) {
        const key = "contact";
        const splitValue = json[key].split(/\r?\n/).slice(0,4);
        splitValue.forEach((t,i)=>{
          this.#lines.push(t);
          const data = { id:`tp_${key}`, type:key, field:'text', idx:i }
          if (i===0) data['label'] = `${capitalizeFirst(key)}:`;
          this.#lineMap.push(data);
        });
        line += splitValue.length -1;
      } else if (line === 59) {
       pushTitlePageLinesAndMap("date");
      } else {
        this.#pushBlank();
      }
    }

    this.#breakPage();
  }

  /**
   * Finalizes the lines and lineMap arrays, ensuring correct trailing blank.
   * @returns {{lines: string[], lineMap: object[]}}
   */
  getFinal() {
    if (this.#validate) this.validatePageStructure();

    /*
     * Ensure that the last line is a blank (it may have been skipped at the end of a full page.)
     * This is needed to ensure proper layout of the insert bar at bottom.
     * Either add one (if there is room) or start a new page.
     */
    const lastMeta = this.#lineMap[this.#lineMap.length - 1];

    if (!PageManager.isBlank(lastMeta)) {
      if (this.#pageLines < SCRYPT_LINES_PER_PAGE) {
        this.#pushBlank(1);
      } else {
        this.#breakPage();
      }
    }


    return { lines: this.#lines, lineMap: this.#lineMap }
  }

  
  /** Validates each full page to ensure it has the expected number of lines. */
  validatePageStructure() {
    const TOP = this.#nLinesTopMargin;
    const PER = this.#nLinesPerPage;
    const BOTTOM = this.#nLinesBottomMargin;
    let pageStart = 0, pageNo = 0, nPages = 0, issues = 0;
    let expectedTotal = TOP + PER + BOTTOM;

    // Helper to sum up rows
    const sumRows = (start, end) => {
      let sum = 0;
      for (let i = start; i <= end; i++) {
        const meta = this.#lineMap[i];
        // Only count visible/real lines
        if (meta?.type === "page_break" || meta?.type === "fold_spacer") continue;
        sum += typeof meta?.rows === "number" ? meta.rows : 1;
      }
      return sum;
    };

    for (let i = 0; i < this.#lineMap.length; i++) {
      const meta = this.#lineMap[i];
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
      `validatePageStructure: Parsed ${nPages} pages, total (logical) lines: ${this.#lines.length}, issues: ${issues ? issues.length : 0 }` +
        (issues ? `, ${issues} page(s) with incorrect line count` : "")
    );

  }

  
  /* --- private helpers --- */
  
  /** Hides the last blank line (marks as invisible fold spacer). */
  #hideLastBlank() {
    if (this.#lines.length && this.#lineMap[this.#lines.length - 1] === null) {
      // keep the physical line but mark it invisible & zero-rows
      this.#lineMap[this.#lines.length - 1] = { type: "fold_spacer", rows: 0 };
      this.#pageLines -= 1; // discount it in the running tally
    }
  }

  /** Returns number of free lines remaining on the current page. */
  #rowsFree() { return this.#nLinesPerPage - this.#pageLines; }

  /** Completes the current page, inserts a page break, and sets up the next page. Moves orphaned sluglines to top of new page */
  #breakPage() {
    this.#pageNo += 1;
    this.#lastDialogueChar = null;

    if (this.#lastElementType === 'scene_heading') {
      // bump the scene_heading to a new page
      let index = this.#lineMap.length - 1;
      for (index; index >= 0; index--) {
        if (this.#lineMap[index]?.type === 'scene_heading') break;
      }
      let linesCarried = this.#lineMap.length - index;
      const rowsRemaining = this.#pageLines - linesCarried;
      const blanksNeeded  = this.#nLinesPerPage - rowsRemaining;

      const linesToInsert = Array(blanksNeeded + this.#nLinesBottomMargin + 1 + this.#nLinesTopMargin).fill("");
      const mapToInsert = Array(blanksNeeded + this.#nLinesBottomMargin).fill(null);
      mapToInsert.push({"type": "page_break", "page": this.#pageNo + '.'});
      mapToInsert.push(...Array(this.#nLinesTopMargin).fill(null));

      this.#lines.splice(index, 0, ...linesToInsert);
      this.#lineMap.splice(index, 0, ...mapToInsert);

      if (linesCarried === 1) {
        // we must be missing a blank...
        this.#pushBlank(1);
        linesCarried++;
      }
      this.#pageLines = linesCarried;
      if (this.#verbose) console.info(`Bumped orphaned slugline to Page ${this.#pageNo}`);
    } else {
      const missingLines = this.#nLinesPerPage - this.#pageLines;
      this.#pushBlank(missingLines);
      this.#pushBlank(BOTTOM_MARGIN_LINES);
      this.#lines.push("");
      this.#lineMap.push({"type": "page_break", "page": this.#pageNo + '.'});
      this.#pushBlank(TOP_MARGIN_LINES);
      this.#pageLines = 0;
    }

  }

  /** Appends `n` blank lines to the current page. */
  #pushBlank(n = 1) {
    this.#lines.push(...Array(n).fill(""));
    this.#lineMap.push(...Array(n).fill(null));
    this.#pageLines += n;
  }

  /* --- static & other helpers --- */
  
  /** Returns true if the given lineMap entry is a blank or fold spacer. */
  static isBlank(meta) { return  !meta || meta.type === "fold_spacer"; }

  /** Splits a single logical string into a head and tail, based on available rows. */
  static splitLine(str, rowsLeft, maxCols) {
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

    return [str.slice(0, cursor), str.slice(cursor)];
  }

  /** Splits a single string into a head and tail, based on sentence boundaries and available rows */
  static splitLineBySentence(str, rowsLeft, maxCols) {
    if (rowsLeft <= 0) return ["", str];

    // naïve sentence tokeniser, accepts '.', '?', '!', '…', '---' as terminators UNLESS we recognise a common abbreviation.
    const ABBR = /^(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|U\.S|U\.K|etc)\.$/i;
    const tokens = [];
    let buf = "";

    // Split sentences
    for (let i = 0; i < str.length; i++) {
      buf += str[i];
      // If this char starts a sequence of '.' or '-', keep buffering
      if ((str[i] === "." && str[i + 1] === ".") || (str[i] === "-" && str[i + 1] === "-")) continue;

      const lookback = str.slice(Math.max(0, i - 4), i + 1); // for '---'
      const isEllipsis = lookback.endsWith("...") || lookback.endsWith("…");
      const isDash     = lookback.endsWith("---") || lookback.endsWith("--") || lookback.endsWith("—");
      const isEndPunct = /[.!?]/.test(str[i]);

      if (isDash || isEllipsis || (isEndPunct && !ABBR.test(buf.trim()))) {
        tokens.push(buf.trim());   // commit sentence
        buf = "";
      }
    }
    if (buf.trim()) tokens.push(buf.trim());

    // Greedy pack sentences until out of rows
    let headTokens = [];
    let cursor = 0;
    while (cursor < tokens.length) {
      const candidate = [...headTokens, tokens[cursor]].join(" ");
      const rowCount = PageManager.wrappedRowsFast(candidate, maxCols);
      if (rowCount > rowsLeft) break;
      headTokens.push(tokens[cursor]);
      cursor++;
    }

    let head = "";
    let tail = "";

    // No sentence fits → return empty head
    if (headTokens.length === 0) {
      tail = str;
    } else {
      head = headTokens.join(" ");
      tail = tokens.slice(cursor).join(" ");
    }
    return [head, tail];
  }

  /** Intelligently splits an element's lines and meta into head (fits-on-page) and tail (remainder) for pagination. */
  _splitElement(elLines, elLineMap, rowsSpare) {
    // naive version - splits on lines only
    const maxCols = elLineMap[0].type === 'dialogue' ? this.#colsLookup.dialogue : this.#colsLookup.action;

    const head = { lines: [], map: [] };
    const tail = { lines: [], map: [] };

    let hasParethetical = false;
    let dialogueLead = 0;

    let i = 0;

    // dialogue only
    if (elLineMap[0].type === 'dialogue') {
      hasParethetical = (elLineMap[1].field === 'parenthetical');
      dialogueLead = hasParethetical? 2 : 1;

      // Return all in tail if not room for at least one text line
      if ( dialogueLead + 1 > rowsSpare) {
        tail.lines = elLines;
        tail.map = elLineMap;
        return { head, tail };
      }
      head.lines.push(elLines[i]);
      head.map.push(elLineMap[i]);
      tail.lines.push(elLines[i] + UIstrings.contd);
      tail.map.push(elLineMap[i]);
      i++;
      rowsSpare--;
      if (hasParethetical) {
        head.lines.push(elLines[i]);
        head.map.push(elLineMap[i]);
        i++;
        rowsSpare--;
      }
    }

    while (i < elLines.length && rowsSpare > 0) {
      const meta = elLineMap[i];
      const rows = meta.rows;
      if (rows <= rowsSpare) {
        // whole logical line fit
        head.lines.push(elLines[i]);
        const headMeta = { ...meta, rows };
        head.map.push(headMeta);
        rowsSpare -= rows;
        i++;
      } else {
        // split logical line
        let lineHead = null;
        let lineTail = null;
        if (this.#splitLineOnSentences) {
          [lineHead, lineTail] = PageManager.splitLineBySentence(elLines[i], rowsSpare, maxCols);

        } else {
          [lineHead, lineTail] = PageManager.splitLine(elLines[i], rowsSpare, maxCols);
        }

        const headRows = PageManager.wrappedRowsFast(lineHead, maxCols);
        const tailRows = PageManager.wrappedRowsFast(lineTail, maxCols);

        // push head fragment
        if (lineHead.length) {
          head.lines.push(lineHead);
          head.map.push({...meta, rows: headRows});
        }

        // dump the rest in tail
        if (lineTail.length) {
          tail.lines.push(lineTail);
          tail.map.push({...meta, rows: tailRows});
        }
        i++;
        break;
      }
    }

    if (i < elLines.length) {
      tail.lines.push(...elLines.slice(i));
      tail.map.push(...elLineMap.slice(i));
    }

    if (elLineMap[0].type === 'dialogue') {
      // clear dialogue of lead if no text lines
      if (head.lines.length <= dialogueLead) {
        head.lines = [];
        head.map = [];
      } else if (tail.lines.length <= dialogueLead - 1) {
        tail.lines = [];
        tail.map = [];
      }

      // if we have a split dialogue, mark the last line of head with 'more'
      if (head.lines.length && tail.lines.length) {
        const last = head.map.at(-1);
        head.map[head.map.length - 1] = { ...last, more: head.lines.length > 0 };
      }

      // Ensure no auto cont'd if split sentence has bumped a fragment to tail
      if (this.#splitLineOnSentences && head.lines.length === 0) {
        if (tail.lines[0].endsWith(this.#strings.contd)) {
          tail.lines[0] = tail.lines[0].slice(0, tail.lines[0].length - this.#strings.contd.length)
        }
      }
    }

    return { head, tail };
  }

  /** Calculates and annotates how many physical lines each logical line occupies (mutates meta). */
  _estimateLines(elLines, elLineMap) {
    let total = 0;
    if (!elLines.length || !elLineMap.length) {
      console.warn("estimateLines lines called on empty array - nothing to estimate!")
    }

    const type = elLineMap[0].type;

    for (let i = 0; i < elLines.length; i++) {
      const meta = elLineMap[i];
      let field = meta.field;

      /* Dialogue block gets special widths */
      if (meta.type === "dialogue") {
        field = meta.field === "character"     ? "character"
            : meta.field === "parenthetical" ? "parenthetical"
            : "dialogue";
      }

      const cols = this.#colsLookup[field] ?? this.#colsLookup[type];
      const wrapped = PageManager.wrappedRowsFast(elLines[i], cols);

      total += wrapped;
      elLineMap[i]['rows'] = wrapped;
    }

    return total;
  }

  /** Computes the number of visual lines a string occupies, given max chars per line. */
  static wrappedRowsFast(str, max) {
    const rightmostBreak = (str, from, to) => {
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
}


/**
  Converts scrypt JSON data into paginated lines and meta for CM6 editor view.
  Handles page breaks, element splitting, and screenwriting formatting.

  @param {object} json - Normalized screenplay structure.

  @returns {{ lines: string[], lineMap: object[] }}
*/
function toLinesAndMap(json) {
  const pager = new PageManager({
    validate: true, verbose: true, splitLineOnSentences: true });

  pager.pushTitlePage(json.titlePage);

  const scenes = json.data.scenes;
  scenes.forEach((sc, sceneIdx) => {
    sc.elements.forEach((el, elIdx) => {
      const { lines: elLines, meta: elLineMap } = explodeElement(el)
      elLineMap[0]['sceneNo'] = sceneIdx
      elLineMap[0]['elementNo'] = elIdx

      pager.addElement(elLines, elLineMap);
    });
  });

  return pager.getFinal();
}


export { toLinesAndMap }