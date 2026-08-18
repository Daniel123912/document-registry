const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Ошибка запроса.");
  }

  return data;
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchDocuments(token, scope = "all") {
  return request(`/documents?scope=${scope}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchAssignedDocuments(token) {
  return request("/documents/assigned/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchReport(token) {
  return request("/reports/acknowledgements", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createDocument(token, formData) {
  return request("/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
}

export async function publishDocument(token, documentId) {
  return request(`/documents/${documentId}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createVersion(token, documentId, formData) {
  return request(`/documents/${documentId}/versions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
}

export async function acknowledgeDocument(token, documentId, versionNo) {
  return request(`/documents/${documentId}/acknowledgements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ versionNo }),
  });
}

export { API_URL };
