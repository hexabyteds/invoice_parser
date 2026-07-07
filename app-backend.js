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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Invoice Agent API',
    totalInvoices: agent.getStats().totalInvoices,
  });
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

      res.json({
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
          subtotal: parseFloat(invoice.subtotal).toFixed(2),
          vatRate: invoice.vatRate || 0,
          vatAmount: parseFloat(invoice.vatAmount).toFixed(2),
          totalAmount: parseFloat(invoice.totalAmount).toFixed(2),
          currency: invoice.currency,
          lineItems: invoice.lineItems,
          trn: invoice.trn,
        },
        validation: {
          isValid: validation.isValid,
          confidence: validation.confidence,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        message: `✅ Processed successfully (${validation.confidence}% confidence)`,
      });

      // Save to Excel after successful upload
      await agent.saveToExcel();
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
app.get('/api/invoices', (req, res) => {
  try {
    const stats = agent.getStats();
    res.json({
      success: true,
      invoices: stats.invoices.map(inv => ({
        clientName: inv.clientName,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        description: inv.description || "",
        subtotal: parseFloat(inv.subtotal || 0).toFixed(2),
        vatRate: inv.vatRate || 0,
        vatAmount: parseFloat(inv.vatAmount || 0).toFixed(2),
        totalAmount: parseFloat(inv.totalAmount).toFixed(2),
        currency: inv.currency,
        invoiceType: inv.invoiceType,
        phoneNumber: inv.phoneNumber,
        lineItems: inv.lineItems || [],
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = agent.getStats();
    res.json({
      success: true,
      stats: {
        totalInvoices: stats.totalInvoices,
        uniqueClients: stats.uniqueClients,
        totalAmount: parseFloat(stats.totalAmount).toFixed(2),
        totalVAT: parseFloat(stats.totalVAT).toFixed(2),
        currency: stats.currency,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
app.get('/api/report', (req, res) => {
  try {
    const reportFile = agent.generateHTMLReport();
    const html = fs.readFileSync(reportFile, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all data
app.post('/api/clear', (req, res) => {
  try {
    agent.clear();
    res.json({ success: true, message: 'All data cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
