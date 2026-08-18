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
    currentFilename: row.current_filename || null,
    versions: Array.isArray(row.versions) ? row.versions : [],
    assignedUsers: Array.isArray(row.assigned_users) ? row.assigned_users : [],
    isAcknowledged: Boolean(row.is_acknowledged),
  };
}

module.exports = {
  normalizeDocument,
};
