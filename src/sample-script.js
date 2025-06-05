/** A bite-sized extract from *The Shining* to kick-things off. */
export const screenplay = {
  title:   "The Shining",
  credit:  "Post-Production Script",
  author:  "A STANLEY KUBRICK FILM",
  date:    "04 July 1980",
  elements: [
    { type: "transition",      text: "FADE IN:" },
    { type: "scene_heading",   text: "EXT. COLORADO MOUNTAIN — DAY" },
    { type: "action",          text: "Lake and mountains. CAMERA TRACKS forward past island in lake." },
    { type: "transition",      text: "DISSOLVE TO:" },
    { type: "scene_heading",   text: "EXT. ROAD — DAY" },
    { type: "action",          text: "High-angle view. VW car moving along road — CAMERA TILTS UP with it." },
    { type: "transition",      text: "CUT TO:" },
    { type: "dialogue",
      character: "JACK",
      text:      "Hi, I've got an appointment with Mr Ullman. My name is Jack Torrance." },
    { type: "dialogue",
      character: "RECEPTIONIST",
      text:      "His office is the first door on the left." },
    { type: "dialogue",
      character: "JACK",
      text:      "Thank you." }
  ]
};

/** Very dumb “stringifier” — one line per element, Fountain-ish. */
export function toPlainText(json) {
  const lines   = [];
  const lineMap = [];          // [{id, field}]  -> keep for reverse lookup

  json.elements.forEach(el => {
    switch (el.type) {
      case "dialogue":
        // 1. character
        lines.push(el.character.toUpperCase());
        lineMap.push({id: el.id, type: el.type, field: "character"});
    
        // // 2. parenthetical (optional)
        // if (el.parenthetical) {
        //   lines.push(`(${el.parenthetical})`);
        //   lineMap.push({id: el.id, type: el.type, field: "parenthetical"});
        // }

        // 3. actual text (can wrap)
        lines.push(el.text);
        lineMap.push({id: el.id, type: el.type, field: "text"});
        break;

      case "transition":
      case "scene_heading":
      case "action":
        lines.push(el.text);
        lineMap.push({id: el.id, type: el.type, field: "text"});
        break;
    }

    // blank line between blocks
    lines.push("");
    lineMap.push(null);
  });

  return {text: lines.join("\n"), lineMap};
}
