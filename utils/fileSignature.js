const fs = require("fs");

// Real magic-byte signatures for the only file types /api/upload accepts
// (see app-backend.js's multer fileFilter) — checked against the file's
// actual on-disk bytes, not just the client-supplied multipart Content-Type
// header, which a spoofed request can set to anything regardless of the
// file's real content (QA audit BUG-QA-03: a Windows executable renamed
// with a `image/png` Content-Type uploaded successfully).
const SIGNATURES = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]], // "%PDF-"
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/jpg": [[0xff, 0xd8, 0xff]],
};

function matchesSignature(buffer, signature) {
  return signature.every((byte, i) => buffer[i] === byte);
}

// Reads only as many leading bytes as the claimed mimetype's signature
// needs. Returns false for an unrecognized mimetype, a too-short file, or
// bytes that don't match any known signature for that type.
async function hasValidFileSignature(filePath, mimetype) {
  const signatures = SIGNATURES[mimetype];
  if (!signatures) return false;

  const maxLength = Math.max(...signatures.map((s) => s.length));
  const handle = await fs.promises.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(maxLength);
    const { bytesRead } = await handle.read(buffer, 0, maxLength, 0);

    if (bytesRead < maxLength) return false;

    return signatures.some((sig) => matchesSignature(buffer, sig));
  } finally {
    await handle.close();
  }
}

module.exports = { hasValidFileSignature };
