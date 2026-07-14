const ngnFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNGN(amount: number): string {
  return ngnFormatter.format(amount);
}
