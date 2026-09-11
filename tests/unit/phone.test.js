const { normalizeMobileNumber } = require("../../utils/phone");

describe("normalizeMobileNumber — real per-country mobile validation (google-libphonenumber)", () => {
  it("accepts a real Pakistani mobile number (starts with 3)", () => {
    expect(normalizeMobileNumber("+92", "3001234567", "Pakistan")).toBe("3001234567");
  });

  it("rejects a Pakistani number that doesn't start with 3", () => {
    expect(() => normalizeMobileNumber("+92", "2001234567", "Pakistan")).toThrow(
      /valid mobile number for Pakistan/i
    );
  });

  it("accepts a real UAE mobile number (starts with 5)", () => {
    expect(normalizeMobileNumber("+971", "501234567", "United Arab Emirates")).toBe(
      "501234567"
    );
  });

  it("rejects a UAE landline number (not a mobile prefix)", () => {
    expect(() =>
      normalizeMobileNumber("+971", "42345678", "United Arab Emirates")
    ).toThrow(/valid mobile number for United Arab Emirates/i);
  });

  it("accepts a real Saudi mobile number (also starts with 5)", () => {
    expect(normalizeMobileNumber("+966", "501234567", "Saudi Arabia")).toBe("501234567");
  });

  it("accepts a real US number typed with the country code included", () => {
    expect(
      normalizeMobileNumber("+1", "+12025551234", "United States")
    ).toBe("2025551234");
  });

  it("rejects a number whose embedded country code doesn't match the selected country", () => {
    expect(() =>
      normalizeMobileNumber("+92", "+971501234567", "Pakistan")
    ).toThrow(/country code does not match/i);
  });

  it("rejects garbage input with a clean error, not a library exception", () => {
    expect(() => normalizeMobileNumber("+92", "not-a-number", "Pakistan")).toThrow(
      /invalid characters/i
    );
  });

  it("rejects an empty mobile number", () => {
    expect(() => normalizeMobileNumber("+92", "", "Pakistan")).toThrow(/required/i);
  });

  it("rejects when the country can't be resolved to a region", () => {
    expect(() =>
      normalizeMobileNumber("+92", "3001234567", "Not A Real Country")
    ).toThrow(/valid country/i);
  });
});
