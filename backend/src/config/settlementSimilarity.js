// Long names only: at most two edits, >=80% similarity, and a 5-point
// separation for unique identity. Short place names require exact matching.
export const SETTLEMENT_FUZZY = { minimumLength: 8, maximumEdits: 2, minimumSimilarity: 0.8, identityMargin: 0.05 };
export function settlementSimilarity(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  const distance = previous[b.length];
  return { distance, score: Math.max(a.length, b.length) ? 1 - distance / Math.max(a.length, b.length) : 1 };
}
