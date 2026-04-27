// Helpers over the store.commitments[] array.
//
// Commitments are economics-only (committed / called / distributions).
// They live separately from snapshot positions because managers update
// economics on a slower cadence (quarterly K-1) than they update holdings.
// Each commitment row carries an `asOfDate`; commitmentAsOf walks back to the
// most recent on or before a given date, mirroring snapshotAsOf for snapshots.

export const commitmentsForSoi = (commitments, soiId) =>
  (commitments || []).filter((c) => c.soiId === soiId);

export const sortedCommitments = (commitments, soiId) =>
  commitmentsForSoi(commitments, soiId).sort((a, b) =>
    (a.asOfDate || '') < (b.asOfDate || '') ? -1 : 1
  );

export const latestCommitment = (commitments, soiId) => {
  const sorted = sortedCommitments(commitments, soiId);
  return sorted.length ? sorted[sorted.length - 1] : null;
};

/* Pick the most recent commitment for `soiId` on or before `dateStr`
   (YYYY-MM-DD). Falls back to latestCommitment if dateStr is falsy or every
   commitment is after it. */
export const commitmentAsOf = (commitments, soiId, dateStr) => {
  if (!dateStr) return latestCommitment(commitments, soiId);
  const sorted = sortedCommitments(commitments, soiId);
  let best = null;
  for (const c of sorted) {
    if ((c.asOfDate || '') <= dateStr) best = c;
    else break;
  }
  return best || latestCommitment(commitments, soiId);
};
