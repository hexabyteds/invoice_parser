/**
 * Invoice Agent - Express Backend
 * Serves React frontend + API endpoints (Gemini-powered extraction)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const FreeInvoiceAgent = require('./free-invoice-agent');

const app = express();

// Support running behind a proxy under a sub-path (e.g. /invoice).
// Rewrites "/invoice/api/..." to "/api/..." so the API routes below still match.
app.use((req, res, next) => {
  const apiIndex = req.url.indexOf('/api/');
  if (apiIndex > 0) {
    req.url = req.url.slice(apiIndex);
  }
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve React app

// Initialize agent
const agent = new FreeInvoiceAgent();

// Upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `invoice_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  },
});

/**
 * ==================== API ENDPOINTS ====================
 */

// Health check
app.get('/api/health', async (req, res) => {
  try {

    const stats = await agent.getStats(1);

    res.json({
      status: "healthy",
      message: "Invoice Agent API",
      totalInvoices: stats.totalInvoices
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
});

// Upload and process invoice
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📸 Processing: ${req.file.filename}`);

    // Process image
    const result = await agent.processImage(req.file.path);

    if (result.status === 'success') {

      const invoice = result.invoice;
      const validation = result.validation;
  
      const response = {
          success: true,
          invoice: {
              invoiceType: invoice.invoiceType,
              clientName: invoice.clientName,
              invoiceNo: invoice.invoiceNo,
              invoiceDate: invoice.invoiceDate,
              dueDate: invoice.dueDate,
              phoneNumber: invoice.phoneNumber,
              location: invoice.location,
              description: invoice.description || "",
              subtotal: Number(invoice.subtotal).toFixed(2),
              vatRate: invoice.vatRate || 0,
              vatAmount: Number(invoice.vatAmount).toFixed(2),
              totalAmount: Number(invoice.totalAmount).toFixed(2),
              currency: invoice.currency,
              lineItems: invoice.lineItems || [],
              trn: invoice.trn
          },
          validation: {
              isValid: validation.isValid,
              confidence: validation.confidence,
              errors: validation.errors,
              warnings: validation.warnings
          },
          message: `✅ Processed successfully (${validation.confidence}% confidence)`
      };
  
      // Send response once
      res.json(response);
  
      // Generate Excel in background
      agent.saveToExcel().catch(console.error);
  
      return;
  
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all invoices
// app.get('/api/invoices', (req, res) => {
//   try {
//     const stats = agent.getStats();
//     res.json({
//       success: true,
//       invoices: stats.invoices.map(inv => ({
//         clientName: inv.clientName,
//         invoiceNo: inv.invoiceNo,
//         invoiceDate: inv.invoiceDate,
//         description: inv.description || "",
//         subtotal: parseFloat(inv.subtotal || 0).toFixed(2),
//         vatRate: inv.vatRate || 0,
//         vatAmount: parseFloat(inv.vatAmount || 0).toFixed(2),
//         totalAmount: parseFloat(inv.totalAmount).toFixed(2),
//         currency: inv.currency,
//         invoiceType: inv.invoiceType,
//         phoneNumber: inv.phoneNumber,
//         lineItems: inv.lineItems || [],
//       })),
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });


app.get("/api/invoices", async (req, res) => {

  try {

      const invoices = await agent.getInvoices(1);

      res.json({
          success: true,
          invoices
      });

  } catch (err) {

      res.status(500).json({
          success: false,
          error: err.message
      });

  }

});

// Get statistics
app.get('/api/stats', async (req, res) => {

  try {

      const stats = await agent.getStats(1);

      res.json({
          success: true,
          stats
      });

  } catch (err) {

      res.status(500).json({
          success: false,
          error: err.message
      });

  }

});

// Download Excel
app.get('/api/download-excel', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'invoices.xlsx');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'invoices.xlsx');
    } else {
      res.status(404).json({ error: 'No invoices yet' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate HTML report
app.get("/api/report", async (req, res) => {

  try {

      const reportFile = await agent.generateHTMLReport();

      const html = fs.readFileSync(reportFile, "utf8");

      res.setHeader("Content-Type", "text/html");

      res.send(html);

  } catch (err) {

      res.status(500).json({
          success: false,
          error: err.message
      });

  }

});

// Clear all data
app.post('/api/clear', async (req, res) => {

  try {

      await agent.clear(1);

      res.json({
          success: true,
          message: "All invoices deleted."
      });

  } catch (err) {

      res.status(500).json({
          success: false,
          error: err.message
      });

  }

});

/**
 * ==================== SERVE REACT APP ====================
 */

// Serve React index.html for all routes (except API)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  if (!req.url.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

/**
 * ==================== START SERVER ====================
 */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   INVOICE AGENT - WEB VERSION             ║
║   http://localhost:${PORT}               ║
╚════════════════════════════════════════════╝

Available:
  📱 Upload page: http://localhost:${PORT}/
  📊 Stats API: http://localhost:${PORT}/api/stats
  📋 Invoices API: http://localhost:${PORT}/api/invoices
  📥 Download Excel: http://localhost:${PORT}/api/download-excel
  📈 Report: http://localhost:${PORT}/api/report

Ready to process invoices! 🚀
  `);
});

module.exports = app;
