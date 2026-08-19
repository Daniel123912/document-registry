const { decodeOriginalFilename } = require("./filenames");

function normalizeDocument(row) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    type: row.type,
    number: row.number,
    status: row.status,
    documentDate: row.document_date,
    dueDate: row.due_date,
    activeVersionNo: Number(row.active_version_no || 0),
    authorId: Number(row.author_id),
    authorName: row.author_name,
    assignedCount: Number(row.assigned_count || 0),
    acknowledgedCount: Number(row.acknowledged_count || 0),
    pendingCount: Number(row.pending_count || 0),
    currentFileUrl: row.current_file_url || null,
    currentFilename: decodeOriginalFilename(row.current_filename),
    currentMimeType: row.current_mime_type || null,
    updatedAt: row.updated_at || row.document_date,
    versions: Array.isArray(row.versions)
      ? row.versions.map((version) => ({
          ...version,
          originalFilename: decodeOriginalFilename(version.originalFilename),
        }))
      : [],
    assignedUsers: Array.isArray(row.assigned_users) ? row.assigned_users : [],
    isAcknowledged: Boolean(row.is_acknowledged),
    deletedAt: row.deleted_at || null,
  };
}

module.exports = {
  normalizeDocument,
};
