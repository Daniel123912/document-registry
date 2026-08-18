const express = require("express");
const cors = require("cors");
const path = require("path");
const { z } = require("zod");
const { port, frontendUrl } = require("./config");
const { initializeDatabase, query, withTransaction } = require("./db");
const { seedDefaultUsers } = require("./seedData");
const {
  signToken,
  hashPassword,
  comparePassword,
  requireAuth,
  requireResponsible,
} = require("./auth");
const { upload, fileUrl } = require("./uploads");
const { normalizeDocument } = require("./serializers");

const app = express();

app.use(
  cors({
    origin: frontendUrl,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseJsonArrayField(value) {
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return [];
  }
}

async function getDocumentList({ userId, role, onlyAssigned, req }) {
  const params = [];
  let whereClause = "";

  if (onlyAssigned) {
    params.push(userId);
    whereClause = `WHERE d.status = 'published' AND EXISTS (
      SELECT 1 FROM document_assignments da
      WHERE da.document_id = d.id AND da.user_id = $${params.length}
    )`;
  } else if (role !== "responsible") {
    params.push(userId);
    whereClause = `WHERE d.author_id = $${params.length}`;
  }

  const sql = `
    SELECT
      d.*,
      u.full_name AS author_name,
      COALESCE(assign_counts.assigned_count, 0) AS assigned_count,
      COALESCE(ack_counts.acknowledged_count, 0) AS acknowledged_count,
      GREATEST(COALESCE(assign_counts.assigned_count, 0) - COALESCE(ack_counts.acknowledged_count, 0), 0) AS pending_count,
      COALESCE(active_version.original_filename, d.draft_original_filename) AS current_filename,
      COALESCE(active_version.file_path, d.draft_file_path) AS current_file_path,
      CASE
        WHEN ack_self.user_id IS NULL THEN FALSE
        ELSE TRUE
      END AS is_acknowledged
    FROM documents d
    JOIN users u ON u.id = d.author_id
    LEFT JOIN (
      SELECT document_id, COUNT(*) AS assigned_count
      FROM document_assignments
      GROUP BY document_id
    ) assign_counts ON assign_counts.document_id = d.id
    LEFT JOIN (
      SELECT document_id, version_no, COUNT(*) AS acknowledged_count
      FROM document_acknowledgements
      GROUP BY document_id, version_no
    ) ack_counts ON ack_counts.document_id = d.id AND ack_counts.version_no = d.active_version_no
    LEFT JOIN document_versions active_version
      ON active_version.document_id = d.id AND active_version.version_no = d.active_version_no
    LEFT JOIN document_acknowledgements ack_self
      ON ack_self.document_id = d.id AND ack_self.version_no = d.active_version_no AND ack_self.user_id = $${params.push(userId)}
    ${whereClause}
    ORDER BY d.created_at DESC
  `;

  const result = await query(sql, params);
  const documents = [];

  for (const row of result.rows) {
    const [versionsResult, usersResult] = await Promise.all([
      query(
        `
          SELECT dv.version_no, dv.change_reason, dv.created_at, dv.original_filename, dv.file_path, u.full_name AS created_by_name
          FROM document_versions dv
          JOIN users u ON u.id = dv.created_by
          WHERE dv.document_id = $1
          ORDER BY dv.version_no DESC
        `,
        [row.id]
      ),
      query(
        `
          SELECT u.id, u.full_name, u.email
          FROM document_assignments da
          JOIN users u ON u.id = da.user_id
          WHERE da.document_id = $1
          ORDER BY u.full_name ASC
        `,
        [row.id]
      ),
    ]);

    documents.push(
      normalizeDocument({
        ...row,
        current_file_url: row.current_file_path ? fileUrl(req, row.current_file_path) : null,
        versions: versionsResult.rows.map((version) => ({
          versionNo: Number(version.version_no),
          changeReason: version.change_reason,
          createdAt: version.created_at,
          originalFilename: version.original_filename,
          createdByName: version.created_by_name,
          fileUrl: fileUrl(req, version.file_path),
        })),
        assigned_users: usersResult.rows.map((user) => ({
          id: Number(user.id),
          fullName: user.full_name,
          email: user.email,
        })),
      })
    );
  }

  return documents;
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.email(),
      password: z.string().min(4),
    });

    const parsed = schema.parse(req.body);
    const result = await query(
      "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
      [parsed.email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден." });
    }

    const isValid = await comparePassword(parsed.password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Неверный пароль." });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: Number(user.id),
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

app.get(
  "/users",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const result = await query(
      "SELECT id, full_name, email, role, is_active, created_at FROM users ORDER BY full_name ASC"
    );
    res.json(
      result.rows.map((user) => ({
        id: Number(user.id),
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
      }))
    );
  })
);

app.post(
  "/users",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.email(),
      password: z.string().min(4),
      role: z.enum(["responsible", "employee"]),
    });
    const parsed = schema.parse(req.body);

    const passwordHash = await hashPassword(parsed.password);
    const result = await query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      [parsed.fullName, parsed.email.toLowerCase(), passwordHash, parsed.role]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: Number(user.id),
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  })
);

app.get(
  "/documents",
  requireAuth,
  asyncHandler(async (req, res) => {
    const onlyAssigned = req.query.scope === "assigned";
    const documents = await getDocumentList({
      userId: Number(req.user.sub),
      role: req.user.role,
      onlyAssigned,
      req,
    });
    res.json(documents);
  })
);

app.get(
  "/documents/assigned/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const documents = await getDocumentList({
      userId: Number(req.user.sub),
      role: req.user.role,
      onlyAssigned: true,
      req,
    });
    res.json(documents);
  })
);

