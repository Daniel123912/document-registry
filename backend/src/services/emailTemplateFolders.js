const { query, withTransaction } = require("../db");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeFolder(row) {
  return {
    id: Number(row.id),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    name: row.name,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
  };
}

async function listEmailTemplateFolders() {
  const result = await query(
    `
      SELECT id, parent_id, name, sort_order, created_at
      FROM email_template_folders
      ORDER BY sort_order ASC, name ASC, id ASC
    `
  );

  return result.rows.map(normalizeFolder);
}

async function getFolderOrThrow(clientOrNull, folderId) {
  const runner = clientOrNull || { query };
  const result = await runner.query(
    "SELECT id, parent_id, name, sort_order, created_at FROM email_template_folders WHERE id = $1",
    [folderId]
  );
  const row = result.rows[0];
  if (!row) {
    throw httpError(404, "Папка не найдена.");
  }
  return row;
}

async function assertValidParent({ client, parentId, folderId = null }) {
  if (parentId == null) {
    return null;
  }

  const parent = await getFolderOrThrow(client, parentId);

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

async function nextSortOrder(client, parentId) {
  const result = await client.query(
    `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM email_template_folders
      WHERE parent_id IS NOT DISTINCT FROM $1
    `,
    [parentId]
  );
  return Number(result.rows[0].next_order || 0);
}

async function createEmailTemplateFolder({ name, parentId = null }) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw httpError(400, "Укажите название папки.");
  }

  return withTransaction(async (client) => {
    await assertValidParent({ client, parentId });
    const sortOrder = await nextSortOrder(client, parentId);

    const created = await client.query(
      `
        INSERT INTO email_template_folders (parent_id, name, sort_order)
        VALUES ($1, $2, $3)
        RETURNING id, parent_id, name, sort_order, created_at
      `,
      [parentId, trimmedName, sortOrder]
    );

    return normalizeFolder(created.rows[0]);
  });
}

async function updateEmailTemplateFolder({ folderId, name, parentId }) {
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
      parentId: nextParentId,
      folderId,
    });

    const updated = await client.query(
      `
        UPDATE email_template_folders
        SET name = $2,
            parent_id = $3
        WHERE id = $1
        RETURNING id, parent_id, name, sort_order, created_at
      `,
      [folderId, nextName, nextParentId]
    );

    return normalizeFolder(updated.rows[0]);
  });
}

async function deleteEmailTemplateFolder(folderId) {
  return withTransaction(async (client) => {
    const current = await getFolderOrThrow(client, folderId);
    const parentId = current.parent_id == null ? null : Number(current.parent_id);

    await client.query(
      `
        UPDATE email_template_folders
        SET parent_id = $2
        WHERE parent_id = $1
      `,
      [folderId, parentId]
    );

    await client.query(
      `
        UPDATE email_templates
        SET folder_id = $2,
            updated_at = NOW()
        WHERE folder_id = $1
      `,
      [folderId, parentId]
    );

    await client.query("DELETE FROM email_template_folders WHERE id = $1", [folderId]);
    return { id: Number(folderId) };
  });
}

module.exports = {
  listEmailTemplateFolders,
  createEmailTemplateFolder,
  updateEmailTemplateFolder,
  deleteEmailTemplateFolder,
};
