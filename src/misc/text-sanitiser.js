/*  text-sanitiser.js  */

import { MAX_CHARS_PER_LINE } from "../scrypt/default-options.js";

export const DEFAULT_RULES = Object.freeze({
  trim         : false,    // trim() whole string
  collapseWS   : true,     // multiple spaces → single
  maxLines     : Infinity,
  maxCols      : MAX_CHARS_PER_LINE,
  uppercase    : false,    // force whole string to UPPER CASE
  allowMarkup  : false,    // if true keep *italic* **bold** etc.
  disallowCTL  : true      // strip ASCII < 0x20 (except \n)
});

export function sanitizeText(str = "", rules = DEFAULT_RULES) {
  let out = str;

  if (rules.collapseWS)
    out = out.replace(/\t/g, " ");
    out = out.split("\n").map(l => l.replace(/ {2,}/g, " ")).join("\n");

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
export const CHARACTER_RULES      = makeRules({ maxLines: 1, maxCols: 36, uppercase: true });
export const PARENTHETICAL_RULES  = makeRules({ maxLines: 1, maxCols: 34 });
export const DIALOGUE_RULES       = makeRules({ maxLines: Infinity, maxCols: Infinity });
export const LOCATION_RULES       = makeRules({ maxLines: 1, maxCols: MAX_CHARS_PER_LINE - 23, uppercase: true });
export const ACTION_RULES         = makeRules({ maxLines: Infinity, maxCols: Infinity });
