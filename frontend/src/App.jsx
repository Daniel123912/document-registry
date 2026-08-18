import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  acknowledgeDocument,
  archiveDocument,
  createDocument,
  createVersion,
  deleteDocument,
  fetchAssignedDocuments,
  fetchDocuments,
  fetchReport,
  fetchUsers,
  login,
  publishDocument,
  updateDocument,
} from "./api";
import { withReadableFilenames } from "./filenames";
import DocumentPage from "./DocumentPage";

const TYPE_OPTIONS = [
  { value: "order", label: "Приказы / Решения" },
  { value: "regulation", label: "Регламенты" },
  { value: "instruction", label: "Инструкции" },
  { value: "new_goods", label: "Новые товары" },
  { value: "other", label: "Другое" },
];

const SORT_OPTIONS = [
  { value: "new", label: "Сортировка: новые сначала" },
  { value: "old", label: "Сортировка: старые сначала" },
  { value: "title", label: "Сортировка: по названию" },
];

const emptyCreateForm = {
  title: "",
  type: "order",
  documentDate: toIsoDate(new Date()),
  description: "",
  assignedUsers: [],
  docFile: null,
};

const emptyVersionForm = {
  changeReason: "",
  versionFile: null,
};

function toIsoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString("ru-RU");
}

function typeLabel(type) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

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
  const [section, setSection] = useState("active");
  const [activeType, setActiveType] = useState("other");
  const [activeOpen, setActiveOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [assignedDocuments, setAssignedDocuments] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [versionForms, setVersionForms] = useState({});
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("new");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isResponsible = user?.role === "responsible";
  const employeeUsers = users.filter((candidate) => candidate.role === "employee");

  const selectedDocument = useMemo(
    () =>
      [...documents, ...assignedDocuments].find(
        (document) => document.id === selectedDocumentId
      ) || null,
    [assignedDocuments, documents, selectedDocumentId]
  );

  const listTitle = useMemo(() => {
    if (section === "inbox") {
      return "Список документов: Мои документы";
    }
    if (section === "report") {
      return "Отчет по ознакомлению";
    }
    if (section === "archive") {
      return "Список документов: Архив";
    }
    return `Список документов: ${typeLabel(activeType)}`;
  }, [activeType, section]);

  const visibleDocuments = useMemo(() => {
    const source =
      section === "inbox" || !isResponsible ? assignedDocuments : documents;

    let rows = source.filter((document) => {
      if (section === "archive") {
        return document.status === "archived";
      }
      if (document.status === "archived") {
        return false;
      }
      if (section === "inbox") {
        return true;
      }
      return document.type === activeType;
    });

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((document) => {
        const title = (document.title || "").toLowerCase();
        const number = (document.number || "").toLowerCase();
        return title.includes(query) || number.includes(query);
      });
    }

    rows = [...rows].sort((left, right) => {
      if (sort === "title") {
        return (left.title || "").localeCompare(right.title || "", "ru");
      }
      const leftDate = new Date(left.documentDate || 0).getTime();
      const rightDate = new Date(right.documentDate || 0).getTime();
      return sort === "old" ? leftDate - rightDate : rightDate - leftDate;
    });

    return rows;
  }, [activeType, assignedDocuments, documents, isResponsible, search, section, sort]);

  async function loadData(currentToken = token, currentUser = user) {
    if (!currentToken || !currentUser) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const requests = [
        fetchDocuments(currentToken, currentUser.role === "responsible" ? "all" : "mine"),
        fetchAssignedDocuments(currentToken),
      ];

      if (currentUser.role === "responsible") {
        requests.push(fetchReport(currentToken), fetchUsers(currentToken));
      }

      const [documentsData, assignedData, reportData = [], usersData = []] =
        await Promise.all(requests);

      setDocuments((documentsData || []).map(withReadableFilenames));
      setAssignedDocuments((assignedData || []).map(withReadableFilenames));
      setReportRows(reportData);
      setUsers(usersData);
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
      setSection("inbox");
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
      setSection(result.user.role === "responsible" ? "active" : "inbox");
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

  function openCreateModal() {
    setCreateForm({
      ...emptyCreateForm,
      type: section === "active" ? activeType : "order",
      documentDate: toIsoDate(new Date()),
    });
    setCreateOpen(true);
  }

  async function handleCreateDocument(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", createForm.title);
      formData.append("type", createForm.type);
      formData.append("number", "");
      formData.append("documentDate", createForm.documentDate);
      formData.append("dueDate", addDays(createForm.documentDate, 14));
      formData.append("description", createForm.description);
      formData.append("assignedUsers", JSON.stringify(createForm.assignedUsers));
      if (createForm.docFile) {
        formData.append("docFile", createForm.docFile);
      }

      const result = await createDocument(token, formData);
      setCreateForm(emptyCreateForm);
      setCreateOpen(false);
      setNotice(result.message);
      setSection("active");
      setActiveType(createForm.type);
      setActiveOpen(true);
      setSelectedDocumentId(result.id || null);
      await loadData();
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

  async function handleCreateVersion(event, documentId, currentForm) {
    event.preventDefault();
    const form = currentForm || versionForms[documentId] || emptyVersionForm;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("changeReason", form.changeReason);
      if (form.versionFile) {
        formData.append("versionFile", form.versionFile);
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

  async function handleSaveRequisites(documentId, payload) {
    setLoading(true);
    setError("");
    try {
      const result = await updateDocument(token, documentId, payload);
      setNotice(result.message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(documentId) {
    setLoading(true);
    setError("");
    try {
      const result = await archiveDocument(token, documentId);
      setNotice(result.message);
      setSelectedDocumentId(null);
      setSection("archive");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId) {
    if (!window.confirm("Удалить документ безвозвратно?")) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await deleteDocument(token, documentId);
      setNotice(result.message);
      setSelectedDocumentId(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setSort("new");
  }

  function selectType(type) {
    setSection("active");
    setActiveType(type);
    setActiveOpen(true);
    setSelectedDocumentId(null);
  }

  if (!token || !user) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <h1>Реестр</h1>
          <p>Документы, версии и ознакомление сотрудников.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                className="field-input"
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
                className="field-input"
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
            <div>responsible@bakor.local / admin1234</div>
            <div>employee@bakor.local / user1234</div>
          </div>
          {error ? <div className="alert error">{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="logo">Реестр</h1>
        {isResponsible ? (
          <button className="create-btn" onClick={openCreateModal}>
            + Создать документ
          </button>
        ) : null}

        <nav className="nav">
          <button
            className={section === "inbox" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setSection("inbox");
              setSelectedDocumentId(null);
            }}
          >
            Мои документы
          </button>

          <div className="nav-title">Рабочие разделы</div>

          <button
            className="nav-parent"
            onClick={() => setActiveOpen((current) => !current)}
          >
            <span>Действующие документы</span>
            <span className={activeOpen ? "chevron open" : "chevron"} />
          </button>

          {activeOpen
            ? TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={
                    section === "active" && activeType === option.value
                      ? "nav-sub active"
                      : "nav-sub"
                  }
                  onClick={() => selectType(option.value)}
                >
                  {option.label}
                </button>
              ))
            : null}

          <button
            className={section === "archive" ? "nav-parent active" : "nav-parent"}
            onClick={() => {
              setSection("archive");
              setSelectedDocumentId(null);
            }}
          >
            <span>Архив</span>
            <span className="chevron" />
          </button>

          {isResponsible ? (
            <button
              className={section === "report" ? "nav-item active" : "nav-item"}
              onClick={() => {
                setSection("report");
                setSelectedDocumentId(null);
              }}
            >
              Отчеты
            </button>
          ) : null}
        </nav>

        <div className="sidebar-foot">
          <div>{user.fullName}</div>
          <div>{isResponsible ? "Ответственный" : "Сотрудник"}</div>
          <button className="logout-btn" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>

      <main className="main">
        {notice ? <div className="alert success">{notice}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        {section === "report" && isResponsible ? (
          <section className="list-card">
            <h2 className="list-title">{listTitle}</h2>
            <table className="doc-table">
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
            {reportRows.length === 0 ? (
              <div className="empty">Отчетов пока нет</div>
            ) : null}
          </section>
        ) : (
          <section className="list-card">
            <h2 className="list-title">{listTitle}</h2>
            <div className="toolbar">
              <input
                className="search-input"
                placeholder="Поиск по названию или номеру"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="sort-select"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button className="reset-btn" onClick={resetFilters}>
                Сбросить
              </button>
            </div>

            <table className="doc-table">
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Тип</th>
                  <th>Версия</th>
                  {section === "inbox" ? <th>Статус</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.map((document) => (
                  <tr
                    key={document.id}
                    className={selectedDocumentId === document.id ? "active" : ""}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <td>
                      <div className="doc-name">{document.title}</div>
                      <div className="doc-sub">{document.number || formatDate(document.documentDate)}</div>
                    </td>
                    <td>{typeLabel(document.type)}</td>
                    <td>v{document.activeVersionNo || 0}</td>
                    {section === "inbox" ? (
                      <td>
                        <span className={`status ${document.isAcknowledged ? "ok" : "warn"}`}>
                          {document.isAcknowledged ? "Ознакомлен" : "Ожидается"}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            {visibleDocuments.length === 0 ? (
              <div className="empty">
                {section === "archive"
                  ? "В архиве пока нет документов"
                  : search
                    ? "Ничего не найдено"
                    : "Документов этого типа пока нет"}
              </div>
            ) : null}
          </section>
        )}
      </main>

      {createOpen ? (
        <div className="overlay" onClick={() => setCreateOpen(false)}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateDocument}
          >
            <div className="modal-body">
              <h2 className="modal-title">Создать документ</h2>
              <div className="form-grid">
                <div className="form-row">
                  <label className="form-field">
                    Тип
                    <select
                      className="field-select"
                      value={createForm.type}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, type: event.target.value }))
                      }
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    Дата документа
                    <input
                      className="field-input"
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
                </div>

                <label className="form-field">
                  Название документа
                  <input
                    className="field-input"
                    value={createForm.title}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, title: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="form-field">
                  Описание
                  <textarea
                    rows="4"
                    placeholder="Краткое описание документа"
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="form-field">
                  <span>Сотрудники для ознакомления</span>
                  <div className="users-toolbar">
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() =>
                        setCreateForm((current) => ({
                          ...current,
                          assignedUsers: employeeUsers.map((candidate) => candidate.id),
                        }))
                      }
                    >
                      Выбрать всех
                    </button>
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() =>
                        setCreateForm((current) => ({ ...current, assignedUsers: [] }))
                      }
                    >
                      Снять выделение
                    </button>
                  </div>
                  <div className="users-box">
                    {employeeUsers.map((candidate) => (
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
                          {candidate.fullName} ({candidate.email})
                        </span>
                      </label>
                    ))}
                    {employeeUsers.length === 0 ? (
                      <div className="muted">Сотрудники пока не загружены</div>
                    ) : null}
                  </div>
                </div>

                <label className="form-field">
                  Файл документа
                  <input
                    className="file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        docFile: event.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn cancel" type="button" onClick={() => setCreateOpen(false)}>
                Отмена
              </button>
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Создать документ"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedDocument ? (
        <div className="overlay" onClick={() => setSelectedDocumentId(null)}>
          <div className="doc-modal" onClick={(event) => event.stopPropagation()}>
            <DocumentPage
              document={selectedDocument}
              users={users}
              isResponsible={isResponsible}
              loading={loading}
              typeLabel={typeLabel}
              formatDate={formatDate}
              typeOptions={TYPE_OPTIONS}
              onClose={() => setSelectedDocumentId(null)}
              onSaveRequisites={handleSaveRequisites}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onCreateVersion={handleCreateVersion}
              onAcknowledge={handleAcknowledge}
              onPublish={handlePublish}
              notice={notice}
              error={error}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
