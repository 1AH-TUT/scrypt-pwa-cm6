import { EditorView } from "@codemirror/view";

/** @typedef { import("../controllers/editor-controller").EditorController } EditorController */


/* helpers */
let pendingTailTask = false; // debounce flag

function checkVisibility(view, firstPos, lastPos, margin) {
  const scrollerRect = view.scrollDOM.getBoundingClientRect();
  const vTop= view.scrollDOM.scrollTop;
  const vBot= vTop + view.scrollDOM.clientHeight;

  const headTop = view.coordsAtPos(firstPos)?.top ?? 0;
  const tailBottom= view.coordsAtPos(lastPos , -1)?.bottom ?? 0;

  // Translate from viewport to scrollDOM space
  const headTopInScroller= headTop - scrollerRect.top + vTop;
  const tailBottomScroller= tailBottom - scrollerRect.top + vTop;

  return {
    needsHeadScroll: headTopInScroller < vTop + margin,
    needsTailScroll: tailBottomScroller > vBot - margin
  };
}

/**
 * @function ensureElementFullyVisible
 *
 * Scrolls the editor just enough to guarantee that every visual line belonging to `elementId` is fully inside the viewport,
 * leaving exactly one blank-line of padding on whichever edge becomes visible.
 *
 * 1. Primary nudge: immediately calls `scrollIntoView(firstPos, "nearest")` so the element’s head is on-screen as soon as possible.
 * 2. Secondary check: after CM has finished the first scroll:
 *    - re-measure the element’s head and tail relative to the scroller
 *    - if either edge is still clipped by more than `margin` pixels, dispatch a second `scrollIntoView`
 *    - if both edges are clipped (element taller than viewport) fallback to centring the element
 *
 * Debounce: `pendingTailTask` ensures at most one micro-task is queued at a time, so rapid caret movement doesn't flood the event loop
 *
 * Parameters
 * @param { EditorView } view  active CodeMirror view
 * @param { EditorController } controller active editor controller
 * @param { string } elementId id of the element to reveal
 * @param { "up"|"down"|"none" } [dir] hint indicating the direction the caret moved
 */
export function ensureElementFullyVisible(view, controller, elementId, dir = "down") {
  const pos = controller.elementPositions[elementId];
  if (!pos) return;

  const doc = view.state.doc;
  let margin = view.defaultLineHeight || 19;
  if (elementId === controller.getLastElementId()) margin += 250;  // if last element, bump margin to include insert bar

  const firstPos = doc.line(pos.start + 1).from;
  const lastPos= doc.line(pos.end + 1).to - 1;

  // Nudge top into view
  console.debug("ensureElementFullyVisible - initial nudge")
  view.dispatch({ effects: EditorView.scrollIntoView(firstPos, { y: "nearest", yMargin: margin }) });

  // After the above scroll settles, see if the bottom/top still hangs out & scroll again if required
  if (!pendingTailTask) {
    pendingTailTask = true;
    queueMicrotask(() => {
      pendingTailTask = false;
      if (view.destroyed) return; // in case user closed view before microtask executes

      const { needsHeadScroll, needsTailScroll} = checkVisibility(view, firstPos, lastPos, margin);

      if (needsHeadScroll && !needsTailScroll) {
        // head is off-screen (or user Shift-Tabbed up)
        view.dispatch({ effects: EditorView.scrollIntoView(firstPos, { y: "start", yMargin: margin }) });
      } else if (needsTailScroll && !needsHeadScroll) {
        // tail is off-screen (or user Tabbed down)
        view.dispatch({ effects: EditorView.scrollIntoView(lastPos, { y: "end", yMargin: margin }) });
      } else if (needsHeadScroll && needsTailScroll) {
        // block is taller than viewport – fallback to centre
        const mid = Math.round((firstPos + lastPos) / 2);
        view.dispatch({ effects: EditorView.scrollIntoView(mid, { y: "center" }) });
      }
    });
  }
}
