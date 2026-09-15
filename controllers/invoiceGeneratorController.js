const invoiceGeneratorService = require("../services/invoiceGeneratorService");

class InvoiceGeneratorController {

    async generatePdf(req, res) {

        try {

            const { pdfBytes, invoiceData } = await invoiceGeneratorService.buildInvoicePdf(req.body);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${invoiceData.invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`
            );
            res.send(Buffer.from(pdfBytes));

        } catch (err) {

            // validateAndBuildInvoiceData only ever throws plain, safe
            // validation messages (see invoiceGeneratorService.js) — same
            // pattern as contactController. Anything else (pdf-lib itself
            // failing) gets a generic message instead of leaking internals.
            const isValidationError = err instanceof Error && !err.stack?.includes("pdf-lib");

            console.log("Invoice generator PDF error:", err);

            res.status(400).json({
                success: false,
                error: isValidationError
                    ? err.message
                    : "Couldn't generate the PDF right now. Please try again.",
            });

        }

    }

}

module.exports = new InvoiceGeneratorController();
