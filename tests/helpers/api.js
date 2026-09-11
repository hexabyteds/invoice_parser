const request = require("supertest");
const app = require("../../app-backend");

let userCounter = 0;

function uniqueEmail(prefix = "user") {
  userCounter += 1;
  return `${prefix}${Date.now()}${userCounter}@example.test`;
}

let mobileCounter = 0;

// "300" is a real Pakistani mobile prefix (verified against
// google-libphonenumber — see utils/phone.js) — registration now
// validates real per-country mobile formats, so this can no longer be an
// arbitrary digit string starting with "3" the way it used to be.
function uniqueMobileNumber() {
  mobileCounter += 1;
  return `300${String(Date.now()).slice(-4)}${String(mobileCounter).padStart(3, "0")}`;
}

// "50" is a real UAE/Saudi mobile prefix — for the handful of tests that
// specifically register a Gulf-region account.
function uniqueGulfMobileNumber() {
  mobileCounter += 1;
  return `50${String(Date.now()).slice(-5)}${String(mobileCounter).padStart(2, "0")}`;
}

// A US NANP number needs its exchange digits (positions 4-6) to not start
// with 0/1 — "202" (Washington DC) + an exchange starting from 2 keeps
// this a valid, real US number shape.
function uniqueUsMobileNumber() {
  mobileCounter += 1;
  return `202${String(2000000 + mobileCounter).slice(-7)}`;
}

async function registerAndLogin(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || "Password123!";

  // Defaults to a COMPANY account so a test user gets its own workspace by
  // default, matching what every test written before the tenancy model
  // already assumes (the user owns whatever it creates). Pass
  // account_type: "FREELANCER" explicitly for tests that need one.
  const accountType = overrides.account_type || "COMPANY";

  const res = await request(app).post("/api/auth/register").send({
    name: overrides.name || "Test User",
    email,
    password,
    account_type: accountType,
    company_name: accountType === "COMPANY"
      ? (overrides.company_name || "Test Co")
      : overrides.company_name,
    country: overrides.country || "Pakistan",
    country_code: overrides.country_code || "+92",
    mobile_number: overrides.mobile_number || uniqueMobileNumber(),
  });

  if (res.status !== 201) {
    throw new Error(
      `registerAndLogin failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }

  return {
    token: res.body.token,
    user: res.body.user,
    email,
    password,
  };
}

async function loginAsAdmin() {
  const res = await request(app).post("/api/auth/login").send({
    email: process.env.QA_ADMIN_EMAIL,
    password: process.env.QA_ADMIN_PASSWORD,
  });

  if (res.status !== 200) {
    throw new Error(
      `loginAsAdmin failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }

  return {
    token: res.body.token,
    user: res.body.user,
  };
}

function authed(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  app,
  request,
  uniqueEmail,
  uniqueMobileNumber,
  uniqueGulfMobileNumber,
  uniqueUsMobileNumber,
  registerAndLogin,
  loginAsAdmin,
  authed,
};
