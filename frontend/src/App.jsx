import { useEffect, useMemo, useRef, useState } from "react";
import "./styles/app.css";
import {
  acknowledgeDocument,
  archiveDocument,
  createDocument,
  createVersion,
  deleteDocument,
  fetchAssignedDocuments,
  fetchDocuments,
  fetchReport,
  fetchTrashDocuments,
  fetchUsers,
  login,
  permanentDeleteDocument,
  publishDocument,
  restoreDocument,
  unarchiveDocument,
  updateDocument,
} from "./api/client";
import { withReadableFilenames } from "./utils/filenames";
import { addDays, toIsoDate } from "./utils/dates";
import { typeLabel } from "./constants";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import DocumentList from "./components/DocumentList";
import ReportTable from "./components/ReportTable";
import CreateDocumentModal from "./components/CreateDocumentModal";
import DocumentPage from "./components/DocumentPage";

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

function readStoredUser() {
  try {
    const raw = localStorage.getItem("bakorUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("bakorUser");
    return null;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("bakorToken") || "");
  const [user, setUser] = useState(() => readStoredUser());
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
  const [trashDocuments, setTrashDocuments] = useState([]);
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

  const overlayOpenedAt = useRef(0);
  const isResponsible = user?.role === "responsible";
  const employeeUsers = asArray(users).filter((candidate) => candidate.role === "employee");

  const selectedDocument = useMemo(
    () =>
      [...documents, ...assignedDocuments, ...trashDocuments].find(
        (document) => document.id === selectedDocumentId
      ) || null,
    [assignedDocuments, documents, trashDocuments, selectedDocumentId]
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
    if (section === "trash") {
      return "Корзина";
    }
    return `Список документов: ${typeLabel(activeType)}`;
  }, [activeType, section]);

  const visibleDocuments = useMemo(() => {
    if (section === "trash") {
      let rows = [...trashDocuments];

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
        const leftDate = new Date(left.deletedAt || 0).getTime();
        const rightDate = new Date(right.deletedAt || 0).getTime();
        return sort === "old" ? leftDate - rightDate : rightDate - leftDate;
      });

      return rows;
    }

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
  }, [activeType, assignedDocuments, documents, isResponsible, search, section, sort, trashDocuments]);

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
        requests.push(fetchReport(currentToken), fetchUsers(currentToken), fetchTrashDocuments(currentToken));
      }

      const [documentsData, assignedData, reportData = [], usersData = [], trashData = []] =
        await Promise.all(requests);

      setDocuments(asArray(documentsData).map(withReadableFilenames));
      setAssignedDocuments(asArray(assignedData).map(withReadableFilenames));
      setReportRows(asArray(reportData));
      setUsers(asArray(usersData));
      setTrashDocuments(asArray(trashData).map(withReadableFilenames));
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
    setTrashDocuments([]);
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

  async function handleUnarchive(documentId) {
    setLoading(true);
    setError("");
    try {
      const result = await unarchiveDocument(token, documentId);
      setNotice(result.message);
      setSection("active");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId) {
    if (
      !window.confirm(
        "Переместить документ в корзину? Его можно будет восстановить в течение 30 дней."
      )
    ) {
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

  async function handleRestore(documentId) {
    setLoading(true);
    setError("");
    try {
      const result = await restoreDocument(token, documentId);
      setNotice(result.message);
      setSelectedDocumentId(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete(documentId) {
    if (!window.confirm("Удалить документ безвозвратно? Это действие нельзя отменить.")) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await permanentDeleteDocument(token, documentId);
      setNotice(result.message);
      setSelectedDocumentId(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectType(type) {
    setSection("active");
    setActiveType(type);
    setActiveOpen(true);
    setSelectedDocumentId(null);
  }

  if (!token || !user) {
    return (
      <LoginPage
        authForm={authForm}
        setAuthForm={setAuthForm}
        onSubmit={handleLogin}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        isResponsible={isResponsible}
        section={section}
        activeType={activeType}
        activeOpen={activeOpen}
        onToggleActive={() => setActiveOpen((current) => !current)}
        onInbox={() => {
          setSection("inbox");
          setSelectedDocumentId(null);
        }}
        onSelectType={selectType}
        onArchive={() => {
          setSection("archive");
          setSelectedDocumentId(null);
        }}
        onTrash={() => {
          setSection("trash");
          setSelectedDocumentId(null);
        }}
        onReport={() => {
          setSection("report");
          setSelectedDocumentId(null);
        }}
        onCreate={openCreateModal}
        onLogout={logout}
      />

      <main className="main">
        {notice ? <div className="alert success">{notice}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        {section === "report" && isResponsible ? (
          <ReportTable listTitle={listTitle} reportRows={reportRows} />
        ) : (
          <DocumentList
            listTitle={listTitle}
            section={section}
            search={search}
            sort={sort}
            visibleDocuments={visibleDocuments}
            selectedDocumentId={selectedDocumentId}
            onSearch={setSearch}
            onSort={setSort}
            onReset={() => {
              setSearch("");
              setSort("new");
            }}
            onSelect={(documentId) => {
              overlayOpenedAt.current = Date.now();
              setSelectedDocumentId(documentId);
            }}
          />
        )}
      </main>

      {createOpen ? (
        <CreateDocumentModal
          createForm={createForm}
          setCreateForm={setCreateForm}
          employeeUsers={employeeUsers}
          loading={loading}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateDocument}
        />
      ) : null}

      {selectedDocument ? (
        <div
          className="overlay"
          onClick={() => {
            if (Date.now() - overlayOpenedAt.current < 400) {
              return;
            }
            setSelectedDocumentId(null);
          }}
        >
          <div className="doc-modal" onClick={(event) => event.stopPropagation()}>
            <DocumentPage
              document={selectedDocument}
              users={users}
              isResponsible={isResponsible}
              isTrash={section === "trash"}
              loading={loading}
              token={token}
              onClose={() => setSelectedDocumentId(null)}
              onSaveRequisites={handleSaveRequisites}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
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
