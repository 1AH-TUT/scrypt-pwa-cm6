/*  text-sanitiser.js  */

import { MAX_CHARS_PER_DIALOGUE_LINE, MAX_CHARS_PER_LINE } from "../scrypt/default-options.js";

export const DEFAULT_RULES = Object.freeze({
  trim         : false,    // trim() whole string
  collapseWS   : true,     // multiple spaces → single
  maxLines     : Infinity,
  maxCols      : MAX_CHARS_PER_LINE,
  uppercase    : false,    // force whole string to UPPER CASE
  allowMarkup  : false,    // if true keep *italic* **bold** etc.
  disallowCTL  : true      // strip ASCII < 0x20 (except \n)
});

/* Cleans a text field. Returns a new sanitized string + changed flag. Does not mutate input. */
export function sanitizeText(str = "", rules = DEFAULT_RULES) {
  let out = str;

  if (rules.collapseWS) {
    out = out.replace(/\t/g, " ");
    out = out.split("\n").map(l => l.replace(/ {2,}/g, " ")).join("\n");
  }

  if (rules.disallowCTL)
    out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // normalise line-endings
  out = out.replace(/\r\n?/g, "\n");

  if (!rules.allowMarkup)
    out = out.replace(/<[^>]*>/g, "");        // strip HTML tags

  // split → clip columns → clip lines → re-join
  const clipped = out
    .split("\n")
    .map(l => l.slice(0, rules.maxCols))
    .slice(0, rules.maxLines)
    .join("\n");

  out = rules.trim ? clipped.trim() : clipped;

  if (rules.uppercase) out = out.toUpperCase();

  return {
    clean   : out,
    changed : out !== str
  };
}

// factory for slight variations
export const makeRules = opts => Object.freeze({ ...DEFAULT_RULES, ...opts });

export const TITLE_FIELD_RULES    = makeRules({ maxLines: 1, maxCols: MAX_CHARS_PER_LINE });
export const CONTACT_RULES        = makeRules({ maxLines: 4, maxCols: MAX_CHARS_PER_LINE });
export const CHARACTER_RULES      = makeRules({ maxLines: 1, maxCols: MAX_CHARS_PER_DIALOGUE_LINE, uppercase: true });
export const TRANSITION_RULES      = makeRules({ maxLines: 1, maxCols: 40, uppercase: true });
export const SCENE_INDICATOR_RULES = makeRules({ maxLines: 1, maxCols: 12, uppercase: true, trim: true });
export const SCENE_HEADING_RULES  = makeRules({ maxLines: 1, maxCols: MAX_CHARS_PER_LINE, uppercase: true });
export const PARENTHETICAL_RULES  = makeRules({ maxLines: 1, maxCols: MAX_CHARS_PER_DIALOGUE_LINE - 2 });
export const DIALOGUE_RULES       = makeRules({ maxLines: Infinity, maxCols: Infinity });
export const LOCATION_RULES       = makeRules({ maxLines: 1, maxCols: MAX_CHARS_PER_LINE - 23, uppercase: true });
export const ACTION_RULES         = makeRules({ maxLines: Infinity, maxCols: Infinity });


/* Sanitize a full raw JSON Scrypt object */
export function sanitizeScryptJSON(rawScryptObj, verbose=false) {
  const scryptObj = structuredClone(rawScryptObj);

  // ensure all user editable text is clean
  Object.entries(scryptObj.titlePage).forEach( ([key, value]) => {
    const rules = (key === 'contact') ? CONTACT_RULES : TITLE_FIELD_RULES;
    const { clean, changed } = sanitizeText(value, rules)
    if (changed) {
      if (verbose) console.debug(`Title Page field ${key} cleaned, \nwas [${value}], \nnow: [${clean}]`)
      scryptObj.titlePage[key] = clean
    }
  });
  const cleanElementField = ( sceneId, element, fieldKey, rules ) => {
    if (typeof element[fieldKey] !== 'string') return;

    const { clean, changed } = sanitizeText(element[fieldKey], rules);

    if (!changed) {
      element[fieldKey] = element[fieldKey].trim();
      return;
    }
    const before = element[fieldKey];
    element[fieldKey] = clean.trim();
    if (verbose) {
      console.debug(`Scene ${sceneId}, element [${element.id}-${element.type}] cleaned, \nwas [${before}], \nnow: [${element[fieldKey]}]`)
    }
  }

  // lax rules for scene heading to allow import of non-standard slug lines that span > 1 line (Studio/Shooting Script Exception)
  const LAX_SCENE_HEADING_RULES = makeRules({ maxCols: Infinity, uppercase: true, trim: true });

  for (const scene of scryptObj.data.scenes) {
    for (const element of scene.elements) {
      switch (element.type) {
        case "action":
          cleanElementField(scene.id, element, "text", ACTION_RULES)
          break;
        case "scene_heading":
          cleanElementField(scene.id, element, "indicator", LAX_SCENE_HEADING_RULES)
          cleanElementField(scene.id, element, "location", LAX_SCENE_HEADING_RULES)
          cleanElementField(scene.id, element, "time", LAX_SCENE_HEADING_RULES)
          cleanElementField(scene.id, element, "text", LAX_SCENE_HEADING_RULES)
          break;
        case "dialogue":
          cleanElementField(scene.id, element, "character", CHARACTER_RULES)
          cleanElementField(scene.id, element, "parenthetical", PARENTHETICAL_RULES)
          cleanElementField(scene.id, element, "text", DIALOGUE_RULES)
          break;
        case "transition":
          cleanElementField(scene.id, element, "text", TRANSITION_RULES)
          break;
      }
    }
  }
  return scryptObj;
}

