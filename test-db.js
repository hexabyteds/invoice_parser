// // const db = require("./config/database");

// // async function test() {
// //     try {
// //         const [rows] = await db.query("SELECT * FROM invoice_items;");

// //         console.log(rows);

// //         console.log("✅ MySQL Connected");
// //     } catch (err) {
// //         console.error(err);
// //     }

// //     process.exit();
// // }

// // test();


// // require("dotenv").config();

// // const { generateToken, verifyToken } = require("./utils/jwt");

// // const token = generateToken({
// //     id: 1,
// //     email: "admin@test.com"
// // });

// // console.log(token);

// // console.log(verifyToken(token));


// // require("dotenv").config();

// // const userRepository = require("./repositories/userRepository");
// // const { hashPassword } = require("./utils/password");

// // async function test() {

// //     const password = await hashPassword("123456");

// //     const id = await userRepository.create({
// //         name: "Toqeer",
// //         email: "toqeer@test.com",
// //         password
// //     });

// //     console.log("Inserted:", id);

// //     const user = await userRepository.findByEmail("toqeer@test.com");

// //     console.log(user);

// //     process.exit();
// // }

// // test();



// // require("dotenv").config();

// // const authService = require("./services/authService");

// // async function test() {

// //     try {

// //         const result = await authService.register({
// //             name: "Ali",
// //             email: "ali@test.com",
// //             password: "123456"
// //         });

// //         console.log(result);

// //     } catch (err) {

// //         console.log(err.message);

// //     }

// //     process.exit();
// // }

// // test();



// require("dotenv").config();

// const authService = require("./services/authService");

// async function test() {

//     try {

//         const result = await authService.login(
//             "ali@test.com",
//             "123456"
//         );

//         console.log(result);

//     } catch (err) {

//         console.log(err.message);

//     }

//     process.exit();
// }

// test();

// require("dotenv").config();

// const { GoogleGenAI } = require("@google/genai");

// const ai = new GoogleGenAI({
//     apiKey: process.env.GEMINI_API_KEY
// });

// (async () => {
//     try {

//         const response = await ai.models.generateContent({
//             model: "gemini-2.5-flash",
//             contents: [
//                 {
//                     text: "Say Hello"
//                 }
//             ]
//         });

//         console.log(response.text);

//     } catch (err) {
//         console.log(err);
//     }
// })();



// const pdfService = require("./services/pdfService");

// (async () => {

//     const pages = await pdfService.split(
//         "./uploads/sample.pdf"
//     );

//     console.log(pages);


    
// })();

// require("dotenv").config();
// const invoiceService = require("./services/invoiceService");

// (async()=>{

//     const result = await invoiceService.extractPDF(
//         "./uploads/sample.pdf"
//     );

//     console.log(
//         JSON.stringify(result,null,2)
//     );

// })();


require("dotenv").config();

const emailService = require("./services/emailService");

async function test() {
    try {
        console.log("Testing SMTP...");
        
        console.log({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE,
            user: process.env.SMTP_USER,
            password:
                process.env.SMTP_PASSWORD
                    ? "SET"
                    : "MISSING",
        });

        // 1. Test SMTP connection
        await emailService.verifyConnection();

        // 2. Send test email
        const result = await emailService.sendEmail({
            to: "toqeer.arif786@gmail.com",

            subject: "EazeeBooks SMTP Test",

            text: `
Hello,

This is a test email from EazeeBooks.

SMTP configuration is working correctly.

Regards,
EazeeBooks
            `,

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    padding: 20px;
                ">
                    <h2>EazeeBooks SMTP Test</h2>

                    <p>
                        This is a test email from EazeeBooks.
                    </p>

                    <p>
                        SMTP configuration is working correctly.
                    </p>

                    <p>
                        Regards,<br>
                        <strong>EazeeBooks</strong>
                    </p>
                </div>
            `,
        });

        console.log("✅ Email sent successfully");
        console.log("Message ID:", result.messageId);

    } catch (error) {
        console.error("❌ Email test failed:");
        console.error(error);
    }
}

test();