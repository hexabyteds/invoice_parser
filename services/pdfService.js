const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

class PDFService {

    async getPageCount(pdfPath) {

        const pdfBytes = fs.readFileSync(pdfPath);
        const pdf = await PDFDocument.load(pdfBytes);

        return pdf.getPageCount();
    }

    /**
     * Permanent one-page PDFs: uploads/<basename>/invoice-N.pdf
     */
    async split(pdfPath) {

        const pdfBytes = fs.readFileSync(pdfPath);

        const pdf = await PDFDocument.load(pdfBytes);

        const pages = pdf.getPageCount();

        const output = [];

        const dir = path.join(
            path.dirname(pdfPath),
            path.basename(pdfPath, ".pdf")
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        for (let i = 0; i < pages; i++) {

            const newPdf = await PDFDocument.create();

            const [page] = await newPdf.copyPages(pdf, [i]);

            newPdf.addPage(page);

            const bytes = await newPdf.save();

            const file = path.join(dir, `invoice-${i + 1}.pdf`);

            fs.writeFileSync(file, bytes);

            output.push(file);
        }

        return output;
    }

    pageFileAt(pageFiles, pageIndex) {
        if (!pageFiles?.length) {
            return null;
        }
        const i = Math.min(
            Math.max(0, pageIndex),
            pageFiles.length - 1
        );
        return pageFiles[i];
    }

    /**
     * Build multi-page PDF chunks for Gemini (fewer API calls than 1/page).
     * Returns temp file paths; caller should cleanup when done.
     */
    async buildChunks(pdfPath, chunkSize = 8) {

        const pdfBytes = fs.readFileSync(pdfPath);
        const pdf = await PDFDocument.load(pdfBytes);
        const totalPages = pdf.getPageCount();

        const dir = path.join(
            path.dirname(pdfPath),
            `${path.basename(pdfPath, ".pdf")}_chunks`
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const chunks = [];

        for (let start = 0; start < totalPages; start += chunkSize) {

            const end = Math.min(start + chunkSize, totalPages);
            const newPdf = await PDFDocument.create();
            const indices = [];

            for (let i = start; i < end; i++) {
                indices.push(i);
            }

            const copiedPages = await newPdf.copyPages(pdf, indices);
            copiedPages.forEach((page) => newPdf.addPage(page));

            const bytes = await newPdf.save();
            const file = path.join(dir, `pages-${start + 1}-${end}.pdf`);

            fs.writeFileSync(file, bytes);

            chunks.push({
                file,
                pageStart: start + 1,
                pageEnd: end,
            });
        }

        return {
            chunks,
            tempDir: dir,
            totalPages,
        };
    }

    cleanupDir(dirPath) {

        if (!dirPath || !fs.existsSync(dirPath)) {
            return;
        }

        for (const name of fs.readdirSync(dirPath)) {
            fs.unlinkSync(path.join(dirPath, name));
        }

        fs.rmdirSync(dirPath);
    }

}

module.exports = new PDFService();
