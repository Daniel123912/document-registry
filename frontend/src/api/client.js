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
  return {
    objectUrl: URL.createObjectURL(blob),
    mimeType: response.headers.get("content-type") || blob.type,
  };
}

export { API_URL };