app.post(
  "/documents",
  requireAuth,
  requireResponsible,
  upload.single("docFile"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().min(1),
      type: z.enum(["order", "regulation", "instruction", "new_goods", "other"]),
      number: z.string().optional().default(""),
      documentDate: z.string().min(1),
      dueDate: z.string().min(1),
      description: z.string().optional().default(""),
    });

    const parsed = schema.parse(req.body);
    const assignedUsers = parseJsonArrayField(req.body.assignedUsers).map(Number);

    if (!req.file) {
      return res.status(400).json({ message: "Не удалось загрузить файл." });
    }

    const document = await withTransaction(async (client) => {
      const created = await client.query(
        `
          INSERT INTO documents (
            title, description, type, number, document_date, due_date, status, author_id,
            draft_file_path, draft_original_filename, draft_mime_type
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10)
          RETURNING *
        `,
        [
          parsed.title,
          parsed.description,
          parsed.type,
          parsed.number,
          parsed.documentDate,
          parsed.dueDate,
          Number(req.user.sub),
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
        ]
      );

      const documentRow = created.rows[0];

      for (const userId of assignedUsers) {
        await client.query(
          `
            INSERT INTO document_assignments (document_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (document_id, user_id) DO NOTHING
          `,
          [documentRow.id, userId]
        );
      }
      return documentRow;
    });

    res.status(201).json({
      message: "Документ сохранен как черновик.",
      id: Number(document.id),
    });
  })
);

app.post(
  "/documents/:id/publish",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const documentId = Number(req.params.id);
    await withTransaction(async (client) => {
      const documentResult = await client.query(
        "SELECT * FROM documents WHERE id = $1",
        [documentId]
      );
      const document = documentResult.rows[0];

      if (!document) {
        throw new Error("Документ не найден.");
      }

      const hasVersion = Number(document.active_version_no || 0) > 0;
      if (!hasVersion) {
        await client.query(
          `
            INSERT INTO document_versions (
              document_id, version_no, file_path, original_filename, mime_type, change_reason, created_by
            )
            VALUES ($1, 1, $2, $3, $4, $5, $6)
          `,
          [
            documentId,
            document.draft_file_path,
            document.draft_original_filename,
            document.draft_mime_type,
            "Первичная публикация",
            Number(req.user.sub),
          ]
        );
      }

      await client.query(
        `
          UPDATE documents
          SET status = 'published',
              active_version_no = CASE WHEN active_version_no = 0 THEN 1 ELSE active_version_no END,
              updated_at = NOW()
          WHERE id = $1
        `,
        [documentId]
      );
    });

    res.json({ message: "Документ опубликован." });
  })
);

app.post(
  "/documents/:id/versions",
  requireAuth,
  requireResponsible,
  upload.single("versionFile"),
  asyncHandler(async (req, res) => {
    const documentId = Number(req.params.id);
    const schema = z.object({
      changeReason: z.string().min(1),
    });
    const parsed = schema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ message: "Не удалось загрузить файл." });
    }

    await withTransaction(async (client) => {
      const currentVersionResult = await client.query(
        "SELECT active_version_no FROM documents WHERE id = $1",
        [documentId]
      );
      const currentVersionNo =
        Number(currentVersionResult.rows[0]?.active_version_no || 0) + 1;

      await client.query(
        `
          INSERT INTO document_versions (
            document_id, version_no, file_path, original_filename, mime_type, change_reason, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          documentId,
          currentVersionNo,
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          parsed.changeReason,
          Number(req.user.sub),
        ]
      );

      await client.query(
        `
          UPDATE documents
          SET active_version_no = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [documentId, currentVersionNo]
      );
    });

    res.json({ message: "Новая версия создана и активирована." });
  })
);

app.post(
  "/documents/:id/acknowledgements",
  requireAuth,
  asyncHandler(async (req, res) => {
    const documentId = Number(req.params.id);
    const schema = z.object({
      versionNo: z.number().int().positive(),
    });
    const parsed = schema.parse(req.body);
    const userId = Number(req.user.sub);

    const assignment = await query(
      `
        SELECT 1
        FROM document_assignments
        WHERE document_id = $1 AND user_id = $2
      `,
      [documentId, userId]
    );

    if (!assignment.rows.length) {
      return res.status(403).json({ message: "Документ не назначен вам." });
    }

    await query(
      `
        INSERT INTO document_acknowledgements (document_id, version_no, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (document_id, version_no, user_id)
        DO UPDATE SET acknowledged_at = NOW()
      `,
      [documentId, parsed.versionNo, userId]
    );

    res.json({ message: "Ознакомление зафиксировано." });
  })
);

app.get(
  "/reports/acknowledgements",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT
        d.id,
        d.title,
        d.active_version_no,
        COUNT(DISTINCT da.user_id) AS assigned_count,
        COUNT(DISTINCT ack.user_id) AS acknowledged_count
      FROM documents d
      LEFT JOIN document_assignments da ON da.document_id = d.id
      LEFT JOIN document_acknowledgements ack
        ON ack.document_id = d.id AND ack.version_no = d.active_version_no
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);

    res.json(
      result.rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        activeVersionNo: Number(row.active_version_no),
        assignedCount: Number(row.assigned_count),
        acknowledgedCount: Number(row.acknowledged_count),
        pendingCount:
          Number(row.assigned_count) - Number(row.acknowledged_count),
      }))
    );
  })
);

app.use((error, req, res, next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Некорректные данные формы.",
      issues: error.issues,
    });
  }

  if (error.message === "Допустимы только PDF, DOC и DOCX.") {
    return res.status(400).json({ message: error.message });
  }

  if (error.message === "Документ не найден.") {
    return res.status(404).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Внутренняя ошибка сервера." });
});

initializeDatabase()
  .then(() => seedDefaultUsers())
  .then(() => {
    app.listen(port, () => {
      console.log(`Bakor Docflow API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
