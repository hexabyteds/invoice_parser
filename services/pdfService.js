const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

class PDFService {

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
            fs.mkdirSync(dir);
        }

        for (let i = 0; i < pages; i++) {

            const newPdf = await PDFDocument.create();

            const [page] = await newPdf.copyPages(pdf, [i]);

            newPdf.addPage(page);

            const bytes = await newPdf.save();

            const file = path.join(dir, `page-${i + 1}.pdf`);

            fs.writeFileSync(file, bytes);

            output.push(file);
        }

        return output;
    }

}

module.exports = new PDFService();