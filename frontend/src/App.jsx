import { useEffect, useMemo, useRef, useState } from "react";
import "./styles/app.css";
import {
  acknowledgeDocument,
  archiveDocument,
  createDocument,
  createFolder,
  createVersion,
  deleteDocument,
  deleteVersion,
  deleteFolder,
  fetchAssignedDocuments,
  fetchDocuments,
  fetchFolders,
  fetchReport,
  fetchTrashDocuments,
  fetchUsers,
  login,
  permanentDeleteDocument,
  publishDocument,
  restoreDocument,
  unarchiveDocument,
  updateDocument,
  updateFolder,
} from "./api/client";
import { withReadableFilenames } from "./utils/filenames";
import { addDays, toIsoDate } from "./utils/dates";
import { folderPathLabels } from "./utils/folders";
import { typeLabel } from "./constants";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import DocumentList from "./components/DocumentList";
import ReportTable from "./components/ReportTable";
import CreateDocumentModal from "./components/CreateDocumentModal";
import DocumentPage from "./components/DocumentPage";
import PromptModal from "./components/PromptModal";

const emptyCreateForm = {
  title: "",
  type: "order",
  folderId: "",
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
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [activeOpen, setActiveOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [assignedDocuments, setAssignedDocuments] = useState([]);
  const [trashDocuments, setTrashDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
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
  const [prompt, setPrompt] = useState(null);

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
    const path = folderPathLabels(folders, activeFolderId);
    if (path.length) {
      return `Список документов: ${typeLabel(activeType)} / ${path.join(" / ")}`;
    }
    return `Список документов: ${typeLabel(activeType)}`;
  }, [activeFolderId, activeType, folders, section]);

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
      if (document.type !== activeType) {
        return false;
      }
      if (activeFolderId != null) {
        return Number(document.folderId) === Number(activeFolderId);
      }
      return true;
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
  }, [
    activeFolderId,
    activeType,
    assignedDocuments,
    documents,
    isResponsible,
    search,
    section,
    sort,
    trashDocuments,
  ]);

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
        fetchFolders(currentToken),
      ];

      if (currentUser.role === "responsible") {
        requests.push(fetchReport(currentToken), fetchUsers(currentToken), fetchTrashDocuments(currentToken));
      }

      const [
        documentsData,
        assignedData,
        foldersData = [],
        reportData = [],
        usersData = [],
        trashData = [],
      ] = await Promise.all(requests);

      setDocuments(asArray(documentsData).map(withReadableFilenames));
      setAssignedDocuments(asArray(assignedData).map(withReadableFilenames));
      setFolders(asArray(foldersData));
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

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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
    setFolders([]);
    setReportRows([]);
    setUsers([]);
    setActiveFolderId(null);
    setNotice("");
    setError("");
  }

  function openCreateModal() {
    setCreateForm({
      ...emptyCreateForm,
      type: section === "active" ? activeType : "order",
      folderId: section === "active" && activeFolderId != null ? String(activeFolderId) : "",
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
      if (createForm.folderId) {
        formData.append("folderId", createForm.folderId);
      }
      if (createForm.docFile) {
        formData.append("docFile", createForm.docFile);
      }

      const result = await createDocument(token, formData);
      setCreateForm(emptyCreateForm);
      setCreateOpen(false);
      setNotice(result.message);
      setSection("active");
      setActiveType(createForm.type);
      setActiveFolderId(createForm.folderId ? Number(createForm.folderId) : null);
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

  function openPrompt(next) {
    setError("");
    setPrompt(next);
  }

  function handleDelete(documentId) {
    openPrompt({
      kind: "delete-document",
      title: "В корзину",
      description:
        "Переместить документ в корзину? Его можно будет восстановить в течение 30 дней.",
      confirmLabel: "В корзину",
      documentId,
    });
  }

  function handleDeleteVersion(documentId, versionNo) {
    openPrompt({
      kind: "delete-version",
      title: "Удалить версию",
      description: `Удалить версию v${versionNo}? Файл этой версии будет удален безвозвратно.`,
      confirmLabel: "Удалить",
      danger: true,
      documentId,
      versionNo,
    });
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

  function handlePermanentDelete(documentId) {
    openPrompt({
      kind: "permanent-delete-document",
      title: "Удалить безвозвратно",
      description: "Удалить документ безвозвратно? Это действие нельзя отменить.",
      confirmLabel: "Удалить",
      danger: true,
      documentId,
    });
  }

  function selectType(type) {
    setSection("active");
    setActiveType(type);
    setActiveFolderId(null);
    setActiveOpen(true);
    setSelectedDocumentId(null);
  }

  function selectFolder(type, folderId) {
    setSection("active");
    setActiveType(type);
    setActiveFolderId(folderId);
    setActiveOpen(true);
    setSelectedDocumentId(null);
  }

  function handleCreateFolder(type, parentId) {
    openPrompt({
      kind: "create-folder",
      title: parentId ? "Создать подпапку" : "Создать папку",
      inputLabel: "Название папки",
      confirmLabel: "Создать",
      type,
      parentId,
    });
  }

  function handleRenameFolder(folder) {
    openPrompt({
      kind: "rename-folder",
      title: "Переименовать папку",
      inputLabel: "Название папки",
      defaultValue: folder.name,
      confirmLabel: "Сохранить",
      folder,
    });
  }

  function handleDeleteFolder(folder) {
    openPrompt({
      kind: "delete-folder",
      title: "Удалить папку",
      description: `Удалить папку «${folder.name}»? Документы и вложенные папки останутся у родителя.`,
      confirmLabel: "Удалить",
      danger: true,
      folder,
    });
  }

  async function submitPrompt(value) {
    if (!prompt) {
      return;
    }

    if (prompt.kind === "create-folder" || prompt.kind === "rename-folder") {
      const trimmed = String(value || "").trim();
      if (!trimmed) {
        setError("Укажите название папки.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        if (prompt.kind === "create-folder") {
          const folder = await createFolder(token, {
            name: trimmed,
            type: prompt.type,
            parentId: prompt.parentId == null ? null : prompt.parentId,
          });
          setNotice("Папка создана.");
          setSection("active");
          setActiveType(prompt.type);
          setActiveFolderId(folder.id);
          setActiveOpen(true);
        } else {
          await updateFolder(token, prompt.folder.id, { name: trimmed });
          setNotice("Папка переименована.");
        }
        setPrompt(null);
        await loadData();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (prompt.kind === "delete-folder") {
        await deleteFolder(token, prompt.folder.id);
        if (activeFolderId === prompt.folder.id) {
          setActiveFolderId(prompt.folder.parentId == null ? null : prompt.folder.parentId);
        }
        setNotice("Папка удалена.");
      } else if (prompt.kind === "delete-document") {
        const result = await deleteDocument(token, prompt.documentId);
        setNotice(result.message);
        setSelectedDocumentId(null);
      } else if (prompt.kind === "permanent-delete-document") {
        const result = await permanentDeleteDocument(token, prompt.documentId);
        setNotice(result.message);
        setSelectedDocumentId(null);
      } else if (prompt.kind === "delete-version") {
        const result = await deleteVersion(token, prompt.documentId, prompt.versionNo);
        setNotice(result.message);
      }
      setPrompt(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
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
        activeFolderId={activeFolderId}
        activeOpen={activeOpen}
        folders={folders}
        onToggleActive={() => setActiveOpen((current) => !current)}
        onInbox={() => {
          setSection("inbox");
          setSelectedDocumentId(null);
        }}
        onSelectType={selectType}
        onSelectFolder={selectFolder}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
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
          folders={folders}
          employeeUsers={employeeUsers}
          loading={loading}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateDocument}
        />
      ) : null}

      {prompt ? (
        <PromptModal
          key={`${prompt.kind}-${prompt.folder?.id || prompt.documentId || prompt.versionNo || prompt.parentId || prompt.type || "new"}`}
          title={prompt.title}
          description={prompt.description}
          inputLabel={prompt.inputLabel}
          defaultValue={prompt.defaultValue || ""}
          confirmLabel={prompt.confirmLabel}
          danger={Boolean(prompt.danger)}
          loading={loading}
          error={error}
          onClose={() => {
            if (!loading) {
              setPrompt(null);
              setError("");
            }
          }}
          onConfirm={submitPrompt}
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
              folders={folders}
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
              onDeleteVersion={handleDeleteVersion}
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
