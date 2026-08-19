const multer = require("multer");
const { uploadsTmpDir } = require("../config");
const { decodeOriginalFilename } = require("./filenames");

const storage = multer.diskStorage({
  destination: uploadsTmpDir,
  filename: (req, file, callback) => {
    const originalName = decodeOriginalFilename(file.originalname);
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    callback(null, `${Date.now()}-${safeName}`);
  },
});

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const upload = multer({
  storage,
  defParamCharset: "utf8",
  fileFilter: (req, file, callback) => {
    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Допустимы только PDF, DOC, DOCX и изображения."));
  },
});

module.exports = {
  upload,
};
