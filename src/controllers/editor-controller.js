import { toLinesAndMap } from "../views/editor-view-element-utils.js";

export class EditorController extends EventTarget {
  #elementOrder = [];
  #elementPositions = {};
  #isDirty = false;
  #flushQueued = false;
  #selectedId = null
  #pendingDetails = [];
  #pendingInserts = new Set();

  constructor(script) {
    super();

    this.scrypt = script;
    ({ lines: this.lines, lineMap: this.lineMeta } = toLinesAndMap(this.scrypt));

    // Build the indexes
    this.reindex();

    // Listen to all model changes
    this.scrypt.addEventListener("change", e => {
      this.#isDirty = true;
      this.#pendingDetails.push(e.detail);
      if (!this.#flushQueued) {
        this.#flushQueued = true;
        queueMicrotask(() => { this.#flushQueued = false; this._flush(); });
      }
    });
  }

  /** Rebuild order and positions */
  _recomputeIndexes() {
    this.#elementOrder = [];
    this.#elementPositions = {};

    this.lineMeta.forEach((m, idx) => {
      if (m && m.id != null) {
        if (!this.#elementPositions[m.id]) {
          this.#elementOrder.push(m.id);
          this.#elementPositions[m.id] = { start: idx, end: idx };
        } else {
          this.#elementPositions[m.id].end = idx;
        }
      }
    });

    // if we have no selectedId, default to first scene_heading
    if (!this.#selectedId) {
      this.setSelected(this.elementOrder.find(id => {
        const meta = this.lineMeta[this.#elementPositions[id].start];
        return meta.type === 'scene_heading';
      }) ?? null)
    }
  }

  // --- Getters & Setters ---

  /** Unique element IDs in document order */
  get elementOrder() { return [...this.#elementOrder]; }
  get elementPositions() { return { ...this.#elementPositions }; }

  getElementPosition(id) {
    return Object.fromEntries( Object.entries(this.#elementPositions).map(([id, pos]) => [id, {...pos}]) );
  }

  get text() { return this.lines.join("\n"); }
  get selectedId() { return this.#selectedId; }
  setSelected(id, dir="none") {
    const old = this.#selectedId;
    this.#selectedId = id;
    if (old !== id) {
      this.dispatchEvent(new CustomEvent("selected-changed", {
        detail: { oldId: old, newId: id, dir }
      }));
    }
  }

  // --- Methods ---

  /**
   * Returns true if this element was just inserted and not yet committed,
   * and removes it from the pending set.
   */
  consumePendingInsert(id) {
    if (this.#pendingInserts.has(id)) {
      this.#pendingInserts.delete(id);
      return true;
    }
    return false;
  }

  /** Rebuild lines + maps after a JSON mutation */
  reindex() {
    console.debug('EditorController reindex');
    const {lines, lineMap} = toLinesAndMap(this.scrypt);
    this.lines = lines;
    this.lineMeta = lineMap;
    this._recomputeIndexes();
  }

  _flush() {
    console.debug('EditorController._flush', this.#isDirty, this.#pendingDetails);

    if (!this.#isDirty) return;
    this.#isDirty = false;

    this.reindex();
    this.#pendingDetails = [];
    this.dispatchEvent(new CustomEvent("change", { detail: { selectedId: this.#selectedId } }));
  }

  getNextSceneHeadingId(currentElementId) {
    // Find the line number for the current element
    const currentPos = this.elementPositions[currentElementId]?.start;
    if (currentPos == null) return null;

    // Find & return the id of the first scene_heading after this position
    for (let i = currentPos + 1; i < this.lineMeta.length; ++i) {
      if (this.lineMeta[i]?.type === "scene_heading") {
        return this.lineMeta[i].id;
      }
    }
    return null;
  }

  getPreviousSceneHeadingId(currentElementId) {
    // Find the line number for the current element
    const currentPos = this.elementPositions[currentElementId]?.start;
    if (currentPos == null) return null;

    // Find & return the id of the first scene_heading before this position
    for (let i = currentPos - 1; i >= 0; --i) {
      if (this.lineMeta[i]?.type === "scene_heading") {
        return this.lineMeta[i].id;
      }
    }
    return null;
  }

  /**
   * Delete an element by ID, with optional full scene removal for scene headings.
   * Returns a new selected element id (or null if nothing left).
   */
  deleteElement(refId, { deleteFullScene = false } = {}) {
    const orderBefore = this.elementOrder;
    const idx = orderBefore.indexOf(refId);

    // Pick next or previous before we mutate
    const nextId = orderBefore[idx + 1] || null;
    const prevId = orderBefore[idx - 1] || null;

    if (!this.scrypt.removeElement(refId, { deleteFullScene })) return null;

    // Find the candidate in new order
    const orderAfter = this.elementOrder;
    let selectedId = nextId && orderAfter.includes(nextId) ? nextId :
                     prevId && orderAfter.includes(prevId) ? prevId :
                     orderAfter[0] || null;

    let dir = "none";
    if (selectedId === nextId)      dir = "down";
    else if (selectedId === prevId) dir = "up";

    this.setSelected(selectedId, dir);
    return selectedId;
  }

  /**
   * Inserts a new element of `type` before/After element `refId`
   */
  createElementRelativeTo(refId, type, beforeAfter = 'after', initialData = {}) {
    console.debug(`createElementRelativeTo called, refId: ${refId}, type: ${type}, beforeAfter: ${beforeAfter}`);

    const meta = this.lineMeta.find(m => m && m.id === refId);
    if (!meta) return null;
    const {sceneNo, elementNo} = meta;
    const newId = this.scrypt.addElement(type, sceneNo, elementNo, beforeAfter, initialData);
    if (newId != null) {
      this.#pendingInserts.add(newId);
      this.setSelected(newId);
      return newId;
    }
    console.warn(`createElementRelativeTo failed, refId: ${refId}, type: ${type}, beforeAfter: ${beforeAfter} - returning null`);
    return null;
  }

  getLastElementId() {
    return this.#elementOrder.length ? this.#elementOrder[this.#elementOrder.length - 1] : null;
  }
}