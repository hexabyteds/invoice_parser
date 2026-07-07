const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

class GeminiService {
    constructor() {
        this.ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();

        switch (ext) {
            case ".png":
                return "image/png";
            case ".jpg":
            case ".jpeg":
                return "image/jpeg";
            case ".pdf":
                return "application/pdf";
            default:
                return "image/png";
        }
    }

    cleanJson(text) {

        text = text.replace(/```json/g, "");
        text = text.replace(/```/g, "");
        text = text.trim();

        return JSON.parse(text);

    }

    async extractInvoice(imagePath) {

        try {

            const image = fs.readFileSync(imagePath);

            const mimeType = this.getMimeType(imagePath);

            const prompt = `
You are an expert invoice extraction AI. Read this invoice image carefully.

Extract EVERY field below. Pay special attention to:
- Product/service line items: extract ALL rows from the items table with full descriptions
- Amounts: subtotal (before tax), VAT/tax amount, and grand total (final amount due) as separate numbers
- If VAT rate is shown (e.g. 5%), include vatRate as a number

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Use numbers only for amounts (no currency symbols)
- If a field is missing on the invoice, use "" for strings and 0 for numbers
- lineItems must include every product/service row visible on the invoice

Schema:
{
 "vendorName": "",
 "invoiceNumber": "",
 "invoiceDate": "",
 "dueDate": "",
 "trn": "",
 "phone": "",
 "email": "",
 "address": "",
 "currency": "AED",
 "subtotal": 0,
 "vatRate": 0,
 "vat": 0,
 "total": 0,
 "lineItems": [
   {
     "description": "",
     "qty": 0,
     "unitPrice": 0,
     "amount": 0
   }
 ]
}
`;

            const response = await this.ai.models.generateContent({

                model: "gemini-2.5-flash",

                contents: [

                    {
                        text: prompt
                    },

                    {
                        inlineData: {
                            mimeType,
                            data: image.toString("base64")
                        }
                    }

                ]

            });

            const invoice = this.cleanJson(response.text);

            return {
                success: true,
                invoice
            };

        } catch (err) {

            console.log(err);

            return {

                success: false,

                error: err.message

            };

        }

    }

}

module.exports = new GeminiService();