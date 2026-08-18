import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  acknowledgeDocument,
  createDocument,
  createVersion,
  fetchAssignedDocuments,
  fetchDocuments,
  fetchReport,
  fetchUsers,
  login,
  publishDocument,
} from "./api";

const emptyCreateForm = {
  title: "",
  type: "order",
  number: "",
  documentDate: "",
  dueDate: "",
  description: "",
  assignedUsers: [],
  docFile: null,
};

const emptyVersionForm = {
  changeReason: "",
  versionFile: null,
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("bakorToken") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("bakorUser");
    return raw ? JSON.parse(raw) : null;
  });
  const [authForm, setAuthForm] = useState({
    email: "responsible@bakor.local",
    password: "admin1234",
  });
  const [appTab, setAppTab] = useState("create");
  const [detailTab, setDetailTab] = useState("main");
  const [documents, setDocuments] = useState([]);
  const [assignedDocuments, setAssignedDocuments] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [versionForms, setVersionForms] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isResponsible = user?.role === "responsible";

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) || null,
    [documents, selectedDocumentId]
  );

  async function loadData(currentToken = token, currentUser = user) {
    if (!currentToken || !currentUser) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const requests = [
        fetchDocuments(currentToken, currentUser.role === "responsible" ? "all" : "mine"),
        currentUser.role === "responsible"
          ? Promise.resolve([])
          : fetchAssignedDocuments(currentToken),
      ];

      if (currentUser.role === "responsible") {
        requests.push(fetchReport(currentToken), fetchUsers(currentToken));
      }

      const [documentsData, assignedData, reportData = [], usersData = []] =
        await Promise.all(requests);

      setDocuments(documentsData);
      setAssignedDocuments(assignedData);
      setReportRows(reportData);
      setUsers(usersData);

      if (documentsData.length > 0) {
        setSelectedDocumentId((current) => current || documentsData[0].id);
      } else {
        setSelectedDocumentId(null);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && user) {
      loadData();
    }
  }, [token]);

  useEffect(() => {
    if (!isResponsible) {
      setAppTab("inbox");
    }
  }, [isResponsible]);

  function persistSession(nextToken, nextUser) {
    localStorage.setItem("bakorToken", nextToken);
    localStorage.setItem("bakorUser", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const result = await login(authForm);
      persistSession(result.token, result.user);
      setAppTab(result.user.role === "responsible" ? "create" : "inbox");
      setNotice("Вход выполнен.");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("bakorToken");
    localStorage.removeItem("bakorUser");
    setToken("");
    setUser(null);
    setDocuments([]);
    setAssignedDocuments([]);
    setReportRows([]);
    setUsers([]);
    setNotice("");
    setError("");
  }

  async function handleCreateDocument(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", createForm.title);
      formData.append("type", createForm.type);
      formData.append("number", createForm.number);
      formData.append("documentDate", createForm.documentDate);
      formData.append("dueDate", createForm.dueDate);
      formData.append("description", createForm.description);
      formData.append("assignedUsers", JSON.stringify(createForm.assignedUsers));
      if (createForm.docFile) {
        formData.append("docFile", createForm.docFile);
      }

      const result = await createDocument(token, formData);
      setCreateForm(emptyCreateForm);
      setNotice(result.message);
      await loadData();
      setAppTab("manage");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(documentId) {
    setLoading(true);
    setError("");
    try {
      const result = await publishDocument(token, documentId);
      setNotice(result.message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVersion(event, documentId) {
    event.preventDefault();
    const currentForm = versionForms[documentId] || emptyVersionForm;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("changeReason", currentForm.changeReason);
      if (currentForm.versionFile) {
        formData.append("versionFile", currentForm.versionFile);
      }
      const result = await createVersion(token, documentId, formData);
      setVersionForms((current) => ({
        ...current,
        [documentId]: emptyVersionForm,
      }));
      setNotice(result.message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(documentId, versionNo) {
    setLoading(true);
    setError("");

    try {
      const result = await acknowledgeDocument(token, documentId, versionNo);
      setNotice(result.message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token || !user) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <h1>Реестр БАКОР</h1>
          <p>Отдельное веб-приложение для документов, версий и ознакомления сотрудников.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
          <div className="helper">
            <strong>Демо-учетки:</strong>
            <div>`responsible@bakor.local / admin1234`</div>
            <div>`employee@bakor.local / user1234`</div>
          </div>
          {error ? <div className="alert error">{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2 className="logo">Реестр БАКОР</h2>
        <p className="subtitle">Standalone web application</p>
        <div className="nav">
          <div className="nav-title">Рабочие разделы</div>
          {isResponsible ? (
            <>
              <button
                className={appTab === "create" ? "active" : ""}
                onClick={() => setAppTab("create")}
              >
                Создать документ
              </button>
              <button
                className={appTab === "manage" ? "active" : ""}
                onClick={() => setAppTab("manage")}
              >
                Управление документами
              </button>
              <button
                className={appTab === "report" ? "active" : ""}
                onClick={() => setAppTab("report")}
              >
                Отчеты
              </button>
            </>
          ) : null}
          <button
            className={appTab === "inbox" ? "active" : ""}
            onClick={() => setAppTab("inbox")}
          >
            Мое ознакомление
          </button>
        </div>
        <div className="meta">
          <div>Пользователь: {user.fullName}</div>
          <div>Роль: {isResponsible ? "Ответственный" : "Сотрудник"}</div>
          <button className="btn ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>

      <main className="main">
        <section className="topbar">
          <div>
            <h1>Реестр документов</h1>
            <p>Документы, версии, назначение сотрудников и подтверждение ознакомления.</p>
          </div>
          <span className="badge">
            {loading ? "Обновление..." : `Документов: ${documents.length}`}
          </span>
        </section>

        {notice ? <div className="alert success">{notice}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        {appTab === "create" && isResponsible ? (
          <section className="panel create-panel">
            <div className="panel-head">
              <h2>Новый документ</h2>
              <span className="badge subtle">Черновик создается сразу</span>
            </div>
            <form className="form-grid" onSubmit={handleCreateDocument}>
              <label>
                Название
                <input
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Тип
                <select
                  value={createForm.type}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  <option value="order">Приказ</option>
                  <option value="regulation">Регламент</option>
                  <option value="instruction">Инструкция</option>
                  <option value="new_goods">Новые товары</option>
                  <option value="other">Другое</option>
                </select>
              </label>

              <label>
                Номер
                <input
                  value={createForm.number}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, number: event.target.value }))
                  }
                />
              </label>

              <label>
                Дата документа
                <input
                  type="date"
                  value={createForm.documentDate}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      documentDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Срок ознакомления
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Файл
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      docFile: event.target.files?.[0] || null,
                    }))
                  }
                  required
                />
              </label>

              <label className="span-2">
                Краткое описание
                <textarea
                  rows="4"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <fieldset className="span-2">
                <legend>Назначить ознакомление</legend>
                <div className="users-grid">
                  {users
                    .filter((candidate) => candidate.role === "employee")
                    .map((candidate) => (
                      <label className="user-check" key={candidate.id}>
                        <input
                          type="checkbox"
                          checked={createForm.assignedUsers.includes(candidate.id)}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              assignedUsers: event.target.checked
                                ? [...current.assignedUsers, candidate.id]
                                : current.assignedUsers.filter((id) => id !== candidate.id),
                            }))
                          }
                        />
                        <span>
                          {candidate.fullName}
                          <small>{candidate.email}</small>
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>

              <div className="span-2">
                <button className="btn primary" type="submit" disabled={loading}>
                  Сохранить черновик
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {appTab === "manage" && isResponsible ? (
          <section className="workspace">
            <article className="panel">
              <div className="panel-head">
                <h2>Список документов</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Документ</th>
                    <th>Статус</th>
                    <th>Версия</th>
                    <th>Срок</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr
                      className={selectedDocumentId === document.id ? "active" : ""}
                      key={document.id}
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <td>
                        <strong>{document.title}</strong>
                        <div className="muted">{document.number || "Без номера"}</div>
                      </td>
                      <td>
                        <span
                          className={`status ${
                            document.status === "published" ? "ok" : "warn"
                          }`}
                        >
                          {document.status === "published" ? "Опубликован" : "Черновик"}
                        </span>
                      </td>
                      <td>v{document.activeVersionNo}</td>
                      <td>{document.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="panel">
              {selectedDocument ? (
                <>
                  <header className="doc-header">
                    <h2 className="doc-title">{selectedDocument.title}</h2>
                    <div className="doc-meta">
                      <span>{selectedDocument.number || "Без номера"}</span>
                      <span>Тип: {selectedDocument.type}</span>
                      <span>Активная версия: v{selectedDocument.activeVersionNo}</span>
                      <span
                        className={`status ${
                          selectedDocument.status === "published" ? "ok" : "warn"
                        }`}
                      >
                        {selectedDocument.status === "published" ? "Опубликован" : "Черновик"}
                      </span>
                    </div>
                  </header>

                  <div className="tabs">
                    {[
                      ["main", "Основное"],
                      ["file", "Файл"],
                      ["versions", "Версии"],
                      ["ack", "Ознакомление"],
                    ].map(([tabKey, label]) => (
                      <button
                        key={tabKey}
                        className={detailTab === tabKey ? "active" : ""}
                        onClick={() => setDetailTab(tabKey)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {detailTab === "main" ? (
                    <section className="panel-tab active">
                      <div className="kv"><div className="k">Дата документа</div><div>{selectedDocument.documentDate}</div></div>
                      <div className="kv"><div className="k">Автор</div><div>{selectedDocument.authorName}</div></div>
                      <div className="kv"><div className="k">Срок ознакомления</div><div>{selectedDocument.dueDate}</div></div>
                      <div className="kv"><div className="k">Описание</div><div>{selectedDocument.description || "Описание не заполнено"}</div></div>
                    </section>
                  ) : null}

                  {detailTab === "file" ? (
                    <section className="panel-tab active">
                      <div className="kv"><div className="k">Текущий файл</div><div>{selectedDocument.currentFilename || "Не найден"}</div></div>
                      <div className="kv"><div className="k">Ссылка</div><div>{selectedDocument.currentFileUrl ? <a href={selectedDocument.currentFileUrl} target="_blank" rel="noreferrer">Открыть файл</a> : "Нет файла"}</div></div>
                      {selectedDocument.status !== "published" ? (
                        <button className="btn primary" onClick={() => handlePublish(selectedDocument.id)}>
                          Опубликовать
                        </button>
                      ) : null}
                    </section>
                  ) : null}

                  {detailTab === "versions" ? (
                    <section className="panel-tab active">
                      <div className="version-list">
                        {selectedDocument.versions.map((version) => (
                          <div className="item" key={version.versionNo}>
                            <strong>
                              v{version.versionNo}
                              {version.versionNo === selectedDocument.activeVersionNo ? " (текущая)" : ""}
                            </strong>
                            <div className="muted">{version.changeReason}</div>
                            <div className="muted">
                              Автор: {version.createdByName}
                            </div>
                            <a href={version.fileUrl} target="_blank" rel="noreferrer">
                              {version.originalFilename}
                            </a>
                          </div>
                        ))}
                      </div>

                      {selectedDocument.status === "published" ? (
                        <form
                          className="inline-version-form"
                          onSubmit={(event) => handleCreateVersion(event, selectedDocument.id)}
                        >
                          <input
                            type="text"
                            placeholder="Причина изменения"
                            value={versionForms[selectedDocument.id]?.changeReason || ""}
                            onChange={(event) =>
                              setVersionForms((current) => ({
                                ...current,
                                [selectedDocument.id]: {
                                  ...(current[selectedDocument.id] || emptyVersionForm),
                                  changeReason: event.target.value,
                                },
                              }))
                            }
                            required
                          />
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(event) =>
                              setVersionForms((current) => ({
                                ...current,
                                [selectedDocument.id]: {
                                  ...(current[selectedDocument.id] || emptyVersionForm),
                                  versionFile: event.target.files?.[0] || null,
                                },
                              }))
                            }
                            required
                          />
                          <button className="btn secondary" type="submit">
                            Новая версия
                          </button>
                        </form>
                      ) : null}
                    </section>
                  ) : null}

                  {detailTab === "ack" ? (
                    <section className="panel-tab active">
                      <div className="ack-list">
                        <div className="item">
                          <strong>Сотрудники</strong>
                          <div className="muted">
                            Назначено: {selectedDocument.assignedCount} | Ознакомились:{" "}
                            {selectedDocument.acknowledgedCount} | Ожидают:{" "}
                            {selectedDocument.pendingCount}
                          </div>
                        </div>
                        {selectedDocument.assignedUsers.map((assignedUser) => (
                          <div className="item" key={assignedUser.id}>
                            <strong>{assignedUser.fullName}</strong>
                            <div className="muted">{assignedUser.email}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="empty">Пока нет документов.</div>
              )}
            </article>
          </section>
        ) : null}

        {appTab === "report" && isResponsible ? (
          <section className="panel">
            <div className="panel-head">
              <h2>Отчет по ознакомлению</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Версия</th>
                  <th>Назначено</th>
                  <th>Ознакомились</th>
                  <th>Ожидают</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>v{row.activeVersionNo}</td>
                    <td>{row.assignedCount}</td>
                    <td>{row.acknowledgedCount}</td>
                    <td>{row.pendingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {appTab === "inbox" ? (
          <section className="panel">
            <div className="panel-head">
              <h2>Мои документы на ознакомление</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Версия</th>
                  <th>Срок</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignedDocuments.map((document) => (
                  <tr key={document.id}>
                    <td>
                      {document.currentFileUrl ? (
                        <a href={document.currentFileUrl} target="_blank" rel="noreferrer">
                          {document.title}
                        </a>
                      ) : (
                        document.title
                      )}
                    </td>
                    <td>v{document.activeVersionNo}</td>
                    <td>{document.dueDate}</td>
                    <td>
                      <span className={`status ${document.isAcknowledged ? "ok" : "warn"}`}>
                        {document.isAcknowledged ? "Ознакомлен" : "Ожидается"}
                      </span>
                    </td>
                    <td>
                      {!document.isAcknowledged ? (
                        <button
                          className="btn primary"
                          onClick={() =>
                            handleAcknowledge(document.id, document.activeVersionNo)
                          }
                        >
                          Ознакомлен
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
