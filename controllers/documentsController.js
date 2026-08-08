const documentsService = require("../services/documentsService");
const { isValidDocumentType, ALL_DOCUMENT_TYPES } = require("../utils/documentTypes");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class DocumentsController {

    async list(req, res) {

        try {

            const clientId = req.query.client_id ? Number(req.query.client_id) : null;

            if (req.query.client_id && (!Number.isSafeInteger(clientId) || clientId < 1)) {
                return res.status(400).json({
                    success: false,
                    error: "client_id must be a positive integer",
                });
            }

            const documentType = req.query.document_type || null;

            if (documentType && !isValidDocumentType(documentType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid document type. Must be one of: ${ALL_DOCUMENT_TYPES.join(", ")}.`,
                });
            }

            const limit = req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);
            const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

            if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
                return res.status(400).json({
                    success: false,
                    error: `limit must be an integer between 1 and ${MAX_LIMIT}`,
                });
            }

            if (!Number.isSafeInteger(offset) || offset < 0) {
                return res.status(400).json({
                    success: false,
                    error: "offset must be a non-negative integer",
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

            const { documents, total } = await documentsService.list(req.user.id, {
                clientId,
                documentType,
                from,
                to,
                limit,
                offset,
            });

            res.json({
                success: true,
                documents,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + documents.length < total,
                },
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message,
            });

        }
    }
}

module.exports = new DocumentsController();
