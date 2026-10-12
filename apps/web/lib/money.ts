/** Money is stored as integer paisa. These convert at the UI edge only. */
export const formatTaka = (paisa: number) =>
  `৳${(paisa / 100).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "1500" or "1,500.50" → 150000 paisa; null when not a valid non-negative amount. */
export function takaToPaisa(input: string): number | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
