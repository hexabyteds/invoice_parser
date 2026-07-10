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

        const json = JSON.parse(text);

        if (Array.isArray(json)) {

            return json;

        }

        return json;

    }

    async extractInvoice(imagePath) {

        try {

            const image = fs.readFileSync(imagePath);

            const mimeType = this.getMimeType(imagePath);

            const prompt = `
            You are an expert AI specialized in invoice extraction.
            
            The uploaded file may be:
            
            1. A single invoice image (JPG, PNG, JPEG)
            OR
            2. A PDF containing one or more invoice pages.
            
            IMPORTANT RULES
            
            • If the file contains ONE invoice, return ONE JSON object.
            
            • If the PDF contains MULTIPLE invoices (one invoice per page), treat EACH PAGE as a separate invoice and return a JSON ARRAY.
            
            • Do NOT merge invoices from different pages.
            
            • Read every page carefully.
            
            • Extract ALL visible line items.
            
            • Preserve full product descriptions.
            
            • Do not skip rows.
            
            • Ignore logos, watermarks, stamps and signatures.
            
            • Return ONLY valid JSON.
            
            • No markdown.
            
            • No explanation.
            
            • Numbers must not contain currency symbols or commas.
            
            • Dates should be YYYY-MM-DD whenever possible.
            
            • If a value is missing:
            
            Strings => ""
            
            Numbers => 0
            
            lineItems => []
            
            Single invoice format:
            
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
            
            If there are multiple invoices, return:
            
            [
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
            ]
            
            Return ONLY valid JSON.
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