const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  toRelativeKey,
  resolveStoredFile,
  placeUploadedFile,
  removeDocumentStorage,
  fileApiPath,
} = require("../src/utils/files");

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bakor-uploads-"));
}

test("converts absolute windows paths under uploads into relative keys", () => {
  const root = makeRoot();
  const stored = path.join(root, "documents", "12", "draft.pdf");
  assert.equal(toRelativeKey(stored, root), "documents/12/draft.pdf");
});

test("keeps only basename for absolute paths outside uploads", () => {
  const root = makeRoot();
  assert.equal(toRelativeKey("C:\\tmp\\old-doc.pdf", root), "old-doc.pdf");
});

test("rejects path traversal when resolving a stored file", () => {
  const root = makeRoot();
  const absolute = resolveStoredFile("../secret.txt", root);
  assert.equal(absolute, path.resolve(root, "secret.txt"));
  assert.ok(absolute.startsWith(path.resolve(root)));
});

test("places uploaded file under documents/id and can delete the folder", async () => {
  const root = makeRoot();
  const tmpFile = path.join(root, "incoming.pdf");
  await fs.promises.writeFile(tmpFile, "pdf");

  const relativeKey = await placeUploadedFile({
    documentId: 42,
    uploadedPath: tmpFile,
    originalName: "Акт.pdf",
    slot: "draft",
    root,
  });

  assert.equal(relativeKey, "documents/42/draft.pdf");
  assert.equal(fs.existsSync(path.join(root, "documents", "42", "draft.pdf")), true);
  assert.equal(fs.existsSync(tmpFile), false);

  await removeDocumentStorage(42, [relativeKey], root);
  assert.equal(fs.existsSync(path.join(root, "documents", "42")), false);
});

test("deletes leftover flat files that are not in the document folder", async () => {
  const root = makeRoot();
  const leftover = path.join(root, "1710000000-old.pdf");
  await fs.promises.writeFile(leftover, "old");

  await removeDocumentStorage(7, ["1710000000-old.pdf"], root);
  assert.equal(fs.existsSync(leftover), false);
});

test("builds authorized file api paths", () => {
  assert.equal(fileApiPath(15), "/documents/15/file");
  assert.equal(fileApiPath(15, 2), "/documents/15/file?version=2");
});
