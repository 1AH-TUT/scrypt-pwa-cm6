import { toLinesAndMap } from "./scrypt/element-utils.js";

export class DocController {
  constructor(json) {
    this.json = json;

    const { lines , lineMap } = toLinesAndMap(json);
    this.lines = lines;
    this.lineMeta = lineMap
    // this.state = EditorState.create({ doc: this.lines.join("\n") });
  }
  get text() {
    return this.lines.join("\n");
  }
}
