const request = require("supertest");
const app = require("../../app-backend");

let userCounter = 0;

function uniqueEmail(prefix = "user") {
  userCounter += 1;
  return `${prefix}${Date.now()}${userCounter}@example.test`;
}

async function registerAndLogin(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || "Password123!";

  const res = await request(app).post("/api/auth/register").send({
    name: overrides.name || "Test User",
    email,
    password,
    company_name: overrides.company_name,
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
  registerAndLogin,
  loginAsAdmin,
  authed,
};
