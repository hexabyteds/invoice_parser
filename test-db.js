// const db = require("./config/database");

// async function test() {
//     try {
//         const [rows] = await db.query("SELECT * FROM invoice_items;");

//         console.log(rows);

//         console.log("✅ MySQL Connected");
//     } catch (err) {
//         console.error(err);
//     }

//     process.exit();
// }

// test();


// require("dotenv").config();

// const { generateToken, verifyToken } = require("./utils/jwt");

// const token = generateToken({
//     id: 1,
//     email: "admin@test.com"
// });

// console.log(token);

// console.log(verifyToken(token));


// require("dotenv").config();

// const userRepository = require("./repositories/userRepository");
// const { hashPassword } = require("./utils/password");

// async function test() {

//     const password = await hashPassword("123456");

//     const id = await userRepository.create({
//         name: "Toqeer",
//         email: "toqeer@test.com",
//         password
//     });

//     console.log("Inserted:", id);

//     const user = await userRepository.findByEmail("toqeer@test.com");

//     console.log(user);

//     process.exit();
// }

// test();



// require("dotenv").config();

// const authService = require("./services/authService");

// async function test() {

//     try {

//         const result = await authService.register({
//             name: "Ali",
//             email: "ali@test.com",
//             password: "123456"
//         });

//         console.log(result);

//     } catch (err) {

//         console.log(err.message);

//     }

//     process.exit();
// }

// test();



require("dotenv").config();

const authService = require("./services/authService");

async function test() {

    try {

        const result = await authService.login(
            "ali@test.com",
            "123456"
        );

        console.log(result);

    } catch (err) {

        console.log(err.message);

    }

    process.exit();
}

test();