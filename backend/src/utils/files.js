const fs = require("fs");
const path = require("path");
const { uploadsDir } = require("../config");

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
]);

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function isInsideRoot(absolutePath, root) {
  const resolved = path.resolve(absolutePath);
  const resolvedRoot = path.resolve(root);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}

function toRelativeKey(stored, root = uploadsDir) {
  if (!stored) {
    return null;
  }

  const value = String(stored);
  const resolvedRoot = path.resolve(root);

  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
    const resolved = path.resolve(value);
    if (isInsideRoot(resolved, resolvedRoot)) {
      return toPosix(path.relative(resolvedRoot, resolved));
    }
    return path.basename(value);
  }

  const posix = toPosix(value).replace(/^\/+/, "");
  if (!posix || posix.includes("..")) {
    return path.basename(posix);
  }

  return posix;
}

function resolveStoredFile(stored, root = uploadsDir) {
  const relativeKey = toRelativeKey(stored, root);
  if (!relativeKey) {
    const error = new Error("Файл не найден.");
    error.statusCode = 404;
    throw error;
  }

  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, relativeKey);

  if (!isInsideRoot(absolutePath, resolvedRoot)) {
    const error = new Error("Файл не найден.");
    error.statusCode = 404;
    throw error;
  }

  return absolutePath;
}

function safeExtension(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : "";
}

function fileApiPath(documentId, versionNo) {
  if (versionNo) {
    return `/documents/${documentId}/file?version=${versionNo}`;
  }

  return `/documents/${documentId}/file`;
}

function contentDisposition(filename, type = "inline") {
  const fallback = String(filename || "document").replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename || "document");
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

async function removeIfExists(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function placeUploadedFile({
  documentId,
  uploadedPath,
  originalName,
  slot,
  root = uploadsDir,
}) {
  const relativeKey = `documents/${Number(documentId)}/${slot}${safeExtension(originalName)}`;
  const destination = resolveStoredFile(relativeKey, root);

  await fs.promises.mkdir(path.dirname(destination), { recursive: true });

  try {
    await fs.promises.rename(uploadedPath, destination);
  } catch (error) {
    if (error.code !== "EXDEV") {
      throw error;
    }

    await fs.promises.copyFile(uploadedPath, destination);
    await removeIfExists(uploadedPath);
  }

  return relativeKey;
}

async function removeDocumentStorage(documentId, storedPaths = [], root = uploadsDir) {
  const documentRoot = path.resolve(root, "documents", String(documentId));
  await fs.promises.rm(documentRoot, { recursive: true, force: true });

  for (const stored of storedPaths) {
    try {
      const absolutePath = resolveStoredFile(stored, root);
      if (!isInsideRoot(absolutePath, documentRoot)) {
        await removeIfExists(absolutePath);
      }
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }
}

async function migrateStoredFilePaths(query) {
  const documents = await query(
    "SELECT id, draft_file_path FROM documents WHERE draft_file_path IS NOT NULL"
  );

  for (const row of documents.rows) {
    const next = toRelativeKey(row.draft_file_path);
    if (next && next !== row.draft_file_path) {
      await query("UPDATE documents SET draft_file_path = $2 WHERE id = $1", [row.id, next]);
    }
  }

  const versions = await query("SELECT id, file_path FROM document_versions");

  for (const row of versions.rows) {
    const next = toRelativeKey(row.file_path);
    if (next && next !== row.file_path) {
      await query("UPDATE document_versions SET file_path = $2 WHERE id = $1", [row.id, next]);
    }
  }
}

module.exports = {
  toRelativeKey,
  resolveStoredFile,
  safeExtension,
  fileApiPath,
  contentDisposition,
  removeIfExists,
  placeUploadedFile,
  removeDocumentStorage,
  migrateStoredFilePaths,
};
