/**
 * When each row arrives: the time it names, else a stagger after the row before
 * it. A row with no `at` counts on from the previous row's start, so pinning the
 * first few rows to words and leaving the rest to the stagger keeps them in
 * order — a row can never arrive before the one above it by accident.
 */
export const rowStarts = (rows: { at?: number }[], stagger: number): number[] => {
  const out: number[] = [];
  rows.forEach((row, i) => {
    out.push(row.at !== undefined ? row.at : i === 0 ? 0 : out[i - 1] + stagger);
  });
  return out;
};
