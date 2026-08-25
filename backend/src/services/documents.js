const fs = require("fs");
const { query, withTransaction } = require("../db");
const { trashRetentionDays } = require("../config");
const { decodeOriginalFilename } = require("../utils/filenames");
const { normalizeDocument } = require("../utils/serializers");
const { assertFolderMatchesType } = require("./folders");
const {
  fileApiPath,
  placeUploadedFile,
  removeDocumentStorage,
  removeIfExists,
  resolveStoredFile,
} = require("../utils/files");

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

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function listDocuments({ userId, role, onlyAssigned, trash = false }) {
  const params = [userId];
  const whereParts = [];

  if (trash) {
    whereParts.push("d.deleted_at IS NOT NULL");
  } else {
    whereParts.push("d.deleted_at IS NULL");
    if (onlyAssigned) {
      whereParts.push("d.status = 'published'");
      whereParts.push("current_assignment.user_id IS NOT NULL");
    } else if (role !== "responsible") {
      // All employees can browse published/archived documents;
      // document_assignments only control notifications / acknowledgement.
      whereParts.push("d.status IN ('published', 'archived')");
    }
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const sql = `
    SELECT
      d.*,
      u.full_name AS author_name,
      COALESCE(assign_counts.assigned_count, 0) AS assigned_count,
      COALESCE(ack_counts.acknowledged_count, 0) AS acknowledged_count,
      GREATEST(COALESCE(assign_counts.assigned_count, 0) - COALESCE(ack_counts.acknowledged_count, 0), 0) AS pending_count,
      COALESCE(active_version.original_filename, d.draft_original_filename) AS current_filename,
      COALESCE(active_version.file_path, d.draft_file_path) AS current_file_path,
      COALESCE(active_version.mime_type, d.draft_mime_type) AS current_mime_type,
      CASE
        WHEN ack_self.user_id IS NULL THEN FALSE
        ELSE TRUE
      END AS is_acknowledged,
      CASE
        WHEN current_assignment.user_id IS NULL THEN FALSE
        ELSE TRUE
      END AS is_assigned
    FROM documents d
    JOIN users u ON u.id = d.author_id
    LEFT JOIN (
      SELECT document_id, COUNT(*) AS assigned_count
      FROM document_assignments
      GROUP BY document_id
    ) assign_counts ON assign_counts.document_id = d.id
    LEFT JOIN document_assignments current_assignment
      ON current_assignment.document_id = d.id AND current_assignment.user_id = $1
    LEFT JOIN (
      SELECT document_id, version_no, COUNT(*) AS acknowledged_count
      FROM document_acknowledgements
      GROUP BY document_id, version_no
    ) ack_counts ON ack_counts.document_id = d.id AND ack_counts.version_no = d.active_version_no
    LEFT JOIN document_versions active_version
      ON active_version.document_id = d.id AND active_version.version_no = d.active_version_no
    LEFT JOIN document_acknowledgements ack_self
      ON ack_self.document_id = d.id AND ack_self.version_no = d.active_version_no AND ack_self.user_id = $1
    ${whereClause}
    ORDER BY d.created_at DESC
  `;

  const result = await query(sql, params);
  if (!result.rows.length) {
    return [];
  }

  const documentIds = result.rows.map((row) => row.id);
  const versionsByDocumentId = new Map();
  const assignedUsersByDocumentId = new Map();

  const [versionsResult, usersResult] = await Promise.all([
    query(
      `
        SELECT
          dv.document_id,
          dv.version_no,
          dv.change_reason,
          dv.created_at,
          dv.original_filename,
          dv.file_path,
          dv.mime_type,
          u.full_name AS created_by_name
        FROM document_versions dv
        JOIN users u ON u.id = dv.created_by
        WHERE dv.document_id = ANY($1::bigint[])
        ORDER BY dv.document_id ASC, dv.version_no DESC
      `,
      [documentIds]
    ),
    query(
      `
        SELECT
          da.document_id,
          u.id,
          u.full_name,
          u.email,
          EXISTS (
            SELECT 1
            FROM document_acknowledgements ack
            WHERE ack.document_id = da.document_id
              AND ack.user_id = u.id
              AND ack.version_no = d.active_version_no
          ) AS is_acknowledged
        FROM document_assignments da
        JOIN documents d ON d.id = da.document_id
        JOIN users u ON u.id = da.user_id
        WHERE da.document_id = ANY($1::bigint[])
        ORDER BY da.document_id ASC, u.full_name ASC
      `,
      [documentIds]
    ),
  ]);

  for (const version of versionsResult.rows) {
    const documentId = Number(version.document_id);
    const versions = versionsByDocumentId.get(documentId) || [];
    versions.push({
      versionNo: Number(version.version_no),
      changeReason: version.change_reason,
      createdAt: version.created_at,
      originalFilename: version.original_filename,
      createdByName: version.created_by_name,
      mimeType: version.mime_type,
      fileUrl: fileApiPath(documentId, Number(version.version_no)),
    });
    versionsByDocumentId.set(documentId, versions);
  }

  for (const user of usersResult.rows) {
    const documentId = Number(user.document_id);
    const assignedUsers = assignedUsersByDocumentId.get(documentId) || [];
    assignedUsers.push({
      id: Number(user.id),
      fullName: user.full_name,
      email: user.email,
      isAcknowledged: Boolean(user.is_acknowledged),
    });
    assignedUsersByDocumentId.set(documentId, assignedUsers);
  }

  return result.rows.map((row) => {
    const documentId = Number(row.id);
    return normalizeDocument({
      ...row,
      current_file_url: row.current_file_path ? fileApiPath(row.id) : null,
      versions: versionsByDocumentId.get(documentId) || [],
      assigned_users: assignedUsersByDocumentId.get(documentId) || [],
    });
  });
}

async function getDocumentOrThrow(documentId, { allowDeleted = false } = {}) {
  const documentResult = await query("SELECT * FROM documents WHERE id = $1", [documentId]);
  const document = documentResult.rows[0];

  if (!document) {
    throw new Error("Документ не найден.");
  }

  if (!allowDeleted && document.deleted_at) {
    throw httpError(404, "Документ не найден.");
  }

  return document;
}

const DOCUMENT_NUMBER_PREFIXES = {
  order: "ПР",
  regulation: "РГ",
  instruction: "ИН",
  new_goods: "НТ",
  other: "ДР",
};

function normalizeDocumentNumber(value) {
  return String(value || "").trim();
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

async function assertDocumentNumberAvailable(client, { type, number, excludeDocumentId = null }) {
  const normalizedNumber = normalizeDocumentNumber(number);
  if (!normalizedNumber) {
    return;
  }

  const result = await client.query(
    `
      SELECT id
      FROM documents
      WHERE type = $1
        AND number = $2
        AND ($3::bigint IS NULL OR id <> $3)
      LIMIT 1
    `,
    [type, normalizedNumber, excludeDocumentId]
  );

  if (result.rows.length) {
    throw httpError(409, "Документ с таким номером уже существует.");
  }
}

async function generateDocumentNumber(client, type) {
  const prefix = DOCUMENT_NUMBER_PREFIXES[type] || "ДК";
  const existingNumbers = await client.query("SELECT number FROM documents WHERE type = $1", [type]);

  let maxNumber = 0;
  for (const row of existingNumbers.rows) {
    const value = normalizeDocumentNumber(row.number).toUpperCase();
    const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!match) {
      continue;
    }

    const numericPart = Number(match[1]);
    if (Number.isFinite(numericPart) && numericPart > maxNumber) {
      maxNumber = numericPart;
    }
  }

  return `${prefix}${String(maxNumber + 1).padStart(4, "0")}`;
}

async function createDocument({ parsed, assignedUsers, file, authorId }) {
  const originalName = decodeOriginalFilename(file.originalname);
  let documentId;
  const manualNumber = normalizeDocumentNumber(parsed.number);

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await withTransaction(async (client) => {
          if (manualNumber) {
            await assertDocumentNumberAvailable(client, {
              type: parsed.type,
              number: manualNumber,
            });
          }

          const documentNumber = manualNumber || (await generateDocumentNumber(client, parsed.type));
          const folderId =
            parsed.folderId == null || parsed.folderId === ""
              ? null
              : Number(parsed.folderId);
          await assertFolderMatchesType(client, folderId, parsed.type);

          const created = await client.query(
            `
              INSERT INTO documents (
                title, description, type, number, document_date, due_date, status, author_id,
                draft_original_filename, draft_mime_type, folder_id
              )
              VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10)
              RETURNING *
            `,
            [
              parsed.title,
              parsed.description,
              parsed.type,
              documentNumber,
              parsed.documentDate,
              parsed.dueDate,
              authorId,
              originalName,
              file.mimetype,
              folderId,
            ]
          );

          const documentRow = created.rows[0];
          documentId = documentRow.id;
          const relativePath = await placeUploadedFile({
            documentId: documentRow.id,
            uploadedPath: file.path,
            originalName,
            slot: "draft",
          });

          await client.query(
            "UPDATE documents SET draft_file_path = $2 WHERE id = $1",
            [documentRow.id, relativePath]
          );

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

          return { ...documentRow, draft_file_path: relativePath };
        });
      } catch (error) {
        if (manualNumber && isUniqueViolation(error)) {
          throw httpError(409, "Документ с таким номером уже существует.");
        }
        if (!manualNumber && isUniqueViolation(error) && attempt < 2) {
          documentId = null;
          continue;
        }
        throw error;
      }
    }

    throw httpError(409, "Не удалось подобрать уникальный номер документа.");
  } catch (error) {
    await removeIfExists(file.path);
    if (documentId) {
      await removeDocumentStorage(documentId);
    }
    throw error;
  }
}

