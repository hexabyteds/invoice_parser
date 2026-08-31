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

    // TRN match first (exact, company-scoped), then normalized-name match
    // against every customer/supplier in the company. Company customer/
    // supplier lists are SMB-scale, so an in-memory pass over
    // findByCompany() is the same assumption customerRepository.
    // findByCompanyName already makes for the manual Add Customer flow.
    async findMatch(repository, companyId, name, trn) {
        const cleanTrn = String(trn || "").trim();

        if (cleanTrn) {
            const byTrn = await repository.findByTrn(companyId, cleanTrn);
            if (byTrn) return byTrn;
        }

        const all = await repository.findByCompany(companyId);
        return (
            all.find((row) => partyNameService.namesLikelyMatch(row.company_name, name)) ||
            null
        );
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
            const existing = await this.findMatch(supplierRepository, companyId, name, party.trn);

            if (existing) {
                return { status: "matched", table: "supplier", id: existing.id, entity: existing };
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
                return { status: "needs_review", extracted: party };
            }
        }

        const existing = await this.findMatch(customerRepository, companyId, name, party.trn);

        if (existing) {
            return { status: "matched", table: "customer", id: existing.id, entity: existing };
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
            return { status: "needs_review", extracted: party };
        }
    }
}

module.exports = new PartyResolutionService();
