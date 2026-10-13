const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    throw new Error("Нет связи с сервером. Запустите backend: cd backend && npm run dev");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Ошибка запроса.");
  }

  return data;
}

function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export async function login(payload) {
  return request("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function moderatorRequest(path, options = {}) {
  return request(`/moderator${path}`, options);
}

export async function moderatorLogin(payload) {
  return moderatorRequest("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchModeratorUsers(token) {
  return moderatorRequest("/users", {
    headers: authHeaders(token),
  });
}

export async function createModeratorUser(token, payload) {
  return moderatorRequest("/users", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateModeratorUser(token, userId, payload) {
  return moderatorRequest(`/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function deleteModeratorUser(token, userId) {
  return moderatorRequest(`/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function fetchUsers(token) {
  return request("/users", {
    headers: authHeaders(token),
  });
}

export async function fetchDocuments(token, scope = "all") {
  return request(`/documents?scope=${scope}`, {
    headers: authHeaders(token),
  });
}

export async function fetchAssignedDocuments(token) {
  return request("/documents/assigned/me", {
    headers: authHeaders(token),
  });
}

export async function fetchReport(token) {
  return request("/reports/acknowledgements", {
    headers: authHeaders(token),
  });
}

export async function fetchEmailTemplates(token, folderId) {
  const query =
    folderId === undefined
      ? ""
      : folderId == null
        ? "?folderId=null"
        : `?folderId=${encodeURIComponent(folderId)}`;
  return request(`/email-templates${query}`, {
    headers: authHeaders(token),
  });
}

export async function createEmailTemplate(token, payload) {
  return request("/email-templates", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateEmailTemplate(token, templateId, payload) {
  return request(`/email-templates/${templateId}`, {
    method: "PUT",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function deleteEmailTemplate(token, templateId) {
  return request(`/email-templates/${templateId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function fetchEmailTemplateFolders(token) {
  return request("/email-template-folders", {
    headers: authHeaders(token),
  });
}

export async function createEmailTemplateFolder(token, payload) {
  return request("/email-template-folders", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateEmailTemplateFolder(token, folderId, payload) {
  return request(`/email-template-folders/${folderId}`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function deleteEmailTemplateFolder(token, folderId) {
  return request(`/email-template-folders/${folderId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function fetchLetters(token, folderId) {
  const query =
    folderId === undefined
      ? ""
      : folderId == null
        ? "?folderId=null"
        : `?folderId=${encodeURIComponent(folderId)}`;
  return request(`/letters${query}`, {
    headers: authHeaders(token),
  });
}

export async function fetchLetter(token, letterId) {
  return request(`/letters/${letterId}`, {
    headers: authHeaders(token),
  });
}

export async function fetchNextOutgoingNumber(token) {
  return request("/letters/next-outgoing", {
    headers: authHeaders(token),
  });
}

export async function createLetter(token, payload) {
  return request("/letters", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateLetter(token, letterId, payload) {
  return request(`/letters/${letterId}`, {
    method: "PUT",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function confirmLetter(token, letterId) {
  return request(`/letters/${letterId}/confirm`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function deleteLetter(token, letterId) {
  return request(`/letters/${letterId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function createDocument(token, formData) {
  return request("/documents", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function publishDocument(token, documentId) {
  return request(`/documents/${documentId}/publish`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function createVersion(token, documentId, formData) {
  return request(`/documents/${documentId}/versions`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function deleteVersion(token, documentId, versionNo) {
  return request(`/documents/${documentId}/versions/${versionNo}/delete`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function acknowledgeDocument(token, documentId, versionNo) {
  return request(`/documents/${documentId}/acknowledgements`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ versionNo }),
  });
}

export async function updateDocument(token, documentId, payload) {
  return request(`/documents/${documentId}/update`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function archiveDocument(token, documentId) {
  return request(`/documents/${documentId}/archive`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function unarchiveDocument(token, documentId) {
  return request(`/documents/${documentId}/unarchive`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function deleteDocument(token, documentId) {
  return request(`/documents/${documentId}/delete`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function fetchTrashDocuments(token) {
  return request("/documents?scope=trash", {
    headers: authHeaders(token),
  });
}

export async function restoreDocument(token, documentId) {
  return request(`/documents/${documentId}/restore`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function permanentDeleteDocument(token, documentId) {
  return request(`/documents/${documentId}/permanent-delete`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function fetchDocumentFile(token, documentId, versionNo) {
  const query = versionNo ? `?version=${versionNo}` : "";
  let response;

  try {
    response = await fetch(`${API_URL}/documents/${documentId}/file${query}`, {
      headers: authHeaders(token),
    });
  } catch (error) {
    throw new Error("Нет связи с сервером. Запустите backend: cd backend && npm run dev");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось загрузить файл.");
  }

  const blob = await response.blob();
  const headerType = (response.headers.get("content-type") || "").split(";")[0].trim();
  const mimeType = headerType || blob.type || "application/octet-stream";
  const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });

  return {
    blob: typedBlob,
    objectUrl: URL.createObjectURL(typedBlob),
    mimeType,
    size: typedBlob.size,
  };
}

export async function fetchFolders(token, type) {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  return request(`/folders${query}`, {
    headers: authHeaders(token),
  });
}

export async function createFolder(token, payload) {
  return request("/folders", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateFolder(token, folderId, payload) {
  return request(`/folders/${folderId}`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function deleteFolder(token, folderId) {
  return request(`/folders/${folderId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export { API_URL };
