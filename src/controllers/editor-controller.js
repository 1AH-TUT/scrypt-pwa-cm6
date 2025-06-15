import { toLinesAndMap } from "../scrypt/element-utils.js";
import { getCurrentScrypt } from "../state/current-scrypt.js";

export class EditorController {
  constructor() {
    this.scrypt = getCurrentScrypt();
    const { lines , lineMap } = toLinesAndMap(this.scrypt);
    this.lines = lines;
    this.lineMeta = lineMap
    this.selectedId = null;
    this.elementPositions = {};
    this.lineMeta.forEach((m, idx) => {
      if (m && m.id != null) {
        if (!this.elementPositions[m.id]) {
          this.elementPositions[m.id] = { start: idx, end: idx };
        } else {
          this.elementPositions[m.id].end = idx;
        }
      }
    });

  }
  get text() {
    return this.lines.join("\n");
  }

  setSelected(id) {
    // console.log("selectedId:", id)
    this.selectedId = id;
  }

  /** Unique element IDs in document order */
  elementOrder() {
    const ids = [...new Set(this.lineMeta
        .filter(m => m && m.id != null)
        .map(m => m.id))];
    ids.push("_insert_bar_");      // NEW
    return ids;
  }

  /** Rebuild lines + maps after a JSON mutation */
  reindex() {
    const { lines, lineMap } = toLinesAndMap(this.scrypt);
    this.lines   = lines;
    this.lineMeta = lineMap;

    // Recompute elementPositions
    this.elementPositions = {};
    this.lineMeta.forEach((m, idx) => {
      if (m && m.id != null) {
        (this.elementPositions[m.id] ||= { start: idx }).end = idx;
      }
    });
  }


  createElementAtLine(lineNo, type, beforeAfter = 'after', initialData = {}) {
    console.debug(`createElementAtPos called, lineNo: ${lineNo}, type: ${type}, beforeAfter: ${beforeAfter}`)

    const  { sceneNo, elementNo } = this.findElementIndexesFromLineNo(lineNo, beforeAfter);

    if ( sceneNo == null || elementNo == null ) return;

    const id = this.scrypt.addElement(type, sceneNo, elementNo, beforeAfter)
    if (id !== null) {
      this.reindex();
      return id;
    }
    return null;
  }

  /**
   * Finds the element index (in the Script elements array) for insertion
   * based on a given document line number and direction.
   *
   * @param { number } lineNo - zero-based line number
   * @param { 'before'|'after' } beforeAfter - insertion direction
   * @returns { object } - containing SceneNo & ElementNo
   */
  findElementIndexesFromLineNo(lineNo, beforeAfter = 'after') {
    // Walk up until we hit a line that belongs to an element (incase we were passed a blank)
    let ln = lineNo;
    while (ln >= 0) {
      const meta = this.lineMeta[ln];
      if (meta && meta.id != null) {
        return {sceneNo: meta.sceneNo, elementNo: meta.elementNo};
      }
      ln--;
    }
    console.error('findElementIndexesFromLineNo: no element found (started at', lineNo, ')');
    return {sceneNo: null, elementNo: null};
  }
}
