const path = require("path");
const multer = require("multer");
const { uploadsDir } = require("./config");

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    callback(null, `${Date.now()}-${safeName}`);
  },
});

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Допустимы только PDF, DOC и DOCX."));
  },
});

function fileUrl(req, relativePath) {
  return `${req.protocol}://${req.get("host")}/uploads/${path.basename(relativePath)}`;
}

module.exports = {
  upload,
  fileUrl,
};
