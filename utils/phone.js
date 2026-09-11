// Real mobile-number validation via Google's libphonenumber (the same
// metadata Android/Google Contacts uses) instead of a generic digit-count
// regex — enforces each country's actual mobile prefix rules (e.g.
// Pakistan mobile numbers start with 3, UAE with 5) without hand-coding a
// rule per country: the library's per-region metadata already knows this.
const { PhoneNumberUtil, PhoneNumberType } = require("google-libphonenumber");
const { getRegionCodeForCountryName } = require("./countryRegion");

const phoneUtil = PhoneNumberUtil.getInstance();

// Accepts digits plus the punctuation people naturally type/paste in a
// phone field (spaces, hyphens, parentheses, a leading +) and rejects
// anything else (letters, other symbols) up front.
const ALLOWED_INPUT_PATTERN = /^[0-9+\-\s()]+$/;

const MOBILE_TYPES = new Set([
  PhoneNumberType.MOBILE,
  // Many regions' numbering plans can't distinguish mobile from fixed-line
  // by prefix alone — libphonenumber reports those as this instead of
  // MOBILE. Rejecting them would incorrectly block real mobile numbers in
  // those countries.
  PhoneNumberType.FIXED_LINE_OR_MOBILE,
]);

// Normalizes a raw mobile-number input against the already-validated
// country dial code, returning digits only (no country code, no
// formatting) so it can be stored alongside country_code without
// duplicating it. Throws on anything empty, malformed, carrying a country
// code which doesn't match the one the user selected, or that isn't a
// genuine mobile number for the selected country.
function normalizeMobileNumber(countryCode, rawMobileNumber, countryName) {
  if (
    !rawMobileNumber ||
    typeof rawMobileNumber !== "string" ||
    !rawMobileNumber.trim()
  ) {
    throw new Error("Mobile number is required.");
  }

  const trimmed = rawMobileNumber.trim();

  if (!ALLOWED_INPUT_PATTERN.test(trimmed)) {
    throw new Error("Mobile number contains invalid characters.");
  }

  let digits = trimmed.replace(/[()\-\s]/g, "");

  if (digits.startsWith("+")) {
    const dialDigits = String(countryCode).replace(/\D/g, "");
    const candidateDigits = digits.replace(/\D/g, "");

    if (!candidateDigits.startsWith(dialDigits)) {
      throw new Error(
        "Mobile number's country code does not match the selected country."
      );
    }

    digits = candidateDigits.slice(dialDigits.length);
  }

  const regionCode = getRegionCodeForCountryName(countryName);

  if (!regionCode) {
    throw new Error("Please select a valid country.");
  }

  let parsed;

  try {
    parsed = phoneUtil.parse(digits, regionCode);
  } catch (err) {
    throw new Error("Please enter a valid mobile number.");
  }

  const isMobile =
    phoneUtil.isValidNumberForRegion(parsed, regionCode) &&
    MOBILE_TYPES.has(phoneUtil.getNumberType(parsed));

  if (!isMobile) {
    throw new Error(
      `Please enter a valid mobile number for ${countryName}.`
    );
  }

  return phoneUtil.getNationalSignificantNumber(parsed);
}

module.exports = { normalizeMobileNumber };
