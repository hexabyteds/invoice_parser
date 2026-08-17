const path = require("path");
const fs = require("fs/promises");

const defaultProjectRoot = path.join(__dirname, "..");

function toStoredSourcePath(filePath, projectRoot = defaultProjectRoot) {
  if (!filePath) {
    return null;
  }

  const uploadsRoot = path.join(projectRoot, "uploads");
  const absolute = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(projectRoot, filePath);

  if (absolute.startsWith(uploadsRoot)) {
    return path.relative(projectRoot, absolute).replace(/\\/g, "/");
  }

  const basename = path.basename(String(filePath).replace(/\\/g, "/"));
  return path.join("uploads", basename).replace(/\\/g, "/");
}

function resolveUploadPath(storedPath, projectRoot = defaultProjectRoot) {
  if (!storedPath) {
    return null;
  }

  const normalized = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalized.includes("..") || !normalized.startsWith("uploads/")) {
    return null;
  }

  const fullPath = path.join(projectRoot, normalized);
  const uploadsRoot = path.join(projectRoot, "uploads");

  if (!fullPath.startsWith(uploadsRoot)) {
    return null;
  }

  return fullPath;
}

// Deletes an invoice/bank-statement's stored source file and returns how
// many bytes it freed, so the caller can decrement usage_stats.storage_used
// by the file's real current size rather than a value recorded elsewhere
// (there's no file_size column — this is deliberately derived from the
// live file instead of requiring one). Best-effort: a missing or
// unreadable file must never block the DB delete the user actually asked
// for, so any failure here just means nothing gets reclaimed this time,
// not that the delete itself fails.
async function deleteStoredFileAndGetSize(storedPath, projectRoot = defaultProjectRoot) {
  const fullPath = resolveUploadPath(storedPath, projectRoot);

  if (!fullPath) {
    return 0;
  }

  try {
    const stats = await fs.stat(fullPath);
    await fs.unlink(fullPath);
    return stats.size;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`Failed to reclaim storage for ${storedPath}:`, err.message);
    }
    return 0;
  }
}

module.exports = {
  toStoredSourcePath,
  resolveUploadPath,
  deleteStoredFileAndGetSize,
};
