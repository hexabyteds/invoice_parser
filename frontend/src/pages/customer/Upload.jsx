import { useState, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { uploadInvoice, updateInvoice } from "../../services/invoiceApi";
import customerApi from "../../services/customerApi";
import supplierApi from "../../services/supplierApi";
import { useParams, useNavigate } from "react-router-dom";
import { DOCUMENT_TYPES, documentTypeLabel } from "../../utils/documentTypes";
import { isPartyActive } from "../../utils/clientStatus";
import { useAuth } from "../../context/AuthContext";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function validateFile(file) {
  const ext = file.name
    .slice(file.name.lastIndexOf("."))
    .toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return "Unsupported file type. Please upload a PDF, JPG, or PNG.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
  }

  if (file.size === 0) {
    return "This file is empty.";
  }

  return null;
}

// Small banner shown after a successful Invoice/Bill upload, reflecting
// how services/partyResolutionService.js resolved the customer/supplier.
// `null` (no auto-resolution happened, e.g. an explicit locked client)
// renders nothing.
function ResolutionBanner({ resolution, partyNoun }) {
  if (!resolution) return null;

  if (resolution.status === "created") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm">
        <Sparkles size={16} />
        New {partyNoun} created: <strong>{resolution.name}</strong>
      </div>
    );
  }

  if (resolution.status === "matched") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-indigo-50 text-indigo-700 p-3 text-sm">
        <CheckCircle2 size={16} />
        Existing {partyNoun} matched: <strong>{resolution.name}</strong>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 text-amber-700 p-3 text-sm">
      <AlertTriangle size={16} />
      Could not confidently identify the {partyNoun} — pick one below.
    </div>
  );
}

