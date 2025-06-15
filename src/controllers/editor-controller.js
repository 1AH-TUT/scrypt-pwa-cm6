import { toLinesAndMap } from "../scrypt/element-utils.js";
import { getCurrentScrypt } from "../state/current-scrypt.js";

export class EditorController {
  constructor() {
    this.scrypt = getCurrentScrypt();
    const {lines, lineMap} = toLinesAndMap(this.scrypt);
    this.lines = lines;
    this.lineMeta = lineMap
    this.selectedId = null;
    this.elementPositions = {};
    this.lineMeta.forEach((m, idx) => {
      if (m && m.id != null) {
        if (!this.elementPositions[m.id]) {
          this.elementPositions[m.id] = {start: idx, end: idx};
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
    const {lines, lineMap} = toLinesAndMap(this.scrypt);
    this.lines = lines;
    this.lineMeta = lineMap;

    // Recompute elementPositions
    this.elementPositions = {};
    this.lineMeta.forEach((m, idx) => {
      if (m && m.id != null) {
        (this.elementPositions[m.id] ||= {start: idx}).end = idx;
      }
    });
  }


  createElementRelativeTo(refId, type, beforeAfter = 'after', initialData = {}) {
    console.debug(`createElementRelativeTo called, refId: ${refId}, type: ${type}, beforeAfter: ${beforeAfter}`)

    const meta = this.lineMeta.find(m => m && m.id === refId);
    if (!meta) return null;
    const {sceneNo, elementNo} = meta;
    const newId = this.scrypt.addElement(type, sceneNo, elementNo, beforeAfter, initialData);
    if (newId != null) {
      this.reindex();
      this.setSelected(newId);
      return newId;
    }
    console.warn(`createElementRelativeTo failed, refId: ${refId}, type: ${type}, beforeAfter: ${beforeAfter} - returning null`)
    return null;
  }
}