// National-number length bounds once the dial code is stripped off — 6
// covers the shortest real national numbers (a handful of small
// countries), 14 leaves room for the longest (E.164 allows up to 15
// digits total, minus at least 1 for the shortest dial code).
const MOBILE_DIGITS_PATTERN = /^[0-9]{6,14}$/;

// Accepts digits plus the punctuation people naturally type/paste in a
// phone field (spaces, hyphens, parentheses, a leading +) and rejects
// anything else (letters, other symbols) up front.
const ALLOWED_INPUT_PATTERN = /^[0-9+\-\s()]+$/;

// Normalizes a raw mobile-number input against the already-validated
// country dial code, returning digits only (no country code, no
// formatting) so it can be stored alongside country_code without
// duplicating it. Throws on anything empty, malformed, or that carries a
// country code which doesn't match the one the user selected.
function normalizeMobileNumber(countryCode, rawMobileNumber) {
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

  if (!MOBILE_DIGITS_PATTERN.test(digits)) {
    throw new Error("Please enter a valid mobile number.");
  }

  return digits;
}

module.exports = { normalizeMobileNumber };
