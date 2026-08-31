const express = require("express");
const cors = require("cors");
const { port, trashRetentionDays } = require("./config");
const { initializeDatabase } = require("./db");
const { seedDefaultUsers } = require("./seed/users");
const { errorHandler } = require("./middleware/errorHandler");
const { migrateMissingDocumentNumbers, purgeExpiredTrash } = require("./services/documents");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const documentRoutes = require("./routes/documents");
const folderRoutes = require("./routes/folders");
const reportRoutes = require("./routes/reports");
const emailTemplateRoutes = require("./routes/emailTemplates");
const emailTemplateFolderRoutes = require("./routes/emailTemplateFolders");
const letterRoutes = require("./routes/letters");
const { seedDefaultTemplates } = require("./services/emailTemplates");

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/documents", documentRoutes);
app.use("/folders", folderRoutes);
app.use("/reports", reportRoutes);
app.use("/email-templates", emailTemplateRoutes);
app.use("/email-template-folders", emailTemplateFolderRoutes);
app.use("/letters", letterRoutes);

app.use(errorHandler);

initializeDatabase()
  .then(() => seedDefaultUsers())
  .then(() => seedDefaultTemplates())
  .then(async () => {
    const numbered = await migrateMissingDocumentNumbers();
    if (numbered > 0) {
      console.log(`Documents: assigned numbers to ${numbered} existing document(s).`);
    }

    const purged = await purgeExpiredTrash(trashRetentionDays);
    if (purged > 0) {
      console.log(`Trash: permanently removed ${purged} expired document(s).`);
    }

    setInterval(() => {
      purgeExpiredTrash(trashRetentionDays)
        .then((count) => {
          if (count > 0) {
            console.log(`Trash: permanently removed ${count} expired document(s).`);
          }
        })
        .catch((error) => {
          console.error("Trash purge failed", error);
        });
    }, 24 * 60 * 60 * 1000);

    app.listen(port, () => {
      console.log(`Bakor Docflow API listening on port ${port}`);
      console.log("Database: PostgreSQL");
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
