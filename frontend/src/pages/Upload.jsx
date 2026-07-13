import { useState, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { uploadInvoice } from "../services/invoiceApi";
import clientApi from "../services/clientApi";
import { useParams, useNavigate } from "react-router-dom";

export default function Upload() {
  const { clientId: routeClientId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(routeClientId || "");

  // When opened from Client Details, client is locked
  const isClientLocked = Boolean(routeClientId);

  const selectedClient = clients.find(
    (c) => String(c.id) === String(clientId)
  );

  const chooseFile = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
      setResult(null);
    }
  };

  const dropFile = (e) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError("");
      setResult(null);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Keep clientId in sync if route changes
  useEffect(() => {
    if (routeClientId) {
      setClientId(routeClientId);
    }
  }, [routeClientId]);

  const loadClients = async () => {
    try {
      const res = await clientApi.getAll();
      setClients(res.clients || []);
    } catch (err) {
      console.log(err);
    }
  };

  const upload = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (!clientId) {
      setError("Please select a client.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("image", file);
      formData.append("client_id", clientId);

      const response = await uploadInvoice(formData);

      if (response.data.invoices) {
        setResult(null);
        alert(
          `${response.data.totalInvoices} invoice(s) imported successfully.`
        );

        if (isClientLocked) {
          navigate(`/dashboard/clients/${clientId}`);
        }
      } else {
        setResult(response.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to upload invoice."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
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
          <label className="block mb-2 text-sm font-semibold text-black">
            {isClientLocked ? "Client" : "Select Client"}
          </label>

          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={isClientLocked}
            className="w-full rounded-xl border p-3 bg-white text-black disabled:bg-slate-100"
          >
            <option value="">Select Client</option>

            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company_name}
              </option>
            ))}
          </select>

          {isClientLocked && (
            <p className="text-sm text-slate-500 mt-2">
              Client is already selected from Client Details.
            </p>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={dropFile}
          className={`
            border-2 border-dashed rounded-2xl p-12 text-center transition
            ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300"}
          `}
        >
          <UploadCloud className="mx-auto text-blue-600" size={60} />

          <h2 className="text-xl font-semibold mt-5">
            Drag & Drop Invoice
          </h2>

          <p className="text-slate-500 mt-2">
            PDF, JPG, PNG supported
          </p>

          <label className="inline-block mt-6">
            <input
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={chooseFile}
            />
            <span className="cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition">
              Browse File
            </span>
          </label>
        </div>

        {file && (
          <div className="mt-8 rounded-2xl border p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="text-blue-600" size={40} />
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
          disabled={loading}
          onClick={upload}
          className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl flex items-center gap-2 disabled:opacity-60"
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

      {result && (
        <div className="bg-white rounded-3xl shadow border p-8 grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-slate-500">Invoice Number</label>
            <p className="font-semibold text-black">
              {result.invoice?.invoiceNo}
            </p>
          </div>

          <div>
            <label className="text-slate-500">Client</label>
            <p className="font-semibold text-black">
              {result.invoice?.clientName || selectedClient?.company_name}
            </p>
          </div>

          <div>
            <label className="text-slate-500">Invoice Date</label>
            <p className="font-semibold text-black">
              {result.invoice?.invoiceDate}
            </p>
          </div>

          <div>
            <label className="text-slate-500">Total Amount</label>
            <p className="font-semibold text-black">
              {result.invoice?.currency} {result.invoice?.totalAmount}
            </p>
          </div>

          <div>
            <label className="text-slate-500">VAT Amount</label>
            <p className="font-semibold text-black">
              {result.invoice?.vatAmount}
            </p>
          </div>

          <div>
            <label className="text-slate-500">TRN</label>
            <p className="font-semibold text-black">
              {result.invoice?.trn}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
