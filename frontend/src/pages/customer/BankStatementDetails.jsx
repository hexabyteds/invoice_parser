import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { getBankStatement, getBankStatementSource } from "../../services/bankStatementApi";
import { formatDateDisplay } from "../../utils/formatDate";
import BankStatementTransactionsTable from "../../components/customer/BankStatementTransactionsTable";

export default function BankStatementDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceUrl, setSourceUrl] = useState(null);
  const [sourceKind, setSourceKind] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  useEffect(() => {
    async function loadStatement() {
      try {
        const res = await getBankStatement(id);
        setStatement(res.data.bankStatement);
      } catch (err) {
        const message =
          err.response?.data?.error || "Unable to load bank statement.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    loadStatement();
  }, [id]);

  useEffect(() => {
    let objectUrl;

    async function loadSource() {
      if (!statement?.imagePath) {
        setSourceUrl(null);
        setSourceKind(null);
        return;
      }

      setSourceLoading(true);
      try {
        const res = await getBankStatementSource(id);
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
  }, [id, statement?.imagePath]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border p-10 text-center">
        Loading bank statement...
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

  const hasSource = Boolean(statement?.imagePath);

  return (
    <div className="space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 mb-4 hover:underline"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold text-black">
            Bank Statement Details
          </h1>

          <p className="text-slate-500 mt-2">
            Statement summary and every extracted transaction.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">

        <div className="lg:col-span-2 bg-white rounded-2xl shadow border overflow-hidden">

          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-black">Statement Summary</h2>
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
                  <StaticCell label="Bank Name" value={statement.bankName} />
                  <StaticCell label="Account Title" value={statement.accountTitle} isLast />
                </tr>

                <tr className="border-b">
                  <StaticCell label="Account Number" value={statement.accountNumber} />
                  <StaticCell label="IBAN" value={statement.iban} isLast />
                </tr>

                <tr className="border-b">
                  <StaticCell label="Currency" value={statement.currency} />
                  <StaticCell
                    label="Statement Period"
                    value={`${formatDateDisplay(statement.fromDate)} - ${formatDateDisplay(statement.toDate)}`}
                    isLast
                  />
                </tr>

                <tr className="border-b">
                  <StaticCell label="Opening Balance" value={money(statement.openingBalance, statement.currency)} />
                  <StaticCell label="Closing Balance" value={money(statement.closingBalance, statement.currency)} isLast />
                </tr>

                <tr>
                  <StaticCell label="Pages Processed" value={statement.pageCount ?? "-"} />
                  <StaticCell label="Transactions" value={statement.transactionCount ?? "-"} isLast />
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <div className="bg-slate-200 rounded-2xl shadow border p-6 lg:sticky lg:top-8">
          <h2 className="text-lg font-bold text-black text-center mb-4">
            Document View
          </h2>

          {sourceLoading && (
            <p className="text-slate-500 text-center">Loading document...</p>
          )}

          {!sourceLoading && sourceUrl && sourceKind === "image" && (
            <img
              src={sourceUrl}
              alt="Uploaded bank statement"
              className="max-w-full rounded-xl border mx-auto"
            />
          )}

          {!sourceLoading && sourceUrl && sourceKind === "pdf" && (
            <iframe
              title="Uploaded bank statement PDF"
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

      <BankStatementTransactionsTable statementId={id} />

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
        className={`px-3 py-3 text-black font-semibold break-words align-top ${isLast ? "" : "border-r"
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
