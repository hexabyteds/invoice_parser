const { DOCUMENT_TYPES, isValidInvoiceDocumentType } = require("../utils/documentTypes");

// Legal-suffix noise stripped before comparing two company names — keeps
// the match role-based/generic (works for any company) rather than
// hardcoding any specific business name.
const COMPANY_SUFFIX_PATTERN =
    /\b(l+\s*l+\s*c+|fze|fzc|fzco|ltd|limited|llp|inc|co|company|corp|corporation|est|establishment|trading|group|holding|holdings)\b/g;

class PartyNameService {

    // Lowercases, strips punctuation and common legal suffixes, collapses
    // whitespace. Used only to compare two extracted/entered names loosely
    // — never persisted, never shown to the user.
    normalizeForCompare(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[.,]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(COMPANY_SUFFIX_PATTERN, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    namesLikelyMatch(a, b) {
        const na = this.normalizeForCompare(a);
        const nb = this.normalizeForCompare(b);

        if (!na || !nb) return false;
        if (na === nb) return true;

        // Substring match handles abbreviated names ("Vibrant" vs "Vibrant
        // Design & Printing") without requiring an exact string.
        return na.includes(nb) || nb.includes(na);
    }

    /**
     * Generic, role-based Party Name resolution.
     *
     * A document has two sides — seller/issuer and buyer/customer. Which
     * side is "the Party Name" depends on how the selected client relates
     * to the document (document_type), decided elsewhere (upload form /
     * edit form) and never inferred or overridden here:
     *
     *   SUPPLIER_INVOICE ("Invoice") - selected client is the seller, so
     *                                  Party Name = the buyer/customer.
     *   BILL                          - selected client is the buyer, so
     *                                  Party Name = the seller/supplier.
     *
     * No company name is ever hardcoded — this only maps roles using
     * whatever seller/buyer names were extracted for THIS document.
     *
     * @param {string} documentType - one of utils/documentTypes DOCUMENT_TYPES
     * @param {string} [sellerName] - extracted seller/issuer/vendor name
     * @param {string} [buyerName] - extracted buyer/customer/recipient name
     * @param {{company_name?: string}|null} [selectedClient] - the app's
     *   selected client entity, used ONLY as a sanity check to catch
     *   seller/buyer being swapped by extraction (e.g. an unusual layout).
     *   It never decides Invoice vs Bill.
     * @param {string} [fallback] - value to keep when the correct
     *   counterparty can't be confidently determined (missing section,
     *   OCR gap, legacy record with no seller/buyer captured, etc.) — so a
     *   valid existing Party Name is never overwritten with a blank one.
     */
    resolvePartyName({
        documentType,
        sellerName = "",
        buyerName = "",
        selectedClient = null,
        fallback = "",
    }) {
        const seller = String(sellerName || "").trim();
        const buyer = String(buyerName || "").trim();
        const safeFallback = String(fallback || "").trim();

        if (!isValidInvoiceDocumentType(documentType)) {
            return safeFallback;
        }

        const isInvoice = documentType === DOCUMENT_TYPES.SUPPLIER_INVOICE;

        let ownName = isInvoice ? seller : buyer;
        let counterpartyName = isInvoice ? buyer : seller;

        // If the selected client's own name clearly matches the side we're
        // about to treat as the *counterparty* — and not the side we're
        // treating as "own" — extraction likely swapped seller/buyer.
        // Swap them back rather than persist a Party Name equal to the
        // client itself.
        if (
            selectedClient?.company_name &&
            counterpartyName &&
            this.namesLikelyMatch(selectedClient.company_name, counterpartyName) &&
            !this.namesLikelyMatch(selectedClient.company_name, ownName)
        ) {
            [ownName, counterpartyName] = [counterpartyName, ownName];
        }

        if (counterpartyName) {
            return counterpartyName;
        }

        // Counterparty wasn't extracted (missing Bill To/vendor section,
        // unusual formatting, legacy record) — never persist blank.
        return safeFallback;
    }
}

module.exports = new PartyNameService();
