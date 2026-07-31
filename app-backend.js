/**
 * EazeeBooks - Express Backend
 * Serves React AI Accounting Platformend + API endpoints (Gemini-powered extraction)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const authRoutes = require("./routes/authRoutes");
const FreeInvoiceAgent = require('./free-invoice-agent');
const authMiddleware = require("./middleware/authMiddleware");
const clientRoutes = require("./routes/clientRoutes");
const adminRoutes = require("./routes/adminRoutes");
const planRoutes = require("./routes/planRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const usageRoutes = require("./routes/usageRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const usageService = require("./services/usageService");
const validationService = require("./services/validationService");
const auditLogRepository = require("./repositories/auditLogRepository");
const db = require("./config/database");

const app = express();
const UPLOADS_DIR = path.join(__dirname, "uploads");


app.use(cors());
app.use(express.json());





app.use((req, res, next) => {
  const apiIndex = req.url.indexOf("/api/");
  if (apiIndex > 0) {
    req.url = req.url.slice(apiIndex);
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/usage", require("./routes/usageRoutes"));
app.use("/api/dashboard", dashboardRoutes);
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve React app

// Initialize agent
const agent = new FreeInvoiceAgent();

// Upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `invoice_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const MAX_UPLOAD_SIZE_MB = 20;

const upload = multer({
  storage: storage,

  limits: {
      fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

      const allowed = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/jpg"
      ];

      if (allowed.includes(file.mimetype)) {
          cb(null, true);
      } else {
          const err = new Error(
              "Only PDF, JPG, JPEG and PNG files are allowed."
          );
          err.status = 400;
          cb(err);
      }
  }
});

// One shared GEMINI_API_KEY serves every tenant, so a single user hammering
// /api/upload can burn through the app-wide Gemini quota for everyone else.
// Keyed on the authenticated user (this middleware always runs after
// authMiddleware), not IP, so it can't be dodged by rotating networks.
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.id),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many uploads. Please wait a minute and try again.",
    });
  },
});

/**
 * ==================== API ENDPOINTS ====================
 */

// Health check
app.get('/api/health', async (req, res) => {
  try {

    await db.query("SELECT 1");

    res.json({
      status: "healthy",
      message: "EazeeBooks API"
    });

  } catch (err) {

    res.status(500).json({
      status: "unhealthy",
      error: err.message
    });

  }
});


