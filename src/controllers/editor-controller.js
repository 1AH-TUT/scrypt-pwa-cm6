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

  createElementAtPos(pos, type, beforeAfter = 'after', initialData = {}) {
    // Map doc pos to element index
    const { elementIndex, isEdgeCase } = this.findElementIndexFromDocPos(pos, beforeAfter);

    // Insert using the Script data model
    const newId = this.scrypt.addElement(type, elementIndex, {});

    // Reindex and return new element's id (for view to focus, etc)
    this.reindex();
    return newId;
  }

  // Helper: figure out where to insert
  findElementIndexFromDocPos(pos, beforeAfter = 'after') {
    // Walk through elementPositions, figure out which element this pos is before/after
    // Return an index (in elements array) for insert, and edge case flags if needed
    // e.g. at start, end, etc.
    // ...
    return { elementIndex, isEdgeCase };
  }
}
