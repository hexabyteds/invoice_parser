/**
 * EazeeBooks - Express Backend
 * Serves React AI Accounting Platformend + API endpoints (Gemini-powered extraction)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const authRoutes = require("./routes/authRoutes");
const FreeInvoiceAgent = require('./free-invoice-agent');
const authMiddleware = require("./middleware/authMiddleware");
const companyContext = require("./middleware/companyContext");
const requireCompanyPermission = require("./middleware/requireCompanyPermission");
const clientRoutes = require("./routes/clientRoutes");
const adminRoutes = require("./routes/adminRoutes");
const planRoutes = require("./routes/planRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const usageRoutes = require("./routes/usageRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const usageService = require("./services/usageService");
const clientService = require("./services/clientService");
const validationService = require("./services/validationService");
const auditLogRepository = require("./repositories/auditLogRepository");
const db = require("./config/database");
const {
  DOCUMENT_TYPES,
  ALL_DOCUMENT_TYPES,
  INVOICE_DOCUMENT_TYPES,
  isValidDocumentType,
  isValidInvoiceDocumentType,
  isBankStatementType,
} = require("./utils/documentTypes");
const bankStatementService = require("./services/bankStatementService");

const app = express();
const UPLOADS_DIR = path.join(__dirname, "uploads");


app.use(cors());

// Mounted BEFORE express.json(): Stripe webhook signature verification
// requires the raw, unparsed request body, so this route must see it
// before the global JSON body parser below consumes it.
app.use("/api/stripe/webhook", require("./routes/stripeWebhookRoutes"));

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
app.use("/api/companies", require("./routes/companyRoutes"));
app.use("/api/bank-statements", require("./routes/bankStatementRoutes"));
app.use("/api/documents", require("./routes/documentsRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
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
    const unique = `${Date.now()}_${crypto.randomUUID()}`;
    cb(null, `invoice_${unique}${path.extname(file.originalname)}`);
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


// Storage quota was reserved before processing but never released when
// processing failed — every failed upload permanently leaked quota (and
// left the file orphaned on disk). Called from every failure branch below,
// and from the outer catch, once a reservation has actually been made.
async function releaseFailedUploadStorage(userId, file) {
  try {
    await usageService.removeStorage(userId, file.size);
  } catch (err) {
    console.error("Failed to release storage quota after failed upload:", err.message);
  }

  try {
    await fs.promises.unlink(file.path);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Failed to delete orphaned upload file:", err.message);
    }
  }
}

app.post(
  "/api/upload",
  authMiddleware,
  companyContext,
  uploadRateLimiter,
  upload.single("image"),
  async (req, res) => {
    let storageReserved = false;

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

      // ===========================
      // NEW: Validate document type
      // ===========================
      const documentType = req.body.document_type || null;

      if (documentType && !isValidDocumentType(documentType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid document type. Must be one of: ${ALL_DOCUMENT_TYPES.join(", ")}.`,
        });
      }

      // Which module this upload needs permission for isn't known until
      // now (it depends on document_type, parsed from the body) — can't be
      // a static route-level requireCompanyPermission like every other
      // route. See middleware/requireCompanyPermission.js's hasPermission.
      const uploadModule = isBankStatementType(documentType) ? "bank_statements" : "invoices";

      if (!requireCompanyPermission.hasPermission(req.membership, uploadModule, "create")) {
        return res.status(403).json({
          success: false,
          error: `You don't have create access to ${uploadModule} in this company.`,
        });
      }

      // ===========================
      // NEW: Reject uploads against a deactivated client
      // ===========================
      await clientService.assertActiveForCompany(clientId, req.company.id);

      // Reserves the bytes atomically — under concurrent uploads, the old
      // checkStorageLimit()-then-addStorage() pair let every request read
      // the same pre-upload storage_used and all pass, so N concurrent
      // uploads near the limit could all add their bytes past it.
      await usageService.reserveStorage(req.user.id, req.file.size);
      storageReserved = true;

      console.log(`📸 Processing: ${req.file.filename}`);

      const extension = path
        .extname(req.file.originalname)
        .toLowerCase();

      // ===========================
      // NEW: Bank Statement upload
      // ===========================
      // Handled entirely separately from the invoice/bill branch below —
      // different service, different persisted tables, different response
      // shape — so the existing invoice/bill flow stays byte-identical.
      if (isBankStatementType(documentType)) {

        const bsResult = extension === ".pdf"
          ? await bankStatementService.processPDF(
              req.file.path,
              req.user.id,
              req.company.id,
              clientId,
              req.file.path
            )
          : await bankStatementService.processImage(
              req.file.path,
              req.user.id,
              req.company.id,
              clientId,
              req.file.path
            );

        if (bsResult.status !== "success") {
          await releaseFailedUploadStorage(req.user.id, req.file);

          try {
            await auditLogRepository.create({
              userId: req.user.id,
              clientId,
              action: "bank_statement_error",
              description: bsResult.message,
            });
          } catch (logErr) {}

          return res.status(400).json({
            success: false,
            error: bsResult.message,
          });
        }

        try {
          await auditLogRepository.create({
            userId: req.user.id,
            clientId,
            action: "bank_statement_uploaded",
            description: `Bank statement (${bsResult.transactionCount} transaction(s))`,
          });

          if (bsResult.meta?.failedPages > 0) {
            await auditLogRepository.create({
              userId: req.user.id,
              clientId,
              action: "bank_statement_error",
              description: `${bsResult.meta.failedPages} page(s) failed during extraction`,
            });
          }
        } catch (logErr) {}

        return res.json({
          success: true,
          bankStatement: bsResult.bankStatement,
          transactionCount: bsResult.transactionCount,
          message: `Bank statement processed successfully (${bsResult.transactionCount} transaction(s)).`,
        });
      }

      let result;

      if (extension === ".pdf") {

        result = await agent.processPDF(
          req.file.path,
          req.user.id,
          req.company.id,
          clientId,
          req.file.path,
          documentType
        );

      } else {

        result = await agent.processImage(
          req.file.path,
          req.user.id,
          req.company.id,
          clientId,
          req.file.path,
          documentType
        );

      }

      if (result.status !== "success") {
        await releaseFailedUploadStorage(req.user.id, req.file);

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
          document_type: invoice.document_type,
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

      if (storageReserved) {
        await releaseFailedUploadStorage(req.user.id, req.file);
      }

      const statusCode =
        error.statusCode ||
        (error.message?.includes("limit reached") ? 403 : 500);

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

app.get(
  "/api/invoices",
  authMiddleware,
  companyContext,
  requireCompanyPermission("invoices", "view"),
  async (req, res) => {
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

    const documentType = req.query.document_type || null;

    if (documentType && !isValidInvoiceDocumentType(documentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid document type. Must be one of: ${INVOICE_DOCUMENT_TYPES.join(", ")}.`,
      });
    }

    const from = req.query.from || null;
    const to = req.query.to || null;

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({
        success: false,
        error: "from must be a date in YYYY-MM-DD format",
      });
    }

    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({
        success: false,
        error: "to must be a date in YYYY-MM-DD format",
      });
    }

    if (from && to && from > to) {
      return res.status(400).json({
        success: false,
        error: "from date cannot be after to date",
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
        req.company.id,
        parsedClientId,
        { limit, offset, documentType, from, to }
      );
    } else {
      result = await agent.getInvoices(req.company.id, { limit, offset, documentType, from, to });
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
  companyContext,
  requireCompanyPermission("invoices", "view"),
  async (req, res) => {

    try {

      const data = await agent.getInvoiceById(
        req.params.id,
        req.company.id
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
  companyContext,
  requireCompanyPermission("invoices", "view"),
  async (req, res) => {
    try {
      const source = await agent.getInvoiceSourcePath(
        req.params.id,
        req.company.id
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
  companyContext,
  requireCompanyPermission("invoices", "edit"),
  async (req, res) => {

    try {

      if (
        req.body.document_type &&
        !isValidInvoiceDocumentType(req.body.document_type)
      ) {
        return res.status(400).json({
          success: false,
          error: `Invalid document type. Must be one of: ${INVOICE_DOCUMENT_TYPES.join(", ")}.`,
        });
      }

      const updated = await agent.updateInvoice(
        req.params.id,
        req.company.id,
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

      const statusCode = err.message?.startsWith("Invalid value for")
        ? 400
        : 500;

      res.status(statusCode).json({
        success: false,
        error: err.message
      });

    }

  });


app.delete(
  "/api/invoices/:id",
  authMiddleware,
  companyContext,
  requireCompanyPermission("invoices", "delete"),
  async (req, res) => {
    try {
      console.log("DELETE INVOICE", req.params.id);
      console.log("USER ID", req.user.id);
      const deleted = await agent.deleteInvoice(
        req.params.id,
        req.company.id,
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
  companyContext,
  requireCompanyPermission("invoices", "view"),
  async (req, res) => {

    try {

      const clientId = req.query.client_id
        ? Number(req.query.client_id)
        : null;

      console.log("ANALYTICS QUERY", {
        userId: req.user.id,
        companyId: req.company.id,
        clientId,
      });

      const analytics = await agent.getAnalytics(
        req.company.id,
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
app.get('/api/stats', authMiddleware, companyContext, requireCompanyPermission("invoices", "view"), async (req, res) => {

  const clientId = req.query.client_id;

  let stats;

  if (clientId) {
    // Pre-existing bug, unrelated to this migration: FreeInvoiceAgent has
    // no getStatsByClient method (only getStats(companyId, clientId)) — a
    // stats request scoped to a specific client already 500s today. Left
    // as-is rather than silently fixed alongside the tenancy change.
    stats = await agent.getStatsByClient(
      req.company.id,
      Number(clientId)
    );
  } else {
    stats = await agent.getStats(req.company.id);
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
    documentType: query.document_type || null,
  };
}

// Shared by all export routes — returns true (and has already sent the
// 400 response) when an invalid document_type was requested.
function rejectInvalidExportDocumentType(req, res) {
  const documentType = req.query.document_type;

  if (documentType && !isValidInvoiceDocumentType(documentType)) {
    res.status(400).json({
      success: false,
      error: `Invalid document type. Must be one of: ${INVOICE_DOCUMENT_TYPES.join(", ")}.`,
    });
    return true;
  }

  return false;
}

// Download Excel (regenerate from DB — one row per line item)
// Supports: ?client_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/api/download-excel", authMiddleware, companyContext, requireCompanyPermission("invoices", "export"), async (req, res) => {
  try {
    if (rejectInvalidExportDocumentType(req, res)) return;

    const filters = getExportFilters(req.query);

    console.log("DOWNLOAD EXCEL", {
      userId: req.user.id,
      companyId: req.company.id,
      ...filters,
    });

    const file = await agent.saveToExcel(
      req.company.id,
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
app.get("/api/export", authMiddleware, companyContext, requireCompanyPermission("invoices", "export"), async (req, res) => {
  try {
    if (rejectInvalidExportDocumentType(req, res)) return;

    const format = String(req.query.format || "excel").toLowerCase();
    const filters = getExportFilters(req.query);
    const prefix = filters.clientId
      ? `client_${filters.clientId}`
      : "invoices";

    console.log("EXPORT", {
      userId: req.user.id,
      companyId: req.company.id,
      format,
      ...filters,
    });

    if (format === "csv") {
      const { csv } = await agent.exportCSV(req.company.id, filters);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${prefix}.csv"`
      );
      return res.send(csv);
    }

    if (format === "zoho") {
      const { filePath } = await agent.exportZoho(req.company.id, filters);
      return res.download(filePath, `${prefix}_zoho_bills.xlsx`, (err) => {
        if (err) console.error("Zoho download error", err);
        fs.unlink(filePath, () => {});
      });
    }

    if (format === "quickbooks" || format === "qb") {
      const { csv } = await agent.exportQuickBooks(req.company.id, filters);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${prefix}_quickbooks.csv"`
      );
      return res.send(csv);
    }

    if (format === "pdf") {
      const { filePath } = await agent.exportPDF(req.company.id, filters);
      return res.download(filePath, `${prefix}.pdf`, (err) => {
        if (err) console.error("PDF download error", err);
        fs.unlink(filePath, () => {});
      });
    }

    if (format === "html" || format === "report") {
      const reportFile = await agent.generateHTMLReport(
        req.company.id,
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
      req.company.id,
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
app.get("/api/report", authMiddleware, companyContext, requireCompanyPermission("invoices", "export"), async (req, res) => {

  try {
    if (rejectInvalidExportDocumentType(req, res)) return;

    const filters = getExportFilters(req.query);

    const reportFile = await agent.generateHTMLReport(
      req.company.id,
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
app.post('/api/clear', authMiddleware, companyContext, requireCompanyPermission("invoices", "delete"), async (req, res) => {

  try {

    await agent.clear(req.company.id, req.user.id);

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

// Any /api/* request that didn't match one of the routes above is an
// unknown endpoint — respond with a clean 404 instead of falling through
// to the SPA wildcard below. That wildcard only serves index.html when the
// URL does NOT start with /api; for a /api/* URL it matched (app.get('*')
// matches every path) but then returned without ever calling res.send()/
// res.json()/next(), so the request just hung forever with no response.
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found."
  });
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
