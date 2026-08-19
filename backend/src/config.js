const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const uploadsDir = path.join(__dirname, "..", "uploads");
const uploadsTmpDir = path.join(uploadsDir, "tmp");

fs.mkdirSync(uploadsTmpDir, { recursive: true });

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const name = process.env.DB_NAME || "my_project_db";
  const user = encodeURIComponent(process.env.DB_USER || "postgres");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "123456");

  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  databaseUrl: buildDatabaseUrl(),
  uploadsDir,
  uploadsTmpDir,
  trashRetentionDays: Number(process.env.TRASH_RETENTION_DAYS || 30),
};
