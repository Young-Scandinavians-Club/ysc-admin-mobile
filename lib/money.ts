/** Pull the editable dollar amount out of a total label for a prefilled field:
 *  "2 tickets · $40.00" → "40.00", "1 ticket ($40.00+)" → "40.00", "$90" → "90".
 *  Takes the run of digits/dot after the last "$" so ticket counts in the
 *  label never leak into the amount. */
export function amountLabelToInput(label: string): string {
  const dollar = label.lastIndexOf('$');
  const tail = dollar === -1 ? label : label.slice(dollar + 1);
  return (tail.match(/[0-9.]+/)?.[0] ?? '').replace(/\.(?=.*\.)/g, '');
}

/** "90" / "90.5" → 9000 / 9050 cents; blank or nonsense → null (omit the field). */
export function dollarsToCents(input: string): number | null {
  const n = Number.parseFloat(input);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
