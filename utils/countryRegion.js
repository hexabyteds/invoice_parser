// Resolves one of this app's country names (utils/countries.js) to the
// ISO 3166-1 alpha-2 region code google-libphonenumber needs (it validates
// by region, not by dial code — several countries share a dial code, e.g.
// +1). i18n-iso-countries covers 186 of the 194 names verbatim; the
// remaining 8 use a slightly different canonical English name than this
// app's list — verified by hand (see the comment on each).
const isoCountries = require("i18n-iso-countries");
isoCountries.registerLocale(require("i18n-iso-countries/langs/en.json"));

const REGION_OVERRIDES = {
  "Brunei": "BN", // isoCountries' canonical name: "Brunei Darussalam"
  "Cabo Verde": "CV", // "Cape Verde"
  "Congo (Congo-Brazzaville)": "CG", // "Republic of the Congo"
  "Laos": "LA", // "Lao People's Democratic Republic"
  "Micronesia": "FM", // "Micronesia, Federated States of"
  "Moldova": "MD", // "Moldova, Republic of"
  "Syria": "SY", // "Syrian Arab Republic"
  "Vatican City": "VA", // "Holy See (Vatican City State)"
};

// Verified once (scripts/verify below is illustrative, not run at
// runtime) that every name in utils/countries.js resolves to a region
// google-libphonenumber actually has metadata for.
function getRegionCodeForCountryName(name) {
  if (!name) return null;
  return REGION_OVERRIDES[name] || isoCountries.getAlpha2Code(name, "en") || null;
}

module.exports = { getRegionCodeForCountryName };
