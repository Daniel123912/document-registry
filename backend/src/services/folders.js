const { query, withTransaction } = require("../db");

const DOCUMENT_TYPES = new Set([
  "order",
  "regulation",
  "instruction",
  "new_goods",
  "other",
  "legal_entity",
]);

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeFolder(row) {
  return {
    id: Number(row.id),
    type: row.type,
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    name: row.name,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
  };
}

async function listFolders({ type } = {}) {
  const params = [];
  let whereClause = "";

  if (type) {
    if (!DOCUMENT_TYPES.has(type)) {
      throw httpError(400, "Некорректный тип документов.");
    }
    params.push(type);
    whereClause = "WHERE type = $1";
  }

  const result = await query(
    `
      SELECT id, type, parent_id, name, sort_order, created_at
      FROM document_folders
      ${whereClause}
      ORDER BY sort_order ASC, name ASC, id ASC
    `,
    params
  );

  return result.rows.map(normalizeFolder);
}

async function getFolderOrThrow(clientOrNull, folderId) {
  const runner = clientOrNull || { query };
  const result = await runner.query(
    "SELECT id, type, parent_id, name, sort_order, created_at FROM document_folders WHERE id = $1",
    [folderId]
  );
  const row = result.rows[0];
  if (!row) {
    throw httpError(404, "Папка не найдена.");
  }
  return row;
}

async function assertFolderMatchesType(client, folderId, type) {
  if (folderId == null) {
    return null;
  }

  const folder = await getFolderOrThrow(client, folderId);
  if (folder.type !== type) {
    throw httpError(400, "Папка относится к другому типу документов.");
  }
  return folder;
}

async function assertValidParent({ client, type, parentId, folderId = null }) {
  if (parentId == null) {
    return null;
  }

  const parent = await getFolderOrThrow(client, parentId);
  if (parent.type !== type) {
    throw httpError(400, "Родительская папка относится к другому типу.");
  }

  if (folderId != null) {
    if (Number(parentId) === Number(folderId)) {
      throw httpError(400, "Папка не может быть родителем самой себе.");
    }

    let currentParentId = parent.parent_id == null ? null : Number(parent.parent_id);
    while (currentParentId != null) {
      if (currentParentId === Number(folderId)) {
        throw httpError(400, "Нельзя переместить папку внутрь собственной вложенности.");
      }
      const ancestor = await getFolderOrThrow(client, currentParentId);
      currentParentId = ancestor.parent_id == null ? null : Number(ancestor.parent_id);
    }
  }

  return parent;
}

async function nextSortOrder(client, type, parentId) {
  const result = await client.query(
    `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM document_folders
      WHERE type = $1
        AND parent_id IS NOT DISTINCT FROM $2
    `,
    [type, parentId]
  );
  return Number(result.rows[0].next_order || 0);
}

async function createFolder({ name, type, parentId = null }) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw httpError(400, "Укажите название папки.");
  }
  if (!DOCUMENT_TYPES.has(type)) {
    throw httpError(400, "Некорректный тип документов.");
  }
  if (type === "order") {
    throw httpError(400, "Для приказов и решений папки не используются.");
  }

  return withTransaction(async (client) => {
    await assertValidParent({ client, type, parentId });
    const sortOrder = await nextSortOrder(client, type, parentId);

    const created = await client.query(
      `
        INSERT INTO document_folders (type, parent_id, name, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id, type, parent_id, name, sort_order, created_at
      `,
      [type, parentId, trimmedName, sortOrder]
    );

    return normalizeFolder(created.rows[0]);
  });
}

async function updateFolder({ folderId, name, parentId }) {
  return withTransaction(async (client) => {
    const current = await getFolderOrThrow(client, folderId);
    const nextName =
      name === undefined ? current.name : String(name || "").trim();
    if (!nextName) {
      throw httpError(400, "Укажите название папки.");
    }

    const nextParentId =
      parentId === undefined
        ? current.parent_id == null
          ? null
          : Number(current.parent_id)
        : parentId;

    await assertValidParent({
      client,
      type: current.type,
      parentId: nextParentId,
      folderId,
    });

    const updated = await client.query(
      `
        UPDATE document_folders
        SET name = $2,
            parent_id = $3
        WHERE id = $1
        RETURNING id, type, parent_id, name, sort_order, created_at
      `,
      [folderId, nextName, nextParentId]
    );

    return normalizeFolder(updated.rows[0]);
  });
}

async function deleteFolder(folderId) {
  return withTransaction(async (client) => {
    const current = await getFolderOrThrow(client, folderId);
    const parentId = current.parent_id == null ? null : Number(current.parent_id);

    await client.query(
      `
        UPDATE document_folders
        SET parent_id = $2
        WHERE parent_id = $1
      `,
      [folderId, parentId]
    );

    await client.query(
      `
        UPDATE documents
        SET folder_id = $2,
            updated_at = NOW()
        WHERE folder_id = $1
      `,
      [folderId, parentId]
    );

    await client.query("DELETE FROM document_folders WHERE id = $1", [folderId]);
    return { id: Number(folderId) };
  });
}

module.exports = {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  assertFolderMatchesType,
  DOCUMENT_TYPES,
};
