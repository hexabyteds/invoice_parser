import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { getInvoice, getInvoiceSource } from "../../services/invoiceApi";
import { formatDateDisplay } from "../../utils/formatDate";
import { documentTypeLabel } from "../../utils/documentTypes";
import ImageMagnifier from "../../components/common/ImageMagnifier";

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const invoiceIds = location.state?.invoiceIds || [];
  const currentIndex = invoiceIds.findIndex(
    (invoiceId) => String(invoiceId) === String(id)
  );
  const prevId = currentIndex > 0 ? invoiceIds[currentIndex - 1] : null;
  const nextId =
    currentIndex !== -1 && currentIndex < invoiceIds.length - 1
      ? invoiceIds[currentIndex + 1]
      : null;

  function goToInvoice(targetId) {
    // replace (not push) so Next/Previous don't grow the history stack —
    // Back should return to the list that was navigated from, not walk
    // back through every invoice visited via Next/Previous.
    navigate(`/dashboard/invoices/${targetId}`, {
      state: { invoiceIds },
      replace: true,
    });
  }

  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceUrl, setSourceUrl] = useState(null);
  const [sourceKind, setSourceKind] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(100);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await getInvoice(id);

        setInvoice(res.data.invoice);
        setLineItems(res.data.lineItems || []);

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
            className="flex items-center gap-2 text-indigo-600 mb-4 transition-colors hover:underline"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold text-slate-900">
            Document Details
          </h1>

          <p className="text-slate-500 mt-2">
            Complete extracted document information.
          </p>
        </div>

        {invoiceIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevId && goToInvoice(prevId)}
              disabled={!prevId}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              <ArrowLeft size={18} />
              Previous
            </button>

            <button
              onClick={() => nextId && goToInvoice(nextId)}
              disabled={!nextId}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              Next
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Document Details + Line Items (left) paired with the original
          document preview (right) — mirrors the Edit Invoice layout,
          but read-only. */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">

        <div className="lg:col-span-2 bg-white rounded-2xl shadow border overflow-hidden">

          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Document Details</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[33%]" />
                <col className="w-[17%]" />
                <col className="w-[33%]" />
              </colgroup>
              <tbody>
                <tr className="border-b">
                  <StaticCell label="Document No" value={invoice.invoice_no} />
                  <StaticCell
                    label="Amount Exc. VAT"
                    value={money(invoice.subtotal, invoice.currency)}
                    isLast
                  />
                </tr>

                <tr className="border-b">
                  <StaticCell
                    label="Document Date"
                    value={formatDateDisplay(invoice.invoice_date)}
                  />
                  <StaticCell
                    label="VAT Amount"
                    value={money(invoice.vat_amount, invoice.currency)}
                    isLast
                  />
                </tr>


                <tr className="border-b">
                  <StaticCell
                    label="Document Type"
                    value={documentTypeLabel(invoice.document_type)}
                  />
                  <StaticCell
                    label="Amount Inc. VAT"
                    value={money(invoice.total_amount, invoice.currency)}
                    isLast
                  />
                </tr>
                <tr className="border-b">
                  <StaticCell label="Phone" value={invoice.phoneNumber || "-"} />
                  <StaticCell label="VAT Rate (%)" value={`${invoice.vat_rate}%`} isLast />
                </tr>
                <tr className="border-b">
                  <StaticCell label="Due Date" value={formatDateDisplay(invoice.due_date) || "-"} />
                  <StaticCell label="Currency" value={invoice.currency} isLast />
                </tr>

                <tr className="border-b">
                  <StaticCell
                    label="Client"
                    value={invoice.client_company_name || invoice.client_name}
                  />
                  <StaticCell label="TRN Number" value={invoice.trn || "-"} isLast />
                </tr>

                <tr>
                  <StaticCell label="Party Name" value={invoice.client_name || "-"} />
                  <StaticCell label="Location" value={invoice.location || "-"} isLast />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Line Items ({lineItems.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-y-[3px] border-double border-slate-800 bg-slate-50">
                  <th className="text-left px-6 py-3 text-slate-900 font-bold">
                    Description
                  </th>
                  <th className="text-center px-6 py-3 text-slate-900 font-bold w-28">
                    Qty
                  </th>
                  <th className="text-right px-6 py-3 text-slate-900 font-bold w-40">
                    Unit Price
                  </th>
                  <th className="text-right px-6 py-3 text-slate-900 font-bold w-32">
                    Amount Exc. VAT
                  </th>
                  <th className="text-right px-6 py-3 text-slate-900 font-bold w-28">
                    VAT
                  </th>
                  <th className="text-right px-6 py-3 text-slate-900 font-bold w-32">
                    Amount Inc. VAT
                  </th>
                </tr>
              </thead>

              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      No line items.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, index) => {
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
                      <tr key={index} className="border-t">
                        <td className="px-6 py-3 text-slate-900">
                          {item.description}
                        </td>

                        <td className="px-6 py-3 text-center text-slate-900">
                          {item.quantity}
                        </td>

                        <td className="px-6 py-3 text-right text-slate-900">
                          {Number(item.unit_price).toFixed(2)}
                        </td>

                        <td className="px-6 py-3 text-right text-slate-900">
                          {withoutVat.toFixed(2)}
                        </td>

                        <td className="px-6 py-3 text-right text-slate-900">
                          {vatAmount.toFixed(2)}
                        </td>

                        <td className="px-6 py-3 text-right font-semibold text-slate-900">
                          {totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        <div className="bg-slate-200 rounded-2xl shadow border p-6 lg:sticky lg:top-8">
          <h2 className="text-lg font-bold text-slate-900 text-center mb-4">
            Document View
          </h2>

          {sourceLoading && (
            <p className="text-slate-500 text-center">Loading document...</p>
          )}

          {!sourceLoading && sourceUrl && sourceKind === "image" && (
            <img
              src={sourceUrl}
              alt="Uploaded invoice"
              className="max-w-full rounded-xl border mx-auto"
            />
          )}

          {!sourceLoading && sourceUrl && sourceKind === "pdf" && (
            // #toolbar=0&navpanes=0 strips the browser's native PDF
            // viewer chrome (toolbar, page thumbnails) so this shows
            // just the file itself in the preview panel.
            <iframe
              title="Uploaded invoice PDF"
              src={`${sourceUrl}#toolbar=0&navpanes=0`}
              className="w-full h-[600px] rounded-xl border"
            />
          )}

          {!sourceLoading && !sourceUrl && (
            <p className="text-slate-500 text-center">
              {hasSource
                ? "Original file is not available on the server."
                : "No source file was uploaded for this document."}
            </p>
          )}
        </div>

      </div>

    </div>
  );
}

function StaticCell({ label, value, isLast = false }) {
  return (
    <>
      <td className="px-3 py-3 text-slate-500 font-medium bg-slate-50/60 border-r align-top">
        {label}
      </td>
      <td
        className={`px-3 py-3 text-slate-900 font-semibold break-words align-top ${isLast ? "" : "border-r"
          }`}
      >
        {value ?? "-"}
      </td>
    </>
  );
}

function money(value, currency) {
  if (value === null || value === undefined || value === "") return "-";
  const formatted = Number(value).toFixed(2);
  return currency ? `${currency} ${formatted}` : formatted;
}
