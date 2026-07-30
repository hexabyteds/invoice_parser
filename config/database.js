const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // DATE columns (invoice_date, due_date) have no time-of-day component.
    // Without this, mysql2 converts them to JS Date objects anchored at
    // server-local midnight, which then serialize to a UTC ISO string one
    // calendar day earlier whenever the server's UTC offset is positive —
    // returning them as plain strings avoids that timezone round-trip entirely.
    dateStrings: ["DATE"]
});

module.exports = pool;