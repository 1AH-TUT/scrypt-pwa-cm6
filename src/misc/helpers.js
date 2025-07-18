

/** Convert an ISO yyyy-mm-dd string into something readable, localised. */
export function prettyDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(navigator.languages, {
    day:   'numeric',
    month: 'short',
    year:  'numeric'
  });
}