// Inline "needs review" picker — links an already-saved, unlinked invoice
// to an existing customer/supplier via PUT /api/invoices/:id (client_id),
// reusing FreeInvoiceAgent.updateInvoice rather than re-uploading the file.
function ReviewPicker({ parties, partyNoun, linking, onLink, addHref }) {
  const [selected, setSelected] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg border p-2 bg-white text-slate-900 text-sm"
      >
        <option value="">{`Select ${partyNoun}`}</option>
        {parties.map((party) => (
          <option
            key={party.id}
            value={party.id}
            disabled={!isPartyActive(party.status)}
          >
            {party.company_name}
            {!isPartyActive(party.status) ? " (Inactive)" : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={!selected || linking}
        onClick={() => onLink(selected)}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {linking ? "Linking..." : "Link"}
      </button>

      <a href={addHref} className="text-sm text-indigo-600 hover:underline">
        + Add new {partyNoun}
      </a>
    </div>
  );
}

export default function Upload() {
  const { clientId: routeClientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const trialExpired = Boolean(user?.subscription?.trial?.isExpired);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankResult, setBankResult] = useState(null);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [pdfInvoices, setPdfInvoices] = useState(null);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [clientId, setClientId] = useState(routeClientId || "");
  const [documentType, setDocumentType] = useState("");
  const [linkingId, setLinkingId] = useState(null);

  // When opened from Client Details, client is locked
  const isClientLocked = Boolean(routeClientId);
  const isBill = documentType === "bill";
  const isBankStatement = documentType === "bank_statement";
  // A Bill's counterparty is a vendor, not a customer — matches how the
  // backend picks customer_id vs supplier_id (see invoiceRepository.create).
  const parties = isBill ? suppliers : clients;
  const partyNoun = isBill ? "supplier" : "customer";
  const addPartyHref = isBill ? "/dashboard/suppliers/new" : "/dashboard/customers/new";

  // Bank Statements have no seller/buyer relationship to auto-detect a
  // customer from, so they still require an explicit selection — same for
  // the locked-client case (opened from a Customer/Supplier Detail page).
  // A normal Invoice/Bill upload no longer requires picking a party at all
  // — the backend matches/creates one automatically from the parsed
  // document (see services/partyResolutionService.js).
  const requiresManualParty = isClientLocked || isBankStatement;

  const selectedClient = parties.find(
    (c) => String(c.id) === String(clientId)
  );
  const selectedClientInactive = Boolean(selectedClient) && !isPartyActive(selectedClient.status);

  const acceptFile = (candidate) => {
    const validationError = validateFile(candidate);

    if (validationError) {
      setFile(null);
      setError(validationError);
      setInvoiceResult(null);
      setPdfInvoices(null);
      setBankResult(null);
      return;
    }

    setFile(candidate);
    setError("");
    setInvoiceResult(null);
    setPdfInvoices(null);
    setBankResult(null);
  };

  const chooseFile = (e) => {
    if (e.target.files.length > 0) {
      acceptFile(e.target.files[0]);
    }
  };

  const dropFile = (e) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files.length > 0) {
      acceptFile(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    loadClients();
    loadSuppliers();
  }, []);

  // Keep clientId in sync if route changes
  useEffect(() => {
    if (routeClientId) {
      setClientId(routeClientId);
    }
  }, [routeClientId]);

  // Switching Document Type between Bill and everything else swaps which
  // list the id belongs to (supplier vs customer) — a leftover id from the
  // other list would be silently wrong, so clear it. A locked route
  // (isClientLocked) always refers to a customer, so it never offers Bill.
  useEffect(() => {
    if (!isClientLocked) {
      setClientId("");
    }
  }, [isBill]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadClients = async () => {
    try {
      const res = await customerApi.getAll();
      setClients(res.customers || []);
    } catch (err) {
     }
  };

  const loadSuppliers = async () => {
    try {
      const res = await supplierApi.getAll();
      setSuppliers(res.suppliers || []);
    } catch (err) {
     }
  };

  const upload = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (requiresManualParty && !clientId) {
      setError(`Please select a ${partyNoun}.`);
      return;
    }

    if (requiresManualParty && selectedClientInactive) {
      setError(
        `This ${partyNoun} is inactive. Please activate the ${partyNoun} before adding documents.`
      );
      return;
    }

    if (!documentType) {
      setError("Please select a document type.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("image", file);
      if (clientId) {
        formData.append("client_id", clientId);
      }
      formData.append("document_type", documentType);

      const response = await uploadInvoice(formData);

      if (response.data.invoices) {
        setInvoiceResult(null);
        setPdfInvoices(response.data.invoices);
        toast.success(`Successfully uploaded ${response.data.totalInvoices} invoices.`);

        if (isClientLocked) {
          navigate(`/dashboard/customers/${clientId}`);
        }
      } else if (response.data.bankStatement) {
        setBankResult(response.data);
        toast.success(
          `Bank statement processed (${response.data.transactionCount} transaction(s)).`
        );

        if (isClientLocked) {
          navigate(`/dashboard/customers/${clientId}`);
        }
      } else {
        setPdfInvoices(null);
        setInvoiceResult({
          invoice: response.data.invoice,
          resolution: response.data.customerResolution || null,
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to upload document."
      );
    } finally {
      setLoading(false);
    }
  };

  const linkParty = async (invoiceId, partyId) => {
    if (!invoiceId || !partyId) return;

    try {
      setLinkingId(invoiceId);

      await updateInvoice(invoiceId, { client_id: partyId });

      const linkedName =
        parties.find((p) => String(p.id) === String(partyId))?.company_name || "";

      const nextResolution = { status: "matched", id: partyId, name: linkedName };

      setInvoiceResult((prev) =>
        prev && prev.invoice?.id === invoiceId
          ? {
              invoice: { ...prev.invoice, clientName: linkedName || prev.invoice.clientName },
              resolution: nextResolution,
            }
          : prev
      );

      setPdfInvoices((prev) =>
        prev
          ? prev.map((inv) =>
              inv.id === invoiceId
                ? {
                    ...inv,
                    clientName: linkedName || inv.clientName,
                    customerResolution: nextResolution,
                  }
                : inv
            )
          : prev
      );

      toast.success(`Linked to ${linkedName}.`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to link this document.");
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Upload Invoice
        </h1>

        <p className="text-slate-500 mt-2">
          {isClientLocked && selectedClient
            ? `Uploading for ${selectedClient.company_name}`
            : "Upload PDF or Image invoices for OCR processing."}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow border p-8">

        <div className="mb-8">
          <label className="block mb-2 text-sm font-semibold text-slate-900">
            Document Type
          </label>

          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full rounded-xl border p-3 bg-white text-slate-900"
          >
            <option value="">Select Document Type</option>

            {DOCUMENT_TYPES.filter(
              (type) => !isClientLocked || type.value !== "bill"
            ).map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <p className="text-sm text-slate-500 mt-2">
            {isBankStatement
              ? "Bank statements need a customer selected below."
              : "The customer/supplier is detected automatically from the document once uploaded."}
          </p>
        </div>

        {requiresManualParty && (
          <div className="mb-8">
            <label className="block mb-2 text-sm font-semibold text-slate-900">
              {isClientLocked ? "Customer" : isBill ? "Select Supplier" : "Select Customer"}
            </label>

            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isClientLocked}
              className="w-full rounded-xl border p-3 bg-white text-slate-900 disabled:bg-slate-100"
            >
              <option value="">{isBill ? "Select Supplier" : "Select Customer"}</option>

              {parties.map((party) => (
                <option
                  key={party.id}
                  value={party.id}
                  disabled={!isPartyActive(party.status)}
                >
                  {party.company_name}
                  {!isPartyActive(party.status) ? " (Inactive)" : ""}
                </option>
              ))}
            </select>

            {isClientLocked && !selectedClientInactive && (
              <p className="text-sm text-slate-500 mt-2">
                Customer is already selected from Customer Details.
              </p>
            )}

            {selectedClientInactive && (
              <div className="mt-3 rounded-xl bg-red-50 text-red-600 p-3 text-sm">
                This {partyNoun} is inactive. Please activate the {partyNoun} before adding documents.
              </div>
            )}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={dropFile}
          className={`
            border-2 border-dashed rounded-2xl p-12 text-center transition
            ${dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300"}
          `}
        >
          <UploadCloud className="mx-auto text-indigo-600" size={60} />

          <h2 className="text-xl font-semibold mt-5">
            Drag & Drop Invoice
          </h2>

          <p className="text-slate-500 mt-2">
            PDF, JPG, PNG supported — up to {MAX_FILE_SIZE_MB} MB
          </p>

          <label className="inline-block mt-6">
            <input
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={chooseFile}
            />
            <span className="cursor-pointer bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-xl hover:from-indigo-500 hover:to-violet-500 transition">
              Browse File
            </span>
          </label>
        </div>

        {file && (
          <div className="mt-8 rounded-2xl border p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="text-indigo-600" size={40} />
              <div>
                <h3 className="font-semibold">{file.name}</h3>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X />
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 text-red-600 p-4">
            {error}
          </div>
        )}

        <button
          disabled={loading || trialExpired || (requiresManualParty && selectedClientInactive)}
          onClick={upload}
          title={trialExpired ? "Your free trial has ended. Upgrade your plan to upload documents." : undefined}
          className="mt-8 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-3 rounded-xl flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing...
            </>
          ) : (
            <>
              <UploadCloud size={20} />
              Upload Invoice
            </>
          )}
        </button>
      </div>

      {bankResult && bankResult.bankStatement && (
        <div className="bg-white rounded-3xl shadow border p-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-slate-500">Bank Name</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.bankName || "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Account Title</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.accountTitle || "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Account Number</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.accountNumber || "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">IBAN</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.iban || "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Statement Period</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.fromDate || "-"} to {bankResult.bankStatement.toDate || "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Opening Balance</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.currency} {bankResult.bankStatement.openingBalance ?? "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Closing Balance</label>
              <p className="font-semibold text-slate-900">
                {bankResult.bankStatement.currency} {bankResult.bankStatement.closingBalance ?? "-"}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Transactions Extracted</label>
              <p className="font-semibold text-slate-900">
                {bankResult.transactionCount}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              navigate(`/dashboard/bank-statements/${bankResult.bankStatement.id}`)
            }
            className="mt-8 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-6 py-3 rounded-xl transition"
          >
            View Bank Statement
          </button>
        </div>
      )}

      {invoiceResult && invoiceResult.invoice && (
        <div className="bg-white rounded-3xl shadow border p-8 space-y-6">
          <ResolutionBanner resolution={invoiceResult.resolution} partyNoun={partyNoun} />

          {invoiceResult.resolution?.status === "needs_review" && (
            <ReviewPicker
              parties={parties}
              partyNoun={partyNoun}
              linking={linkingId === invoiceResult.invoice.id}
              onLink={(partyId) => linkParty(invoiceResult.invoice.id, partyId)}
              addHref={addPartyHref}
            />
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-slate-500">Invoice Number</label>
              <p className="font-semibold text-slate-900">
                {invoiceResult.invoice?.invoiceNo}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Document Type</label>
              <p className="font-semibold text-slate-900">
                {documentTypeLabel(invoiceResult.invoice?.document_type)}
              </p>
            </div>

            <div>
              <label className="text-slate-500">{isBill ? "Supplier" : "Customer"}</label>
              <p className="font-semibold text-slate-900">
                {invoiceResult.invoice?.clientName || selectedClient?.company_name}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Invoice Date</label>
              <p className="font-semibold text-slate-900">
                {invoiceResult.invoice?.invoiceDate}
              </p>
            </div>

            <div>
              <label className="text-slate-500">Total Amount</label>
              <p className="font-semibold text-slate-900">
                {invoiceResult.invoice?.currency} {invoiceResult.invoice?.totalAmount}
              </p>
            </div>

            <div>
              <label className="text-slate-500">VAT Amount</label>
              <p className="font-semibold text-slate-900">
                {invoiceResult.invoice?.vatAmount}
              </p>
            </div>

            <div>
              <label className="text-slate-500">TRN</label>
              <p className="font-semibold text-slate-900">
                {invoiceResult.invoice?.trn}
              </p>
            </div>
          </div>
        </div>
      )}

      {pdfInvoices && pdfInvoices.length > 0 && (
        <div className="bg-white rounded-3xl shadow border p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {pdfInvoices.length} invoice{pdfInvoices.length === 1 ? "" : "s"} processed
          </h2>

          <div className="space-y-4">
            {pdfInvoices.map((inv) => (
              <div key={inv.id} className="rounded-2xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Invoice {inv.invoiceNo || "-"}
                    </p>
                    <p className="text-sm text-slate-500">{inv.clientName || "-"}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {inv.currency} {inv.totalAmount}
                  </p>
                </div>

                <ResolutionBanner resolution={inv.customerResolution} partyNoun={partyNoun} />

                {inv.customerResolution?.status === "needs_review" && (
                  <ReviewPicker
                    parties={parties}
                    partyNoun={partyNoun}
                    linking={linkingId === inv.id}
                    onLink={(partyId) => linkParty(inv.id, partyId)}
                    addHref={addPartyHref}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
