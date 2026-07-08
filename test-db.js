const db = require("./config/database");

async function test() {
    try {
        const [rows] = await db.query("SELECT * FROM invoice_items;");

        console.log(rows);

        console.log("✅ MySQL Connected");
    } catch (err) {
        console.error(err);
    }

    process.exit();
}

test();