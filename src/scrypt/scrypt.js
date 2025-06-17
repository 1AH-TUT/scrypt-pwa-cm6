// src/scrypt/scrypt.js
import { saveScrypt, getScrypt} from "../data-layer/db.js";
import { DEFAULT_OPTIONS } from "./default-options.js";

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
    this.dispatchEvent(new CustomEvent("change", { detail: { kind: "text", type: "element", id, old, new: element } }));
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

    const extract = (type, prop) =>
      this.data.scenes.flatMap(sc =>
        sc.elements.filter(e => e.type === type && (prop ? e[prop] : true)).map(e => prop ? e[prop] : e.text)
      ).filter(Boolean);

    switch (field) {
      case "location":
      case "indicator":
      case "time":
        used = extract("scene_heading", field);
        break;
      case "transition":
        used = extract("transition");
        break;
      case "character":
        used = extract("dialogue", "character");
        break;
    }
    return [...new Set([...defaults, ...used])];
  }

  addElement(type, sceneIndex, elementIndex, beforeAfterScene) {
    console.debug(`Scrypt.addElement type: ${type}, sceneIndex: ${sceneIndex}, elementIndex: ${elementIndex}, beforeAfter: ${beforeAfterScene}`);

    /*
     * Guards & edge cases...
     */
    const isInsertingAtSceneHeading = this.data.scenes[sceneIndex].elements[elementIndex].type === 'scene_heading';

    if (type === 'scene_heading' && sceneIndex === 0) {
      // scene 0 is only for leading transitions etc.
      // TODO: flag user/remove button
      console.warn("Attempt to insert scene_heading within scene 0 Ignored - returning null");
      return null;
    }

    /*
     * Edge case: inserting any non-heading before a scene_heading
     * (i.e. before an existing slugline) — push into previous scene
     */
    if ( isInsertingAtSceneHeading && type !== 'scene_heading' && beforeAfterScene === 'before') {
      const targetSceneIdx= Math.max(0, sceneIndex - 1);  // scene 0 only for lead-ins
      const targetPos= Math.max(0, this.data.scenes[targetSceneIdx].elements.length - 1);
      // recurse as normal “after”
      return this.addElement(type, targetSceneIdx, targetPos, 'after');
    }

    /*
     * STANDARD INSERTIONS
     */
    const newEl = { type, id: `se${this.metaData.nextId++}`, text: '' };
    const pos = beforeAfterScene === 'before' ? elementIndex : elementIndex + 1;

    if (type === 'action' || type === 'transition' || type === 'dialogue' ) {
      if (type === 'dialogue') Object.assign(newEl, { character: '', parenthetical: '' });
      this.data.scenes[sceneIndex].elements.splice(pos, 0, newEl);
      this._markDirty();
      return newEl.id;
    } else if (type === 'scene_heading') {
      const scene = this.data.scenes[sceneIndex];

      // Decide where to cut the scene's elements:
      const splitAt = beforeAfterScene === 'before' ? elementIndex : elementIndex + 1;

      // Carve off the tail only if we’re not inserting before the very first element (creating an empty new scene)
      let tail = [];
      if (!(beforeAfterScene === 'before' && splitAt === 0)) {
        tail = scene.elements.splice(splitAt);
      }

      const headingEl = { ... newEl, indicator: 'INT.', location:  '', time:      '' };

      // New scene = slugline + any tail
      const newScene = { id: `s${this.metaData.nextId++}`, elements: [headingEl, ...tail] };

      // Insert it at the right index
      const insertAt = (beforeAfterScene === 'before' && elementIndex === 0)
          ? sceneIndex      // place before an existing slugline
          : sceneIndex + 1  // otherwise always after
      this.data.scenes.splice(insertAt, 0, newScene);

      this._markDirty();
      this.dispatchEvent(new CustomEvent("change", {
        detail: { kind: "insert", id: headingEl.id /* or newEl.id */, sceneIndex }
      }));
      return headingEl.id;
    }

    console.warn(`Scrypt.addElement failed unknown type: ${type} - returning null`)
    return null;
  }


  removeElement(elementId, { deleteFullScene = false } = {}) {
    // Find the scene and index containing this element
    let sceneIdx = -1, elIdx = -1;
    for (let s = 0; s < this.data.scenes.length; ++s) {
      const idx = this.data.scenes[s].elements.findIndex(e => e.id === elementId);
      if (idx !== -1) {
        sceneIdx = s;
        elIdx = idx;
        break;
      }
    }
    if (sceneIdx === -1) {
      console.error(`Script.removeElement: no element found with Id: ${elementId}`);
      return false;
    }

    const scene = this.data.scenes[sceneIdx];
    const el = scene.elements[elIdx];
    const oldScene = structuredClone(scene);
    const oldEl = structuredClone(el);

    if (el.type === 'scene_heading') {
      // Cannot delete scene heading in first scene
      if (sceneIdx <= 1) {
        console.warn("Cannot delete first scene's slugline!");
        return false;
      }

    if (deleteFullScene) {
      // Remove whole scene
      this.data.scenes.splice(sceneIdx, 1);
      this._markDirty();
      this.dispatchEvent(new CustomEvent("change", {
        detail: {
          kind: "cut_scene",
          id: oldScene.id,
          old: oldScene
        }
      }));
      return true;
    } else {
      // Merge current scene's elements (except heading) into previous scene
      const prevScene = this.data.scenes[sceneIdx - 1];
      const tail = scene.elements.slice(1); // everything after heading
      prevScene.elements.push(...tail);

      // Remove this scene entirely
      this.data.scenes.splice(sceneIdx, 1);

      this._markDirty();
      this.dispatchEvent(new CustomEvent("change", {
        detail: {
          kind: "delete_scene_heading",
          id: elementId,
          old: oldScene
        }
      }));
      return true;
      }
    } else {
      // Remove element from scene
      scene.elements.splice(elIdx, 1);

      this._markDirty();
      this.dispatchEvent(new CustomEvent("change", { detail: {
          kind: "delete_element",
          id: elementId,
          old: oldEl
        }}));
      return true;
    }
  }

}
