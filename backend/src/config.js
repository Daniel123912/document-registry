const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  useInMemoryDb: process.env.USE_IN_MEMORY_DB === "true",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/bakor_docflow",
  uploadsDir,
};
