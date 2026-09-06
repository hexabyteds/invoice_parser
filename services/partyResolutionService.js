const partyNameService = require("./partyNameService");
const customerRepository = require("../repositories/customerRepository");
const customerService = require("./customerService");
const supplierRepository = require("../repositories/supplierRepository");
const supplierService = require("./supplierService");
const { DOCUMENT_TYPES } = require("../utils/documentTypes");

class PartyResolutionService {

    // Which side of the document is "the party to match/create" — same
    // role mapping as partyNameService.resolvePartyName (Supplier Invoice:
    // our company is the seller, so the counterparty is the buyer ->
    // customers table. Bill: our company is the buyer, so the
    // counterparty is the seller/vendor -> suppliers table). Pulls the
    // richer identifying fields (trn/phone/email/address) for that same
    // side, not just the name.
    counterpartyFields(documentType, invoice) {
        if (documentType === DOCUMENT_TYPES.BILL) {
            return {
                table: "supplier",
                name: invoice.sellerName,
                trn: invoice.trn,
                phone: invoice.phoneNumber,
                email: invoice.email,
                address: invoice.location,
            };
        }

        return {
            table: "customer",
            name: invoice.buyerName,
            trn: invoice.buyerTrn,
            phone: invoice.buyerPhone,
            email: invoice.buyerEmail,
            address: invoice.buyerAddress,
        };
    }

    // TRN match first (exact, company-scoped) — trusted enough to auto-link
    // outright, same as an exact normalized-name match (a repeat vendor with
    // no TRN captured, uploaded under the identical name each time — the
    // common case for small vendors/individuals). Falling back further to a
    // *fuzzy* name match (namesLikelyMatch's legal-suffix-stripped substring
    // test — by design, to support abbreviated names like "Vibrant" matching
    // "Vibrant Design & Printing") is materially weaker: it can also
    // coincidentally match two genuinely different businesses, e.g.
    // "National Trading Company" against an existing "International Trading
    // Company" (found in a production QA audit, BUG-02 — every false-merge
    // case there was a fuzzy, non-exact match). So a fuzzy-only match is
    // never treated as confident enough to auto-link — see resolveParty,
    // which routes it to needs_review instead. A candidate is excluded
    // entirely (not even offered for review) when both sides have a TRN and
    // they disagree — a known TRN mismatch is stronger counter-evidence than
    // a name similarity is evidence, and re-checking it here (not just via
    // findByTrn above) matters because findByTrn only searches BY the
    // extracted TRN; it doesn't stop a name match from separately surfacing
    // a candidate whose own TRN happens to differ.
    //
    // Company customer/supplier lists are SMB-scale, so an in-memory pass
    // over findByCompany() is the same assumption customerRepository.
    // findByCompanyName already makes for the manual Add Customer flow.
    //
    // Returns { entity, confidence: "trn" | "exact-name" | "fuzzy-name" } or null.
    async findMatch(repository, companyId, name, trn) {
        const cleanTrn = String(trn || "").trim();

        if (cleanTrn) {
            const byTrn = await repository.findByTrn(companyId, cleanTrn);
            if (byTrn) return { entity: byTrn, confidence: "trn" };
        }

        const all = await repository.findByCompany(companyId);
        const normalizedName = partyNameService.normalizeForExactCompare(name);

        const nameMatch = all.find((row) => {
            if (!partyNameService.namesLikelyMatch(row.company_name, name)) {
                return false;
            }

            const rowTrn = String(row.trn || "").trim();
            if (cleanTrn && rowTrn && rowTrn !== cleanTrn) {
                return false;
            }

            return true;
        });

        if (!nameMatch) return null;

        // Deliberately normalizeForExactCompare here, not normalizeForCompare
        // — see that method's comment (BUG-QA-02): a legal-suffix difference
        // must never be treated as "exact" just because both names also
        // happen to collapse to the same string once suffixes are stripped.
        const isExact =
            normalizedName &&
            normalizedName === partyNameService.normalizeForExactCompare(nameMatch.company_name);

        return { entity: nameMatch, confidence: isExact ? "exact-name" : "fuzzy-name" };
    }

