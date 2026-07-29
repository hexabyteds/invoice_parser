const { GoogleGenAI, Type } = require("@google/genai");
const fs = require("fs");
const path = require("path");

// How long to wait for one Gemini call before aborting it (GEM-04) —
// referenced by callGeminiWithRetry via AbortController/setTimeout.
const GEMINI_TIMEOUT_MS =
    Number(process.env.GEMINI_TIMEOUT_MS) || 60000;

class GeminiService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured");
        }

        this.ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        this.model = "gemini-2.5-flash";

        // gemini-2.5-flash's documented output ceiling is 65,536 tokens.
        // The old hardcoded 8192 was well below that and could silently
        // truncate a densely-packed multi-invoice PDF chunk's JSON output
        // (see the finishReason === "MAX_TOKENS" check in
        // callGeminiWithRetry for how a truncation that still happens is
        // now surfaced distinctly instead of looking like a parse error).
        // Configurable in case a future model's limit differs.
        this.maxOutputTokens =
            Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 65536;

        // Retry configuration
        this.maxRetries = 4;
        this.initialRetryDelay = 1000; // 1 second
        this.maxRetryDelay = 30000; // 30 seconds

        // Current Gemini 2.5 Flash standard pricing
        // $0.30 / 1M input tokens
        // $2.50 / 1M output tokens
        this.inputPricePerMillion = 0.30;
        this.outputPricePerMillion = 2.50;
    }

    /**
     * Detect MIME type
     */
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
                throw new Error(`Unsupported file type: ${ext}`);
        }
    }

    /**
     * JSON schema for one invoice
     */
    getInvoiceSchema() {
        return {
            type: Type.OBJECT,

            properties: {
                vendorName: {
                    type: Type.STRING,
                    description: "Vendor or supplier name"
                },

                invoiceNumber: {
                    type: Type.STRING,
                    description: "Invoice number"
                },

                invoiceDate: {
                    type: Type.STRING,
                    description: "Invoice date in YYYY-MM-DD format when possible"
                },

                dueDate: {
                    type: Type.STRING,
                    description: "Due date in YYYY-MM-DD format when possible"
                },

                trn: {
                    type: Type.STRING,
                    description: "UAE Tax Registration Number"
                },

                phone: {
                    type: Type.STRING,
                    description: "Vendor phone number"
                },

                email: {
                    type: Type.STRING,
                    description: "Vendor email address"
                },

                address: {
                    type: Type.STRING,
                    description: "Vendor address"
                },

                currency: {
                    type: Type.STRING,
                    description: "Invoice currency, for example AED"
                },

                subtotal: {
                    type: Type.NUMBER,
                    description: "Invoice subtotal before VAT"
                },

                vatRate: {
                    type: Type.NUMBER,
                    description: "VAT percentage"
                },

                vat: {
                    type: Type.NUMBER,
                    description: "VAT amount"
                },

                total: {
                    type: Type.NUMBER,
                    description: "Final invoice total"
                },

                lineItems: {
                    type: Type.ARRAY,

                    items: {
                        type: Type.OBJECT,

                        properties: {
                            description: {
                                type: Type.STRING,
                                description: "Full product or service description"
                            },

                            qty: {
                                type: Type.NUMBER,
                                description: "Quantity"
                            },

                            unitPrice: {
                                type: Type.NUMBER,
                                description: "Unit price"
                            },

                            amount: {
                                type: Type.NUMBER,
                                description: "Line total amount"
                            }
                        },

                        required: [
                            "description",
                            "qty",
                            "unitPrice",
                            "amount"
                        ]
                    }
                }
            },

            required: [
                "vendorName",
                "invoiceNumber",
                "invoiceDate",
                "dueDate",
                "trn",
                "phone",
                "email",
                "address",
                "currency",
                "subtotal",
                "vatRate",
                "vat",
                "total",
                "lineItems"
            ]
        };
    }

    /**
     * Schema for one or multiple invoices.
     *
     * Always returns an object:
     *
     * {
     *   "invoices": [...]
     * }
     */
    getResponseSchema() {
        return {
            type: Type.OBJECT,

            properties: {
                invoices: {
                    type: Type.ARRAY,
                    items: this.getInvoiceSchema()
                }
            },

            required: ["invoices"]
        };
    }

    /**
     * Main invoice extraction prompt
     */
    getPrompt() {
        return `
You are an expert AI specialized in invoice extraction.

The uploaded file may be:

1. A single invoice image (JPG, PNG, JPEG)
OR
2. A PDF containing one or more invoice pages.

IMPORTANT RULES:

- If the file contains ONE invoice, return one object inside the "invoices" array.
- If the PDF contains MULTIPLE invoices, treat EACH invoice separately.
- Do NOT merge different invoices.
- Read every page carefully.
- Extract ALL visible line items.
- Preserve the complete product/service descriptions.
- Do not skip line-item rows.
- Ignore logos, watermarks, stamps and signatures.
- Extract only information that is visible in the document.
- Do not guess missing information.
- If a string value is missing, return "".
- If a numeric value is missing, return 0.
- If there are no line items, return [].
- Numbers must not contain currency symbols or commas.
- Dates should use YYYY-MM-DD whenever possible.
- Currency should be the actual invoice currency.
- VAT rate should be numeric, for example 5 instead of "5%".
- VAT amount should be numeric.
- Return the final result according to the provided JSON schema.

PAY SPECIAL ATTENTION TO:

- Invoice number
- Invoice date
- Due date
- Vendor name
- Vendor TRN
- Vendor phone
- Vendor email
- Vendor address
- Currency
- Subtotal
- VAT rate
- VAT amount
- Grand total
- Every line item
- Quantity
- Unit price
- Line amount

IMPORTANT:
Do not invent, estimate, or infer values that are not visible.
`;
    }

    /**
     * Extract retry delay from Gemini error.
     *
     * Example:
     * retryDelay: "29s"
     */
    getRetryDelayFromError(error) {
        try {
            const errorText =
                typeof error === "string"
                    ? error
                    : JSON.stringify(error);

            const match = errorText.match(/retryDelay["']?\s*:\s*["'](\d+)s/);

            if (match) {
                return parseInt(match[1], 10) * 1000;
            }

            // Also support:
            // Please retry in 29.987911225s
            const retryMatch = errorText.match(
                /retry in ([0-9.]+)s/i
            );

            if (retryMatch) {
                return Math.ceil(
                    parseFloat(retryMatch[1]) * 1000
                );
            }

            return null;

        } catch (e) {
            return null;
        }
    }

    /**
     * Determine if error is safe to retry
     */
    isRetryableError(error) {
        const status = error?.status || error?.code;

        // Explicit HTTP/API status
        if (
            status === 429 ||
            status === 408 ||
            status === 500 ||
            status === 502 ||
            status === 503 ||
            status === 504
        ) {
            return true;
        }

        const message = String(
            error?.message || error || ""
        ).toLowerCase();

        return (
            message.includes("resource_exhausted") ||
            message.includes("rate limit") ||
            message.includes("quota exceeded") ||
            message.includes("too many requests") ||
            message.includes("temporarily unavailable") ||
            message.includes("service unavailable")
        );
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Calculate estimated API cost
     */
    calculateCost(usage) {
        const inputTokens =
            usage?.promptTokenCount || 0;

        const outputTokens =
            usage?.candidatesTokenCount || 0;

        const cachedTokens =
            usage?.cachedContentTokenCount || 0;

        const inputCost =
            (inputTokens / 1_000_000) *
            this.inputPricePerMillion;

        const outputCost =
            (outputTokens / 1_000_000) *
            this.outputPricePerMillion;

        return {
            inputTokens,
            outputTokens,
            cachedTokens,
            inputCost: Number(inputCost.toFixed(6)),
            outputCost: Number(outputCost.toFixed(6)),
            totalCost: Number(
                (inputCost + outputCost).toFixed(6)
            )
        };
    }

    /**
     * Log token usage
     */
    logUsage(usage, duration, attempt) {
        const cost = this.calculateCost(usage);

        console.log("\n================ GEMINI USAGE ================");

        console.log(`Model: ${this.model}`);

        console.log(`Attempt: ${attempt}`);

        console.log(
            `Duration: ${(duration / 1000).toFixed(2)} seconds`
        );

        console.log(
            `Input tokens: ${cost.inputTokens.toLocaleString()}`
        );

        console.log(
            `Output tokens: ${cost.outputTokens.toLocaleString()}`
        );

        console.log(
            `Cached tokens: ${cost.cachedTokens.toLocaleString()}`
        );

        console.log(
            `Estimated input cost: $${cost.inputCost}`
        );

        console.log(
            `Estimated output cost: $${cost.outputCost}`
        );

        console.log(
            `Estimated request cost: $${cost.totalCost}`
        );

        console.log("===============================================\n");

        return cost;
    }

    /**
     * Call Gemini with automatic retry
     */
    async callGeminiWithRetry(contents) {
        let lastError = null;
    
        for (
            let attempt = 1;
            attempt <= this.maxRetries + 1;
            attempt++
        ) {
            const startTime = Date.now();
    
            // Abort Gemini request if it takes too long
            const controller = new AbortController();
    
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, GEMINI_TIMEOUT_MS);
    
            try {
                console.log(
                    `[Gemini] Request attempt ${attempt}/${this.maxRetries + 1}`
                );
    
                const response =
                    await this.ai.models.generateContent({
    
                        model: this.model,
    
                        contents,
    
                        config: {
                            responseMimeType: "application/json",
    
                            responseSchema:
                                this.getResponseSchema(),
    
                            temperature: 0,
    
                            maxOutputTokens:
                                this.maxOutputTokens
                        },
    
                        // Abort the underlying request on timeout
                        signal: controller.signal
                    });
    
                const duration =
                    Date.now() - startTime;
    
                // A response can come back successfully but still be
                // truncated because it hit maxOutputTokens.
                const finishReason =
                    response.candidates?.[0]?.finishReason;
    
                if (finishReason === "MAX_TOKENS") {
    
                    const truncationError =
                        new Error(
                            `Gemini's response was cut off after hitting the ` +
                            `${this.maxOutputTokens}-token output limit ` +
                            `(likely too many invoices/line items in one ` +
                            `request). Try a smaller PDF chunk size ` +
                            `(GEMINI_PDF_CHUNK_PAGES) or a higher ` +
                            `GEMINI_MAX_OUTPUT_TOKENS.`
                        );
    
                    truncationError.code = "MAX_TOKENS";
    
                    throw truncationError;
                }
    
                const usage =
                    response.usageMetadata || {};
    
                const cost =
                    this.logUsage(
                        usage,
                        duration,
                        attempt
                    );
    
                return {
                    response,
                    usage,
                    cost
                };
    
            } catch (error) {
    
                lastError = error;
    
                // Convert AbortController timeout into a clean application error
                if (
                    error?.name === "AbortError" ||
                    controller.signal.aborted
                ) {
                    const timeoutError = new Error(
                        `Gemini request timed out after ` +
                        `${GEMINI_TIMEOUT_MS / 1000} seconds.`
                    );
    
                    timeoutError.code = "GEMINI_TIMEOUT";
    
                    lastError = timeoutError;
                    error = timeoutError;
    
                    console.error(
                        `[Gemini] Request timeout after ` +
                        `${GEMINI_TIMEOUT_MS / 1000} seconds.`
                    );
                }
    
                const status =
                    error?.status ||
                    error?.code ||
                    "UNKNOWN";
    
                console.error(
                    `[Gemini] Attempt ${attempt} failed. Status: ${status}`
                );
    
                console.error(
                    `[Gemini] ${error?.message || error}`
                );
    
                // Do not retry permanent errors
                if (!this.isRetryableError(error)) {
                    throw error;
                }
    
                // No retries left
                if (
                    attempt >
                    this.maxRetries
                ) {
                    console.error(
                        "[Gemini] Maximum retry attempts reached."
                    );
    
                    throw error;
                }
    
                /**
                 * If Google tells us exactly how long
                 * to wait, use that value.
                 */
                const serverRetryDelay =
                    this.getRetryDelayFromError(
                        error
                    );
    
                /**
                 * Otherwise use exponential backoff:
                 *
                 * 1s
                 * 2s
                 * 4s
                 * 8s
                 *
                 * with random jitter.
                 */
                let delay =
                    serverRetryDelay;
    
                if (!delay) {
    
                    const exponentialDelay =
                        Math.min(
                            this.initialRetryDelay *
                                Math.pow(
                                    2,
                                    attempt - 1
                                ),
                            this.maxRetryDelay
                        );
    
                    const jitter =
                        Math.floor(
                            Math.random() * 1000
                        );
    
                    delay =
                        exponentialDelay +
                        jitter;
                }
    
                delay = Math.min(
                    delay,
                    this.maxRetryDelay
                );
    
                console.log(
                    `[Gemini] Retrying in ${(
                        delay / 1000
                    ).toFixed(1)} seconds...`
                );
    
                await this.sleep(delay);
    
            } finally {
    
                // Always clear timeout, including successful requests
                clearTimeout(timeoutId);
            }
        }
    
        throw lastError;
    }

    /**
     * Extract invoice from image/PDF
     */
    async extractInvoice(filePath) {

        try {

            if (!fs.existsSync(filePath)) {
                throw new Error(
                    `Invoice file not found: ${filePath}`
                );
            }

            const image =
                fs.readFileSync(filePath);

            const mimeType =
                this.getMimeType(filePath);

            const prompt =
                this.getPrompt();

            console.log(
                `[Gemini] Processing file: ${path.basename(filePath)}`
            );

            console.log(
                `[Gemini] MIME type: ${mimeType}`
            );

            const contents = [

                {
                    text: prompt
                },

                {
                    inlineData: {
                        mimeType,
                        data: image.toString("base64")
                    }
                }

            ];

            const result =
                await this.callGeminiWithRetry(
                    contents
                );

            const response =
                result.response;

            /**
             * Structured output means response.text
             * should already contain valid JSON.
             */
            const text =
                response.text;

            if (!text) {
                throw new Error(
                    "Gemini returned an empty response"
                );
            }

            let parsed;

            try {

                parsed =
                    JSON.parse(text);

            } catch (parseError) {

                console.error(
                    "[Gemini] Structured JSON parsing failed."
                );

                console.error(
                    "[Gemini] Raw response:",
                    text
                );

                throw new Error(
                    "Gemini returned invalid JSON despite structured output."
                );
            }

            /**
             * We always return:
             *
             * {
             *   invoices: [...]
             * }
             */
            if (
                !parsed ||
                !Array.isArray(parsed.invoices)
            ) {
                throw new Error(
                    "Gemini response does not contain a valid invoices array."
                );
            }

            console.log(
                `[Gemini] Successfully extracted ${parsed.invoices.length} invoice(s).`
            );

            return {

                success: true,

                invoice:
                    parsed.invoices.length === 1
                        ? parsed.invoices[0]
                        : parsed.invoices,

                invoices:
                    parsed.invoices,

                usage:
                    result.usage,

                cost:
                    result.cost

            };

        } catch (err) {

            console.error(
                "[Gemini] Invoice extraction failed:"
            );

            console.error(
                err?.message || err
            );

            return {

                success: false,

                error:
                    err?.message ||
                    "Gemini invoice extraction failed",

                status:
                    err?.status ||
                    err?.code ||
                    null

            };
        }
    }
}

module.exports = new GeminiService();