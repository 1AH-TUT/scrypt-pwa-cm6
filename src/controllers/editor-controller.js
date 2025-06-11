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
    return [...new Set(
      this.lineMeta
          .filter(m => m && m.id != null)
          .map(m => m.id)
    )];
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

}
