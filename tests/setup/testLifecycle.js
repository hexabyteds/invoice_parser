const pool = require("../../config/database");

afterAll(async () => {
  await pool.end();
});
