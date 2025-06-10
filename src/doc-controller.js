import { toLinesAndMap } from "./scrypt/element-utils.js";

export class DocController {
  constructor(json) {
    this.json = json;

    const { lines , lineMap } = toLinesAndMap(json);
    this.lines = lines;
    this.lineMeta = lineMap
    this.selectedId = null;
    // this.state = EditorState.create({ doc: this.lines.join("\n") });
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
    console.log("selectedId:", id)
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
}
