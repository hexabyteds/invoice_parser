// country-state-city ships a worldwide dataset (~8MB unminified) — eagerly
// importing it bloated the main bundle from ~1.4MB to ~9.5MB, downloaded by
// every user on first load even if they never touch a Customer/Supplier
// form. Dynamically imported instead, so it only loads (as its own chunk)
// the first time a city dropdown is actually opened.
//
// We deliberately don't use this package's own country list as the
// dropdown source — the app already has one canonical country list shared
// with the phone/dial-code UI (constants/countries.js), and diverging
// would let the two dropdowns disagree. This module only borrows its city
// data, bridged by name match.

let modulePromise = null;
let nameToIsoPromise = null;
const cityCache = new Map();

function loadPackage() {
  if (!modulePromise) {
    modulePromise = import("country-state-city");
  }
  return modulePromise;
}

async function getNameToIso() {
  if (!nameToIsoPromise) {
    nameToIsoPromise = loadPackage().then(
      ({ Country }) =>
        new Map(Country.getAllCountries().map((c) => [c.name.toLowerCase(), c.isoCode]))
    );
  }
  return nameToIsoPromise;
}

// Resolves to a sorted, deduped list of city names for a country name (as
// found in COUNTRIES). Empty array (not an error) for a country with no
// data in the underlying package, or none selected yet — callers should
// treat an empty list as "no cities available" and fall back gracefully.
export async function getCitiesForCountry(countryName) {
  if (!countryName) return [];

  if (cityCache.has(countryName)) {
    return cityCache.get(countryName);
  }

  const [{ City }, nameToIso] = await Promise.all([loadPackage(), getNameToIso()]);

  const isoCode = nameToIso.get(String(countryName).toLowerCase());
  const cities = isoCode ? City.getCitiesOfCountry(isoCode) || [] : [];

  const names = [...new Set(cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b));

  cityCache.set(countryName, names);
  return names;
}
