// Formats a "YYYY-MM-DD" (or any string starting with one) into DD/MM/YYYY
// by slicing the string directly, never constructing a Date object.
// `new Date(dateOnlyString)` + toLocaleDateString()/toISOString() reinterprets
// a plain calendar date through a timezone, which silently shifts it by a day
// whenever the server's and browser's UTC offsets don't cancel out.
export function formatDateDisplay(dateValue) {
  if (!dateValue) return "-";

  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "-";

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