async function publishDocument({ documentId, userId }) {
  await withTransaction(async (client) => {
    const documentResult = await client.query(
      "SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL",
      [documentId]
    );
    const document = documentResult.rows[0];

    if (!document) {
      throw new Error("Документ не найден.");
    }

    if (document.status === "archived") {
      throw httpError(409, "Документ в архиве. Сначала верните его из архива.");
    }

    if (document.status !== "draft") {
      throw httpError(409, "Опубликовать можно только черновик.");
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
          userId,
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
}

async function createVersion({ documentId, changeReason, file, userId }) {
  const originalName = decodeOriginalFilename(file.originalname);

  try {
    await withTransaction(async (client) => {
      const currentVersionResult = await client.query(
        "SELECT id, status, active_version_no FROM documents WHERE id = $1 AND deleted_at IS NULL",
        [documentId]
      );
      const document = currentVersionResult.rows[0];

      if (!document) {
        throw new Error("Документ не найден.");
      }

      if (document.status === "archived") {
        throw httpError(409, "Нельзя добавить версию к документу в архиве.");
      }

      if (document.status !== "published") {
        throw httpError(409, "Новую версию можно добавить только к опубликованному документу.");
      }

      const currentVersionNo = Number(document.active_version_no || 0) + 1;
      const relativePath = await placeUploadedFile({
        documentId,
        uploadedPath: file.path,
        originalName,
        slot: `v${currentVersionNo}`,
      });

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
          relativePath,
          originalName,
          file.mimetype,
          changeReason,
          userId,
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
  } catch (error) {
    await removeIfExists(file.path);
    throw error;
  }
}

async function deleteVersion({ documentId, versionNo }) {
  const storedPath = await withTransaction(async (client) => {
    const documentResult = await client.query(
      "SELECT id, status, active_version_no FROM documents WHERE id = $1 AND deleted_at IS NULL",
      [documentId]
    );
    const document = documentResult.rows[0];

    if (!document) {
      throw new Error("Документ не найден.");
    }

    if (document.status === "draft") {
      throw httpError(409, "У черновика нет версий для удаления.");
    }

    const versionResult = await client.query(
      "SELECT id, file_path FROM document_versions WHERE document_id = $1 AND version_no = $2",
      [documentId, versionNo]
    );
    const version = versionResult.rows[0];

    if (!version) {
      throw httpError(404, "Версия не найдена.");
    }

    const remainingResult = await client.query(
      `
        SELECT version_no
        FROM document_versions
        WHERE document_id = $1 AND version_no <> $2
        ORDER BY version_no DESC
      `,
      [documentId, versionNo]
    );

    if (!remainingResult.rows.length) {
      throw httpError(409, "Нельзя удалить единственную версию документа.");
    }

    await client.query(
      "DELETE FROM document_acknowledgements WHERE document_id = $1 AND version_no = $2",
      [documentId, versionNo]
    );
    await client.query(
      "DELETE FROM document_versions WHERE document_id = $1 AND version_no = $2",
      [documentId, versionNo]
    );

    const nextActiveVersionNo =
      Number(document.active_version_no) === versionNo
        ? Number(remainingResult.rows[0].version_no)
        : Number(document.active_version_no);

    await client.query(
      `
        UPDATE documents
        SET active_version_no = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [documentId, nextActiveVersionNo]
    );

    return version.file_path;
  });

  if (!storedPath) {
    return;
  }

  try {
    await removeIfExists(resolveStoredFile(storedPath));
  } catch (error) {
    if (error.statusCode !== 404) {
      throw error;
    }
  }
}

async function updateRequisites({ documentId, parsed }) {
  const documentDate = String(parsed.documentDate).slice(0, 10);

  try {
    await withTransaction(async (client) => {
      const existing = await client.query(
        "SELECT id, type, number FROM documents WHERE id = $1 AND deleted_at IS NULL",
        [documentId]
      );
      if (!existing.rows.length) {
        throw new Error("Документ не найден.");
      }

      const currentDocument = existing.rows[0];
      const manualNumber = normalizeDocumentNumber(parsed.number);
      const documentNumber =
        manualNumber ||
        (normalizeDocumentNumber(currentDocument.number) && currentDocument.type === parsed.type
          ? normalizeDocumentNumber(currentDocument.number)
          : await generateDocumentNumber(client, parsed.type));

      await assertDocumentNumberAvailable(client, {
        type: parsed.type,
        number: documentNumber,
        excludeDocumentId: documentId,
      });

      const folderId =
        parsed.folderId == null || parsed.folderId === ""
          ? null
          : Number(parsed.folderId);
      await assertFolderMatchesType(client, folderId, parsed.type);

      await client.query(
        `
          UPDATE documents
          SET title = $2,
              type = $3,
              number = $4,
              document_date = $5,
              description = $6,
              folder_id = $7,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          documentId,
          parsed.title,
          parsed.type,
          documentNumber,
          documentDate,
          parsed.description,
          folderId,
        ]
      );

      await client.query("DELETE FROM document_assignments WHERE document_id = $1", [documentId]);
      for (const userId of parsed.assignedUsers) {
        await client.query(
          `
            INSERT INTO document_assignments (document_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (document_id, user_id) DO NOTHING
          `,
          [documentId, userId]
        );
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw httpError(409, "Документ с таким номером уже существует.");
    }
    throw error;
  }
}

async function migrateMissingDocumentNumbers() {
  return withTransaction(async (client) => {
    const missingNumbers = await client.query(
      `
        SELECT id, type
        FROM documents
        WHERE TRIM(COALESCE(number, '')) = ''
        ORDER BY created_at ASC, id ASC
      `
    );

    let updated = 0;
    for (const row of missingNumbers.rows) {
      const documentNumber = await generateDocumentNumber(client, row.type);
      await client.query("UPDATE documents SET number = $2, updated_at = NOW() WHERE id = $1", [
        row.id,
        documentNumber,
      ]);
      updated += 1;
    }

    return updated;
  });
}

async function archiveDocument(documentId) {
  const existing = await query(
    "SELECT id, status FROM documents WHERE id = $1 AND deleted_at IS NULL",
    [documentId]
  );
  if (!existing.rows.length) {
    throw new Error("Документ не найден.");
  }
  if (existing.rows[0].status === "archived") {
    throw httpError(409, "Документ уже в архиве.");
  }
  if (existing.rows[0].status !== "published") {
    throw httpError(409, "В архив можно отправить только опубликованный документ.");
  }

  await query(
    `
      UPDATE documents
      SET status = 'archived', updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `,
    [documentId]
  );
}

async function unarchiveDocument(documentId) {
  const existing = await query(
    "SELECT id, status FROM documents WHERE id = $1 AND deleted_at IS NULL",
    [documentId]
  );
  if (!existing.rows.length) {
    throw new Error("Документ не найден.");
  }
  if (existing.rows[0].status !== "archived") {
    throw httpError(409, "Документ не находится в архиве.");
  }

  await query(
    `
      UPDATE documents
      SET status = 'published', updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `,
    [documentId]
  );
}

async function removeDocument(documentId, userId) {
  const result = await query(
    `
      UPDATE documents
      SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `,
    [documentId, userId]
  );

  if (!result.rows.length) {
    const existing = await query("SELECT id, deleted_at FROM documents WHERE id = $1", [documentId]);
    if (!existing.rows.length) {
      throw new Error("Документ не найден.");
    }
    if (existing.rows[0].deleted_at) {
      throw httpError(409, "Документ уже в корзине.");
    }
    throw new Error("Документ не найден.");
  }
}

async function restoreDocument(documentId) {
  const result = await query(
    `
      UPDATE documents
      SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NOT NULL
      RETURNING id
    `,
    [documentId]
  );

  if (!result.rows.length) {
    throw httpError(404, "Документ не найден в корзине.");
  }
}

async function permanentlyDeleteDocument(documentId) {
  const documentResult = await query(
    "SELECT id, draft_file_path FROM documents WHERE id = $1 AND deleted_at IS NOT NULL",
    [documentId]
  );
  const document = documentResult.rows[0];

  if (!document) {
    throw httpError(404, "Документ не найден в корзине.");
  }

  const versionsResult = await query(
    "SELECT file_path FROM document_versions WHERE document_id = $1",
    [documentId]
  );
  const storedPaths = [
    document.draft_file_path,
    ...versionsResult.rows.map((row) => row.file_path),
  ].filter(Boolean);

  await query("DELETE FROM documents WHERE id = $1", [documentId]);
  await removeDocumentStorage(documentId, storedPaths);
}

async function purgeExpiredTrash(retentionDays = trashRetentionDays) {
  const result = await query(
    `
      SELECT id
      FROM documents
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - ($1 * INTERVAL '1 day')
    `,
    [retentionDays]
  );

  let purgedCount = 0;

  for (const row of result.rows) {
    await permanentlyDeleteDocument(Number(row.id));
    purgedCount += 1;
  }

  return purgedCount;
}

async function assertCanAccessDocument({ document, userId, role }) {
  if (role === "responsible") {
    return;
  }

  if (Number(document.author_id) === Number(userId)) {
    return;
  }

  // Published and archived documents are visible to all employees.
  // Assignments only gate notifications / acknowledgement, not viewing.
  if (document.status === "published" || document.status === "archived") {
    return;
  }

  throw httpError(403, "Недостаточно прав.");
}

async function getDocumentFile({ documentId, versionNo, userId, role, allowDeleted = false }) {
  const document = await getDocumentOrThrow(documentId, { allowDeleted });

  await assertCanAccessDocument({ document, userId, role });

  let storedPath = document.draft_file_path;
  let originalFilename = document.draft_original_filename;
  let mimeType = document.draft_mime_type;

  if (versionNo) {
    const versionResult = await query(
      `
        SELECT file_path, original_filename, mime_type
        FROM document_versions
        WHERE document_id = $1 AND version_no = $2
      `,
      [documentId, versionNo]
    );
    const version = versionResult.rows[0];

    if (!version) {
      throw httpError(404, "Файл не найден.");
    }

    storedPath = version.file_path;
    originalFilename = version.original_filename;
    mimeType = version.mime_type;
  } else if (Number(document.active_version_no || 0) > 0) {
    const versionResult = await query(
      `
        SELECT file_path, original_filename, mime_type
        FROM document_versions
        WHERE document_id = $1 AND version_no = $2
      `,
      [documentId, Number(document.active_version_no)]
    );
    const version = versionResult.rows[0];

    if (version) {
      storedPath = version.file_path;
      originalFilename = version.original_filename;
      mimeType = version.mime_type;
    }
  }

  if (!storedPath) {
    throw httpError(404, "Файл не найден.");
  }

  const absolutePath = resolveStoredFile(storedPath);

  try {
    await fs.promises.access(absolutePath);
  } catch (error) {
    throw httpError(404, "Файл не найден.");
  }

  return {
    absolutePath,
    originalFilename: originalFilename || "document",
    mimeType: mimeType || "application/octet-stream",
  };
}

async function acknowledgeDocument({ documentId, versionNo, userId }) {
  await getDocumentOrThrow(documentId);

  const assignment = await query(
    `
      SELECT 1
      FROM document_assignments
      WHERE document_id = $1 AND user_id = $2
    `,
    [documentId, userId]
  );

  if (!assignment.rows.length) {
    throw httpError(403, "Документ не назначен вам.");
  }

  await query(
    `
      INSERT INTO document_acknowledgements (document_id, version_no, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (document_id, version_no, user_id)
      DO UPDATE SET acknowledged_at = NOW()
    `,
    [documentId, versionNo, userId]
  );
}

module.exports = {
  parseJsonArrayField,
  listDocuments,
  createDocument,
  publishDocument,
  createVersion,
  deleteVersion,
  updateRequisites,
  migrateMissingDocumentNumbers,
  archiveDocument,
  unarchiveDocument,
  removeDocument,
  restoreDocument,
  permanentlyDeleteDocument,
  purgeExpiredTrash,
  acknowledgeDocument,
  getDocumentFile,
};
