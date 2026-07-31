import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  Receipt,
  Phone,
  MapPin,
  FileText,
  BadgeDollarSign,
} from "lucide-react";
import { getInvoice, getInvoiceSource } from "../../services/invoiceApi";
import ExtractionQualityCard from "../../components/invoices/ExtractionQualityCard";
import { formatDateDisplay } from "../../utils/formatDate";

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceUrl, setSourceUrl] = useState(null);
  const [sourceKind, setSourceKind] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await getInvoice(id);

        setInvoice(res.data.invoice);
        setLineItems(res.data.lineItems || []);
        setValidation(res.data.validation || null);

      } catch (err) {
        const message =
          err.response?.data?.error || "Unable to load invoice.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [id]);

  useEffect(() => {
    let objectUrl;

    async function loadSource() {
      if (!invoice?.hasSourceFile && !invoice?.image_path) {
        setSourceUrl(null);
        setSourceKind(null);
        return;
      }

      setSourceLoading(true);
      try {
        const res = await getInvoiceSource(id);
        const blob = res.data;
        objectUrl = URL.createObjectURL(blob);
        setSourceUrl(objectUrl);
        setSourceKind((blob.type || "").includes("pdf") ? "pdf" : "image");
      } catch {
        setSourceUrl(null);
        setSourceKind(null);
      } finally {
        setSourceLoading(false);
      }
    }

    loadSource();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, invoice?.hasSourceFile, invoice?.image_path]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border p-10 text-center">
        Loading invoice...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-red-600">
        {error}
      </div>
    );
  }

  const hasSource = Boolean(invoice?.hasSourceFile || invoice?.image_path);

  return (
    <div className="space-y-8">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 mb-4 hover:underline"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold" style={{ color: "black" }}>
            Invoice Details
          </h1>

          <p className="text-slate-500 mt-2" style={{ color: "black" }}>
            Complete extracted invoice information.
          </p>

        </div>

      </div>

      {/* Invoice Info */}

      <div className="bg-white rounded-3xl shadow border p-8">

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          <InfoCard
            icon={<Receipt size={20} />}
            title="Invoice Number"
            value={invoice.invoice_no}
          />

          <InfoCard
            icon={<Building2 size={20} />}
            title="Client"
            value={invoice.client_name}
          />

          <InfoCard
            icon={<Calendar size={20} />}
            title="Invoice Date"
            value={formatDateDisplay(invoice.invoice_date)}
          />

          <InfoCard
            icon={<CreditCard size={20} />}
            title="Currency"
            value={invoice.currency}
          />

          <InfoCard
            icon={<BadgeDollarSign size={20} />}
            title="Total Amount"
            value={`${invoice.currency} ${Number(
              invoice.total_amount
            ).toFixed(2)}`}
          />

          <InfoCard
            icon={<Receipt size={20} />}
            title="VAT"
            value={`${invoice.currency} ${Number(
              invoice.vat_amount
            ).toFixed(2)}`}
          />

          <InfoCard
            icon={<Phone size={20} />}
            title="Phone"
            value={invoice.phoneNumber || "-"}
          />

          <InfoCard
            icon={<FileText size={20} />}
            title="TRN"
            value={invoice.trn || "-"}
          />

          <InfoCard
            icon={<MapPin size={20} />}
            title="Location"
            value={invoice.location || "-"}
          />

        </div>

      </div>

      {validation && <ExtractionQualityCard validation={validation} />}

      {/* Description */}

      {/* <div className="bg-white rounded-3xl shadow border p-8">

        <h2 className="text-xl font-semibold mb-4">
          Description
        </h2>

        <p className="text-slate-600 whitespace-pre-wrap">
          {invoice.description || "-"}
        </p>

      </div> */}

      {/* Totals */}

      <div className="bg-white rounded-3xl shadow border p-8">

        <h2 className="text-xl font-semibold mb-6">
          Financial Summary
        </h2>

        <div className="grid md:grid-cols-4 gap-5">

          <SummaryCard
            title="Subtotal"
            value={invoice.subtotal}
            currency={invoice.currency}
          />

          <SummaryCard
            title="VAT Rate"
            value={`${invoice.vat_rate}%`}
          />

          <SummaryCard
            title="VAT Amount"
            value={invoice.vat_amount}
            currency={invoice.currency}
          />

          <SummaryCard
            title="Total"
            value={invoice.total_amount}
            currency={invoice.currency}
          />

        </div>

      </div>

      {/* Line Items — paired side-by-side with the original document
          (when one exists) so the extracted numbers are easy to check
          against the source file at a glance. */}

      <div className={`grid gap-6 items-start ${hasSource ? "lg:grid-cols-2" : ""}`}>

      <div className="bg-white rounded-3xl shadow border overflow-hidden">

        <div className="p-6 border-b">

          <h2 className="text-xl font-semibold" style={{ color: "black" }}>
            Line Items ({lineItems.length})
          </h2>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead className="bg-slate-50">

              <tr>

                <th className="text-left px-6 py-4 text-black">Description</th>

                <th className="text-center px-6 py-4" style={{ color: "black" }}>
                  Qty
                </th>

                <th className="text-right px-6 py-4" style={{ color: "black" }}>
                  Unit Price
                </th>

                <th className="text-right px-6 py-4" style={{ color: "black" }}>
                  Without VAT
                </th>

                <th className="text-right px-6 py-4" style={{ color: "black" }}>
                  VAT
                </th>

                <th className="text-right px-6 py-4" style={{ color: "black" }}>
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              {lineItems.map((item, index) => {
                // item.total_price is stored pre-VAT (it sums to the
                // invoice's Subtotal, not its VAT-inclusive Total) — line
                // items don't store their own VAT split, so VAT and the
                // inclusive total are derived from the invoice's overall
                // VAT rate applied to this line's pre-tax amount.
                const vatRate = Number(invoice.vat_rate) || 0;
                const withoutVat = Number(item.total_price) || 0;
                const vatAmount = withoutVat * (vatRate / 100);
                const totalPrice = withoutVat + vatAmount;

                return (
                  <tr
                    key={index}
                    className="border-t hover:bg-slate-50"
                  >

                    <td className="px-6 py-4" style={{ color: "black" }}>
                      {item.description}
                    </td>

                    <td className="px-6 py-4 text-center" style={{ color: "black" }}>
                      {item.quantity}
                    </td>

                    <td className="px-6 py-4 text-right" style={{ color: "black" }}>
                      {Number(item.unit_price).toFixed(2)}
                    </td>

                    <td className="px-6 py-4 text-right" style={{ color: "black" }}>
                      {withoutVat.toFixed(2)}
                    </td>

                    <td className="px-6 py-4 text-right" style={{ color: "black" }}>
                      {vatAmount.toFixed(2)}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold" style={{ color: "black" }}>
                      {totalPrice.toFixed(2)}
                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>

      </div>

      {hasSource && (
        <div className="bg-white rounded-3xl shadow border p-8 lg:sticky lg:top-8">
          <h2 className="text-xl font-semibold mb-4 text-black">
            Original Document
          </h2>

          {sourceLoading && (
            <p className="text-slate-500">Loading document...</p>
          )}

          {!sourceLoading && sourceUrl && sourceKind === "image" && (
            <img
              src={sourceUrl}
              alt="Uploaded invoice"
              className="max-w-full rounded-xl border"
            />
          )}

          {!sourceLoading && sourceUrl && sourceKind === "pdf" && (
            // #toolbar=0&navpanes=0 strips the browser's native PDF
            // viewer chrome (toolbar, page thumbnails) so this shows
            // just the file itself alongside the line items table.
            <iframe
              title="Uploaded invoice PDF"
              src={`${sourceUrl}#toolbar=0&navpanes=0`}
              className="w-full h-[600px] rounded-xl border"
            />
          )}

          {!sourceLoading && !sourceUrl && (
            <p className="text-slate-500">
              Original file is not available on the server.
            </p>
          )}
        </div>
      )}

      </div>

    </div>
  );
}

function InfoCard({ icon, title, value }) {
  return (
    <div className="border rounded-2xl p-5">
      <div className="flex items-center gap-2 text-blue-600 mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>

      <div className="font-semibold break-words text-black">
        {value}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, currency }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 border">
      <div className="text-sm text-slate-500">
        {title}
      </div>

      <div className="mt-2 text-2xl font-bold text-slate-800">
        {currency ? `${currency} ${value}` : value}
      </div>
    </div>
  );
}