/** Official ECB reference rates: units of each currency per 1 EUR. */
export type FxTable = {
  date: string;
  perEur: Record<string, number>;
};

export function convert(
  amount: number,
  from: string,
  to: string,
  table: FxTable,
): number | null {
  const fromRate = table.perEur[from.toUpperCase()];
  const toRate = table.perEur[to.toUpperCase()];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

export function supportedCurrencies(table: FxTable | null) {
  return table ? Object.keys(table.perEur).sort() : ["CHF", "EUR", "GBP", "USD"];
}

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1_000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en")}`;
  }
}
