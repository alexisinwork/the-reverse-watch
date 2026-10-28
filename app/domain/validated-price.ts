/** Standardized assertions avoid guessing a currency from "$". */
export function parseObservedPrice(value: string) {
  const match = /^(USD|EUR|GBP|CHF)\s+(\d{1,9}(?:\.\d{1,2})?)$/.exec(
    value.trim().toUpperCase(),
  );
  if (!match) return null;
  const amount = Number(match[2]);
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000
    ? { amount, currency: match[1]! }
    : null;
}

/** The passage must explicitly state a price, amount and ISO currency. */
export function quoteSupportsObservedPrice(value: string, quote: string) {
  const price = parseObservedPrice(value);
  if (!price || !/\b(price|retail|msrp|rrp|asking|market)\b/i.test(quote))
    return false;
  const expressions = [
    ...quote.matchAll(/\b(USD|EUR|GBP|CHF)\s+([\d,]+(?:\.\d{1,2})?)\b/gi),
  ];
  return expressions.some(
    (match) =>
      match[1]!.toUpperCase() === price.currency &&
      Number(match[2]!.replaceAll(",", "")) === price.amount,
  );
}