app.post(
  "/api/upload",
  authMiddleware,
  uploadRateLimiter,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      // ===========================
      // NEW: Validate client
      // ===========================
      const clientId = Number(req.body.client_id);

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: "Client is required.",
        });
      }

      await usageService.checkStorageLimit(req.user.id, req.file.size);
      await usageService.addStorage(req.user.id, req.file.size);

      console.log(`📸 Processing: ${req.file.filename}`);

      const extension = path
        .extname(req.file.originalname)
        .toLowerCase();

      let result;

      if (extension === ".pdf") {

        result = await agent.processPDF(
          req.file.path,
          req.user.id,
          clientId,
          req.file.path
        );

      } else {

        result = await agent.processImage(
          req.file.path,
          req.user.id,
          clientId,
          req.file.path
        );

      }

      if (result.status !== "success") {
        // Activity feed is a nice-to-have — a logging failure must never
        // break the response, but the write itself is awaited so the
        // dashboard reflects it immediately (no fire-and-forget race).
        try {
          await auditLogRepository.create({
            userId: req.user.id,
            clientId,
            // A validation-object means Gemini extracted something but it
            // wasn't a valid invoice; no validation object means a hard
            // extraction/OCR/system failure.
            action: result.validation ? "invoice_rejected" : "invoice_error",
            description: result.message,
          });
        } catch (logErr) {}

        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      // ===========================
      // PDF RESPONSE
      // ===========================
      if (extension === ".pdf") {

        try {
          await auditLogRepository.create({
            userId: req.user.id,
            clientId,
            action: "invoice_uploaded",
            description: `${result.totalInvoices} invoice(s) processed from PDF`,
          });

          if (result.meta?.failedPages > 0) {
            await auditLogRepository.create({
              userId: req.user.id,
              clientId,
              action: "invoice_error",
              description: `${result.meta.failedPages} page(s) failed during PDF extraction`,
            });
          }
        } catch (logErr) {}

        return res.json({
          success: true,
          totalInvoices: result.totalInvoices,
          invoices: result.invoices,
          message: `${result.totalInvoices} invoice(s) processed successfully.`,
        });

      }

      // ===========================
      // IMAGE RESPONSE
      // ===========================

      const invoice = result.invoice;
      const validation = result.validation;

      try {
        await auditLogRepository.create({
          userId: req.user.id,
          clientId,
          action: "invoice_uploaded",
          description: invoice.invoiceNo ? `Invoice ${invoice.invoiceNo}` : "Invoice",
        });

        await auditLogRepository.create({
          userId: req.user.id,
          clientId,
          action: "invoice_processed",
          description: `${validation.confidence}% confidence`,
        });
      } catch (logErr) {}

      return res.json({
        success: true,

        invoice: {
          id: invoice.id,
          client_id: invoice.client_id,   // NEW
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

    } catch (error) {
      console.error("Upload error:", error);

      const statusCode =
        error.message?.includes("limit reached") ? 403 : 500;

      return res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);


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


// app.get("/api/invoices", authMiddleware, async (req, res) => {

//   try {

//       const invoices = await agent.getInvoices(req.user.id);

//       res.json({
//           success: true,
//           invoices
//       });

//   } catch (err) {

//       res.status(500).json({
//           success: false,
//           error: err.message
//       });

//   }

// });


const DEFAULT_INVOICE_LIMIT = 20;
const MAX_INVOICE_LIMIT = 100;

app.get("/api/invoices", authMiddleware, async (req, res) => {
  try {
    const clientId = req.query.client_id;
    const limit = req.query.limit === undefined
      ? DEFAULT_INVOICE_LIMIT
      : Number(req.query.limit);
    const offset = req.query.offset === undefined
      ? 0
      : Number(req.query.offset);

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_INVOICE_LIMIT
    ) {
      return res.status(400).json({
        success: false,
        error: `limit must be an integer between 1 and ${MAX_INVOICE_LIMIT}`,
      });
    }

    if (!Number.isSafeInteger(offset) || offset < 0) {
      return res.status(400).json({
        success: false,
        error: "offset must be a non-negative integer",
      });
    }

    let result;

    if (clientId) {
      const parsedClientId = Number(clientId);

      if (!Number.isSafeInteger(parsedClientId) || parsedClientId < 1) {
        return res.status(400).json({
          success: false,
          error: "client_id must be a positive integer",
        });
      }

      result = await agent.getInvoicesByClient(
        req.user.id,
        parsedClientId,
        { limit, offset }
      );
    } else {
      result = await agent.getInvoices(req.user.id, { limit, offset });
    }

    res.json({
      success: true,
      invoices: result.invoices,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.invoices.length < result.total,
      },
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


// Re-runs the same completeness check used right after Gemini extraction,
// against the invoice's CURRENT stored/edited fields — so the confidence
// score on the detail view reflects what's actually saved now, not a
// stale snapshot from whenever it was first uploaded.
function validateStoredInvoice(invoiceRow, lineItems) {
  return validationService.validate({
    clientName: invoiceRow.client_name,
    invoiceNo: invoiceRow.invoice_no,
    invoiceDate: invoiceRow.invoice_date,
    dueDate: invoiceRow.due_date,
    phoneNumber: invoiceRow.phone_number,
    location: invoiceRow.location,
    subtotal: invoiceRow.subtotal,
    vatAmount: invoiceRow.vat_amount,
    totalAmount: invoiceRow.total_amount,
    description: invoiceRow.description,
    trn: invoiceRow.trn,
    lineItems,
  });
}

app.get(
  "/api/invoices/:id",
  authMiddleware,
  async (req, res) => {

    try {

      const data = await agent.getInvoiceById(
        req.params.id,
        req.user.id
      );

      if (!data) {

        return res.status(404).json({
          success: false,
          error: "Invoice not found."
        });

      }

      res.json({
        success: true,
        invoice: {
          ...data.invoice,
          hasSourceFile: Boolean(data.invoice?.image_path),
        },
        lineItems: data.lineItems,
        validation: validateStoredInvoice(data.invoice, data.lineItems)
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        error: err.message
      });

    }

  });


app.get(
  "/api/invoices/:id/source",
  authMiddleware,
  async (req, res) => {
    try {
      const source = await agent.getInvoiceSourcePath(
        req.params.id,
        req.user.id
      );

      if (!source) {
        return res.status(404).json({
          success: false,
          error: "Original document not found for this invoice.",
        });
      }

      const ext = path.extname(source.absolutePath).toLowerCase();
      const mimeByExt = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
      };

      res.type(mimeByExt[ext] || "application/octet-stream");
      res.sendFile(source.absolutePath);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);


// Update an invoice
app.put(
  "/api/invoices/:id",
  authMiddleware,
  async (req, res) => {

    try {

      const updated = await agent.updateInvoice(
        req.params.id,
        req.user.id,
        req.body
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: "Invoice not found."
        });
      }

      res.json({
        success: true,
        invoice: updated.invoice,
        lineItems: updated.lineItems,
        validation: validateStoredInvoice(updated.invoice, updated.lineItems)
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        error: err.message
      });

    }

  });


app.delete(
  "/api/invoices/:id",
  authMiddleware,
  async (req, res) => {
    try {
      console.log("DELETE INVOICE", req.params.id);
      console.log("USER ID", req.user.id);
      const deleted = await agent.deleteInvoice(
        req.params.id,
        req.user.id
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Invoice not found.",
        });
      }

      res.json({
        success: true,
        message: "Invoice deleted.",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);


app.get(
  "/api/analytics",
  authMiddleware,
  async (req, res) => {

    try {

      const clientId = req.query.client_id
        ? Number(req.query.client_id)
        : null;

      console.log("ANALYTICS QUERY", {
        userId: req.user.id,
        clientId,
      });

      const analytics = await agent.getAnalytics(
        req.user.id,
        clientId
      );

      console.log("ANALYTICS RESULT", analytics);

      res.json({
        success: true,
        analytics
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        error: err.message
      });

    }

  }
);

// Get statistics
app.get('/api/stats', authMiddleware, async (req, res) => {

  const clientId = req.query.client_id;

  let stats;

  if (clientId) {
    stats = await agent.getStatsByClient(
      req.user.id,
      Number(clientId)
    );
  } else {
    stats = await agent.getStats(req.user.id);
  }

  res.json({
    success: true,
    stats
  });

});

function getExportFilters(query = {}) {
  return {
    clientId: query.client_id ? Number(query.client_id) : null,
    from: query.from || null,
    to: query.to || null,
  };
}

// Download Excel (regenerate from DB — one row per line item)
// Supports: ?client_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/api/download-excel", authMiddleware, async (req, res) => {
  try {
    const filters = getExportFilters(req.query);

    console.log("DOWNLOAD EXCEL", {
      userId: req.user.id,
      ...filters,
    });

    const file = await agent.saveToExcel(
      req.user.id,
      filters.clientId,
      undefined,
      filters
    );

    const filename = filters.clientId
      ? `client_${filters.clientId}_invoices.xlsx`
      : "invoices.xlsx";

    res.download(file, filename);
  } catch (err) {
    console.error("DOWNLOAD EXCEL ERROR", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Unified export:
// format = excel | csv | zoho | quickbooks | pdf | html
// Supports: ?format=&client_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/api/export", authMiddleware, async (req, res) => {
  try {
    const format = String(req.query.format || "excel").toLowerCase();
    const filters = getExportFilters(req.query);
    const prefix = filters.clientId
      ? `client_${filters.clientId}`
      : "invoices";

    console.log("EXPORT", {
      userId: req.user.id,
      format,
      ...filters,
    });

    if (format === "csv") {
      const { csv } = await agent.exportCSV(req.user.id, filters);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${prefix}.csv"`
      );
      return res.send(csv);
    }

    if (format === "zoho") {
      const { filePath } = await agent.exportZoho(req.user.id, filters);
      return res.download(filePath, `${prefix}_zoho_bills.xlsx`, (err) => {
        if (err) console.error("Zoho download error", err);
        fs.unlink(filePath, () => {});
      });
    }

    if (format === "quickbooks" || format === "qb") {
      const { csv } = await agent.exportQuickBooks(req.user.id, filters);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${prefix}_quickbooks.csv"`
      );
      return res.send(csv);
    }

    if (format === "pdf") {
      const { filePath } = await agent.exportPDF(req.user.id, filters);
      return res.download(filePath, `${prefix}.pdf`, (err) => {
        if (err) console.error("PDF download error", err);
        fs.unlink(filePath, () => {});
      });
    }

    if (format === "html" || format === "report") {
      const reportFile = await agent.generateHTMLReport(
        req.user.id,
        filters.clientId,
        undefined,
        filters
      );
      const html = fs.readFileSync(reportFile, "utf8");

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${prefix}_report.html"`
      );
      return res.send(html);
    }

    // Default: excel
    const file = await agent.saveToExcel(
      req.user.id,
      filters.clientId,
      undefined,
      filters
    );

    return res.download(file, `${prefix}.xlsx`);
  } catch (err) {
    console.error("EXPORT ERROR", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Generate HTML report
app.get("/api/report", authMiddleware, async (req, res) => {

  try {
    const filters = getExportFilters(req.query);

    const reportFile = await agent.generateHTMLReport(
      req.user.id,
      filters.clientId,
      undefined,
      filters
    );

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
app.post('/api/clear', authMiddleware, async (req, res) => {

  try {

    await agent.clear(req.user.id);

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
 * ==================== ERROR HANDLING ====================
 * Multer rejects a bad file (fileFilter) or an oversized one (limits.fileSize)
 * from inside its own middleware, before the route handler's try/catch ever
 * runs — those errors reach Express only via next(err), so they need to be
 * caught here instead. This must be registered after every route.
 */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        error: `File is too large. Maximum size is ${MAX_UPLOAD_SIZE_MB} MB.`,
      });
    }

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  if (err && err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
    });
  }

  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    error: "Something went wrong. Please try again.",
  });
});

/**
 * ==================== START SERVER ====================
 */

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   EazeeBooks - WEB VERSION             ║
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
}

module.exports = app;