    // companyId/userId: scope + attribution for a newly created row.
    // documentType: one of utils/documentTypes DOCUMENT_TYPES.
    // invoice: the normalized invoice object (post invoiceNormalizer.normalize).
    //
    // Returns one of:
    //   { status: "matched", table, id, entity }
    //   { status: "created", table, id, entity }
    //   { status: "needs_review", extracted }
    async resolveParty({ companyId, userId, documentType, invoice }) {
        const party = this.counterpartyFields(documentType, invoice);
        const name = String(party.name || "").trim();

        if (!name) {
            return { status: "needs_review", extracted: party };
        }

        if (party.table === "supplier") {
            const match = await this.findMatch(supplierRepository, companyId, name, party.trn);

            if (match?.confidence === "trn" || match?.confidence === "exact-name") {
                return { status: "matched", table: "supplier", id: match.entity.id, entity: match.entity };
            }

            // A fuzzy (substring-only) name match is too weak to trust
            // blindly — surface it for a human to confirm via the existing
            // "needs review" picker rather than silently attaching this
            // bill to the wrong supplier's ledger (BUG-02).
            if (match?.confidence === "fuzzy-name") {
                return { status: "needs_review", extracted: party };
            }

            try {
                const created = await supplierService.create(
                    companyId,
                    userId,
                    {
                        company_name: name,
                        email: party.email,
                        phone: party.phone,
                        trn: party.trn,
                        billing_address_line1: party.address,
                        notes: "Auto-created from an uploaded Bill.",
                        source: "auto",
                    },
                    // Gemini only extracts one free-text vendor address, not
                    // separately parsed billing_country/billing_city, which
                    // supplierService normally requires — relax that for an
                    // auto-created row (still requires company_name).
                    { requireAllFields: false }
                );

                return { status: "created", table: "supplier", id: created.id, entity: created };
            } catch (err) {
                const recovered = await this.recoverFromRaceLoss(supplierRepository, companyId, name, party.trn, err);
                if (recovered) {
                    return { status: "matched", table: "supplier", id: recovered.id, entity: recovered };
                }
                return { status: "needs_review", extracted: party };
            }
        }

        const match = await this.findMatch(customerRepository, companyId, name, party.trn);

        if (match?.confidence === "trn" || match?.confidence === "exact-name") {
            return { status: "matched", table: "customer", id: match.entity.id, entity: match.entity };
        }

        if (match?.confidence === "fuzzy-name") {
            return { status: "needs_review", extracted: party };
        }

        try {
            const created = await customerService.create(companyId, userId, {
                company_name: name,
                trn: party.trn,
                email: party.email,
                phone: party.phone,
                address: party.address,
                notes: "Auto-created from an uploaded invoice.",
                source: "auto",
            });

            return { status: "created", table: "customer", id: created.id, entity: created };
        } catch (err) {
            const recovered = await this.recoverFromRaceLoss(customerRepository, companyId, name, party.trn, err);
            if (recovered) {
                return { status: "matched", table: "customer", id: recovered.id, entity: recovered };
            }
            return { status: "needs_review", extracted: party };
        }
    }

    // A concurrent upload for the same brand-new party can win the create
    // race first, and this side then fails one of two ways depending on
    // exactly when it lost the race (BUG-03):
    //   - uq_*_company_trn / uq_*_company_name (migration 0030) reject the
    //     INSERT itself with ER_DUP_ENTRY, if the winner committed between
    //     this side's own pre-check and its INSERT; or
    //   - customerService/supplierService.create's own findByCompanyName
    //     pre-check already sees the winner's row and throws its normal
    //     "already exists" Error, if the winner committed even earlier.
    // Either way a matching row now genuinely exists — rather than
    // stranding the loser in needs_review, re-run the match now that it's
    // committed and link to it. Anything else (e.g. a plan limit) isn't
    // this race and is left for the caller's generic needs_review fallback.
    async recoverFromRaceLoss(repository, companyId, name, trn, err) {
        const isRaceLoss =
            err.code === "ER_DUP_ENTRY" || /already exists/i.test(err.message || "");

        if (!isRaceLoss) return null;

        const match = await this.findMatch(repository, companyId, name, trn);
        return match?.entity || null;
    }
}

module.exports = new PartyResolutionService();
