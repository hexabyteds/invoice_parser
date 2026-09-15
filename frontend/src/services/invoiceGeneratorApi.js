// Deliberately not using the shared axios instance in api.js — that
// instance's interceptors assume JSON responses (auth-token attachment,
// JSON error parsing), while this endpoint returns raw PDF bytes on
// success. It's also fully public/anonymous, so none of the auth
// interceptor logic applies anyway.
export async function generateInvoicePdf(payload) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/invoice-generator/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Couldn't generate the PDF right now. Please try again.";
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // Response body wasn't JSON (e.g. a rate-limit response) — keep the
      // generic message rather than surfacing a parse error.
    }
    throw new Error(message);
  }

  return response.blob();
}
