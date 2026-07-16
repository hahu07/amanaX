// docs/implementation_plan.md §3.6: amounts are Daml Decimal (10dp)
// internally, display-formatted to 2dp here — the display boundary, not
// the storage precision. Whole-NGN amounts (every prior milestone's) still
// render cleanly since Intl.NumberFormat only pads with zeros; this only
// starts to matter from Milestone 7 on, where pro-rata distribution shares
// are genuinely fractional.
const ngnFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNGN(amount: number): string {
  return ngnFormatter.format(amount);
}
