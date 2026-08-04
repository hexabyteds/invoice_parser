// The UAE Dirham has been hard-pegged to the US Dollar at this exact rate
// since 1997 (it doesn't float), so this conversion is exact, not an
// estimate. Plan prices are stored in USD in the database; AED is derived
// here at display time only so admin/billing logic keeps using the stored
// USD figures untouched.
const USD_TO_AED = 3.6725;

export function usdToAed(usdAmount) {
  const value = Number(usdAmount) || 0;
  return Math.round(value * USD_TO_AED);
}

export function formatAed(usdAmount) {
  return `AED ${usdToAed(usdAmount).toLocaleString()}`;
}

export function formatUsd(usdAmount) {
  return `$${Number(usdAmount).toLocaleString()}`;
}
