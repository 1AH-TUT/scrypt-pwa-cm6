// src/scrypt/scrypt.js
import { saveScrypt, getScrypt} from "../data-layer/db.js";
import {DEFAULT_OPTIONS} from "./default-options.js";

/**
 * Scrypt: canonical screenplay object with autosave and change events.
 */
export class Scrypt extends EventTarget {
  /**
   * @param {{ id?: int, metaData: object, titlePage: object, data: object }} fullJson
   */
  constructor(fullJson) {
    super();
    // Decompose incoming JSON
    this.metaData   = fullJson.metaData;
    this.titlePage  = fullJson.titlePage;
    this.data       = fullJson.data;     // { scenes: [...] }
    this.id         = fullJson.id;

    // Internal state
    this.dirty      = false;
    this._debounce  = null;
    this._loaded    = true; // already loaded
  }

  getJson() {
    return { id: this.id, titlePage: this.titlePage, data: this.data, metaData: this.metaData }
  }

  static async load(id) {
    const json = await getScrypt(id);
    return json ? new Scrypt(json) : null;
  }


  /**
   * Mutation API: update an element by id
   * @param {string} id
   * @param {object} patch
   */
  updateElement(id, patch) {
    const element = this._findElementById(id);
    if (!element) return;

    const old = structuredClone(element);
    Object.assign(element, patch);

    this._markDirty();
    this.dispatchEvent(new CustomEvent("change", { detail: { type: "element", id, old, new: element } }));
  }

  /** Mark the document dirty and schedule an autosave */
  _markDirty() {
    this.dirty = true;
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this._flush(), 250);
  }

  /** Immediately persist meta and data to IndexedDB */
  async _flush() {
    await saveScrypt(this);
    this.dirty = false;
    this.dispatchEvent(new Event("saved"));
  }

  /** Helper: find an element anywhere in scenes by id */
  _findElementById(id) {
    for (const scene of this.data.scenes) {
      const el = scene.elements.find(e => e.id === id);
      if (el) return el;
    }
    return null;
  }

  getOptions(field) {
    const defaults = DEFAULT_OPTIONS[field] ?? [];

    let used = [];
    if (field === "location" || field === "indicator" || field === "time") {
      used = [
        ...new Set(this.data.scenes.map(sc =>
          field === "location"   ? sc.elements.filter(e=>e.type==="scene_heading").map(e=>e.location)
          : field === "indicator"? sc.elements.filter(e=>e.type==="scene_heading").map(e=>e.indicator)
          :                       sc.elements.filter(e=>e.type==="scene_heading").map(e=>e.time)
        ).flat().filter(Boolean))
      ];
    } else if (field === "transition") {
      used = [
        ...new Set(this.data.scenes.map(sc =>
          sc.elements.filter(e=>e.type==="transition").map(e=>e.text)
        ).flat().filter(Boolean))
      ];
    } else if (field === "character") {
      used = [
        ...new Set(this.data.scenes.map(sc =>
          sc.elements.filter(e=>e.type==="dialogue" && e.character).map(e=>e.character)
        ).flat().filter(Boolean))
      ];
    }
    // Merge & dedupe
    return [...new Set([...defaults, ...used])];
  }

  addElement(type, sceneIndex, elementIndex, beforeAfter) {
    const newEl = { type, id: `se${this.metaData.nextId}`, text: '' };
    this.metaData.nextId += 1;
    const pos = beforeAfter === 'before' ? elementIndex : elementIndex + 1;

    if (type === 'transition') {
      console.debug(`Scrypt.addElement type: ${type}, sceneIndex: ${sceneIndex}, elementIndex: ${elementIndex}, beforeAfter: ${beforeAfter}`);
    } else if (type === 'action') {
      console.debug(`Scrypt.addElement type: ${type}, sceneIndex: ${sceneIndex}, elementIndex: ${elementIndex}, beforeAfter: ${beforeAfter}`);
      this.data.scenes[sceneIndex].elements.splice(pos, 0, newEl)
      this._markDirty();
      return newEl.id;
    } else if (type === 'dialogue') {
      console.debug(`Scrypt.addElement type: ${type}, sceneIndex: ${sceneIndex}, elementIndex: ${elementIndex}, beforeAfter: ${beforeAfter}`);
    } else if (type === 'scene_heading') {
      console.debug(`Scrypt.addElement type: ${type}, sceneIndex: ${sceneIndex}, elementIndex: ${elementIndex}, beforeAfter: ${beforeAfter}`);
    }

    return null;
  }
}
