export const SCRYPT_LINES_PER_PAGE = 56
export const TOP_MARGIN_LINES = 4
export const BOTTOM_MARGIN_LINES = 4
export const MAX_CHARS_PER_LINE = 61
export const MAX_CHARS_PER_DIALOGUE_LINE = 35

export const DEFAULT_OPTIONS = {
  transition: [
    "CUT TO:", "DISSOLVE TO:", "SMASH CUT TO:", "MATCH CUT TO:",
    "FADE IN:", "FADE OUT:", "WIPE TO:", "JUMP CUT TO:"
  ],
  indicator: ["INT.", "EXT.", "INT./EXT."],
  time: ["DAY", "NIGHT", "DAWN", "DUSK", "CONTINUOUS", "LATER"],
};

const blankTemplate = {
  titlePage: { title: '', byline: '', date:'', source:'', copyright:'', contact:'' },
  data: { scenes: [
      { id:'s0', elements:[{"type": "transition", "text": "FADE IN:", "id": "se1" },] },
      { id:'s1', elements:[{"type": "scene_heading", "indicator": "INT.","location": "","time": "", "text": "INT.", "id": "se2" },] },
    ] },
  metaData: { schemaVer:'0.1', nextId:3 }
};

export const UIstrings = {
  contd: ' (Cont’d)',
}
export const getBlankTemplate = () => { return structuredClone(blankTemplate) };