const path = require("path");

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

module.exports = {
  toStoredSourcePath,
  resolveUploadPath,
};
