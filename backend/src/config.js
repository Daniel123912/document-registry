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

const smtpPort = Number(process.env.SMTP_PORT || 465);

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  passwordVaultKey:
    process.env.PASSWORD_VAULT_KEY || process.env.JWT_SECRET || "",
  moderatorLogin: process.env.MODERATOR_LOGIN || "",
  moderatorPassword: process.env.MODERATOR_PASSWORD || "",
  databaseUrl: buildDatabaseUrl(),
  uploadsDir,
  uploadsTmpDir,
  trashRetentionDays: Number(process.env.TRASH_RETENTION_DAYS || 30),
  appPublicUrl: process.env.APP_PUBLIC_URL || "http://127.0.0.1:5173",
  mail: {
    host: process.env.SMTP_HOST || "",
    port: smtpPort,
    secure:
      process.env.SMTP_SECURE != null
        ? process.env.SMTP_SECURE === "true"
        : smtpPort === 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from:
      process.env.MAIL_FROM ||
      process.env.SMTP_USER ||
      "Реестр БАКОР <noreply@mail.ru>",
  },
};
