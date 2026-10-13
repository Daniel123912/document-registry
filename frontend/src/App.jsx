import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./styles/app.css";
import {
  acknowledgeDocument,
  archiveDocument,
  createDocument,
  createFolder,
  createEmailTemplateFolder,
  createVersion,
  deleteDocument,
  deleteVersion,
  deleteFolder,
  deleteEmailTemplateFolder,
  deleteLetter,
  fetchAssignedDocuments,
  fetchDocuments,
  fetchFolders,
  fetchEmailTemplateFolders,
  fetchLetters,
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
  updateEmailTemplateFolder,
} from "./api/client";
import { withReadableFilenames } from "./utils/filenames";
import { addDays, toIsoDate } from "./utils/dates";
import { folderPathLabels } from "./utils/folders";
import { typeLabel, LEGAL_ENTITY_TYPE } from "./constants";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import DocumentList from "./components/DocumentList";
import ReportTable from "./components/ReportTable";
import LettersList from "./components/LettersList";
import LetterComposer from "./components/LetterComposer";
const EmailTemplatesEditor = lazy(() => import("./components/EmailTemplatesEditor"));
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

function readDocumentIdFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get("document");
    if (!raw) {
      return null;
    }
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function clearDocumentQueryParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("document")) {
      return;
    }
    url.searchParams.delete("document");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    // ignore
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("bakorToken") || "");
  const [user, setUser] = useState(() => readStoredUser());
  const [authForm, setAuthForm] = useState({
    email: "responsible@bakor.local",
    password: "admin1234",
  });
  const [section, setSection] = useState("active");
  const [activeType, setActiveType] = useState("order");
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [lettersOpen, setLettersOpen] = useState(true);
  const [lettersFolderId, setLettersFolderId] = useState(null);
  const [lettersView, setLettersView] = useState("list");
  const [activeLetterId, setActiveLetterId] = useState(null);
  const [letters, setLetters] = useState([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [lettersComposeKey, setLettersComposeKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [assignedDocuments, setAssignedDocuments] = useState([]);
  const [trashDocuments, setTrashDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [emailTemplateFolders, setEmailTemplateFolders] = useState([]);
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
  const pendingDocumentIdRef = useRef(readDocumentIdFromUrl());
  const isResponsible = user?.role === "responsible";
  const employeeUsers = asArray(users).filter(
    (candidate) => candidate.role === "employee" && candidate.isActive !== false
  );
  const inboxPendingCount = useMemo(
    () => assignedDocuments.filter((document) => !document.isAcknowledged).length,
    [assignedDocuments]
  );

  const selectedDocument = useMemo(
    () =>
      [...documents, ...assignedDocuments, ...trashDocuments].find(
        (document) => document.id === selectedDocumentId
      ) || null,
    [assignedDocuments, documents, trashDocuments, selectedDocumentId]
  );

  const listTitle = useMemo(() => {
    if (section === "inbox") {
      return "На ознакомление";
    }
    if (section === "report") {
      return "Отчет по ознакомлению";
    }
    if (section === "letters") {
      const path = folderPathLabels(emailTemplateFolders, lettersFolderId);
      if (lettersView === "templates") {
        return path.length ? `Шаблоны писем: ${path.join(" / ")}` : "Шаблоны писем";
      }
      if (lettersView === "compose") {
        return activeLetterId ? "Письмо" : "Новое письмо";
      }
      return path.length ? `Письма: ${path.join(" / ")}` : "Письма";
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
  }, [activeFolderId, activeType, activeLetterId, emailTemplateFolders, folders, lettersFolderId, lettersView, section]);

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

    const source = section === "inbox" ? assignedDocuments : documents;

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
        fetchDocuments(currentToken, "all"),
        fetchAssignedDocuments(currentToken),
        fetchFolders(currentToken),
      ];

      if (currentUser.role === "responsible") {
        requests.push(
          fetchReport(currentToken),
          fetchUsers(currentToken),
          fetchTrashDocuments(currentToken),
          fetchEmailTemplateFolders(currentToken)
        );
      }

      const [
        documentsData,
        assignedData,
        foldersData = [],
        reportData = [],
        usersData = [],
        trashData = [],
        emailFoldersData = [],
      ] = await Promise.all(requests);

      const nextDocuments = asArray(documentsData).map(withReadableFilenames);
      const nextAssigned = asArray(assignedData).map(withReadableFilenames);
      const nextTrash = asArray(trashData).map(withReadableFilenames);

      setDocuments(nextDocuments);
      setAssignedDocuments(nextAssigned);
      setFolders(asArray(foldersData));
      setEmailTemplateFolders(asArray(emailFoldersData));
      setReportRows(asArray(reportData));
      setUsers(asArray(usersData));
      setTrashDocuments(nextTrash);

      const pendingId = pendingDocumentIdRef.current;
      if (pendingId) {
        const found =
          nextDocuments.find((document) => document.id === pendingId) ||
          nextAssigned.find((document) => document.id === pendingId) ||
          nextTrash.find((document) => document.id === pendingId);

        if (found) {
          if (found.isAssigned) {
            setSection("inbox");
          } else if (found.status === "archived") {
            setSection("archive");
          } else if (found.deletedAt) {
            setSection("trash");
          } else {
            setSection("active");
            if (found.type) {
              setActiveType(found.type);
            }
            setActiveFolderId(found.folderId ?? null);
          }
          overlayOpenedAt.current = Date.now();
          setSelectedDocumentId(pendingId);
          pendingDocumentIdRef.current = null;
          clearDocumentQueryParam();
        }
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
    setEmailTemplateFolders([]);
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
    setSelectedDocumentId(null);
  }

  function selectFolder(type, folderId) {
    setSection("active");
    setActiveType(type);
    setActiveFolderId(folderId);
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

  function handleCreateEmailFolder(parentId) {
    openPrompt({
      kind: "create-email-folder",
      title: parentId ? "Создать подпапку" : "Создать папку",
      inputLabel: "Название папки",
      confirmLabel: "Создать",
      parentId,
    });
  }

  function handleRenameEmailFolder(folder) {
    openPrompt({
      kind: "rename-email-folder",
      title: "Переименовать папку",
      inputLabel: "Название папки",
      defaultValue: folder.name,
      confirmLabel: "Сохранить",
      folder,
    });
  }

  function handleDeleteEmailFolder(folder) {
    openPrompt({
      kind: "delete-email-folder",
      title: "Удалить папку",
      description: `Удалить папку «${folder.name}»? Шаблоны и вложенные папки останутся у родителя.`,
      confirmLabel: "Удалить",
      danger: true,
      folder,
    });
  }

  function selectLettersFolder(folderId) {
    setSection("letters");
    setLettersFolderId(folderId);
    setLettersView("list");
    setActiveLetterId(null);
    setLettersOpen(true);
    setSelectedDocumentId(null);
  }

  function openLettersList(folderId = lettersFolderId) {
    setSection("letters");
    setLettersFolderId(folderId ?? null);
    setLettersView("list");
    setActiveLetterId(null);
    setLettersOpen(true);
    setSelectedDocumentId(null);
  }

  function openLetterTemplates(folderId) {
    setSection("letters");
    setLettersFolderId(folderId ?? null);
    setLettersView("templates");
    setActiveLetterId(null);
    setLettersOpen(true);
    setSelectedDocumentId(null);
  }

  function handleDeleteLetter(letter) {
    openPrompt({
      kind: "delete-letter",
      title: "Удалить письмо",
      description: `Удалить письмо «${letter.subject || "Без темы"}»? Это действие нельзя отменить.`,
      confirmLabel: "Удалить",
      danger: true,
      letterId: letter.id,
    });
  }

  function openLetterCompose(folderId, letterId = null) {
    setSection("letters");
    setLettersFolderId(folderId ?? null);
    setLettersView("compose");
    setActiveLetterId(letterId);
    setLettersComposeKey((current) => current + 1);
    setLettersOpen(true);
    setSelectedDocumentId(null);
  }

  async function loadLetters(currentToken = token, folderId = lettersFolderId) {
    if (!currentToken || !isResponsible) {
      return;
    }

    setLettersLoading(true);
    try {
      const rows = await fetchLetters(currentToken, folderId ?? null);
      setLetters(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLettersLoading(false);
    }
  }

  useEffect(() => {
    if (section === "letters" && lettersView === "list" && token && isResponsible) {
      loadLetters();
    }
  }, [section, lettersView, lettersFolderId, token, isResponsible]);

  async function submitPrompt(value) {
    if (!prompt) {
      return;
    }

    if (
      prompt.kind === "create-folder" ||
      prompt.kind === "rename-folder" ||
      prompt.kind === "create-email-folder" ||
      prompt.kind === "rename-email-folder"
    ) {
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
        } else if (prompt.kind === "rename-folder") {
          await updateFolder(token, prompt.folder.id, { name: trimmed });
          setNotice("Папка переименована.");
        } else if (prompt.kind === "create-email-folder") {
          const folder = await createEmailTemplateFolder(token, {
            name: trimmed,
            parentId: prompt.parentId == null ? null : prompt.parentId,
          });
          setNotice("Папка создана.");
          setSection("letters");
          setLettersFolderId(folder.id);
          setLettersView("list");
          setLettersOpen(true);
        } else {
          await updateEmailTemplateFolder(token, prompt.folder.id, { name: trimmed });
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
      } else if (prompt.kind === "delete-email-folder") {
        await deleteEmailTemplateFolder(token, prompt.folder.id);
        if (lettersFolderId === prompt.folder.id) {
          setLettersFolderId(prompt.folder.parentId == null ? null : prompt.folder.parentId);
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
      } else if (prompt.kind === "delete-letter") {
        await deleteLetter(token, prompt.letterId);
        if (activeLetterId === prompt.letterId) {
          setActiveLetterId(null);
          setLettersView("list");
        }
        setNotice("Письмо удалено.");
        await loadLetters();
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
        folders={folders}
        lettersOpen={lettersOpen}
        lettersFolderId={lettersFolderId}
        emailTemplateFolders={emailTemplateFolders}
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
        onLetters={() => openLettersList(null)}
        onToggleLetters={() => setLettersOpen((current) => !current)}
        onSelectLettersFolder={selectLettersFolder}
        onCreateEmailFolder={handleCreateEmailFolder}
        onRenameEmailFolder={handleRenameEmailFolder}
        onDeleteEmailFolder={handleDeleteEmailFolder}
        onViewLetterTemplates={(folderId) => openLetterTemplates(folderId)}
        onComposeLetter={(folderId) => openLetterCompose(folderId)}
        onCreate={openCreateModal}
        onLogout={logout}
        inboxPendingCount={inboxPendingCount}
      />

      <main className="main">
        {notice ? <div className="alert success">{notice}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        {section === "report" && isResponsible ? (
          <ReportTable listTitle={listTitle} reportRows={reportRows} folders={folders} />
        ) : section === "letters" && isResponsible ? (
          lettersView === "templates" ? (
            <Suspense
              fallback={
                <section className="list-card">
                  <h2 className="list-title">{listTitle}</h2>
                  <div className="empty">Загрузка редактора...</div>
                </section>
              }
            >
              <EmailTemplatesEditor
                listTitle={listTitle}
                folderId={lettersFolderId}
                token={token}
                onBack={() => openLettersList(lettersFolderId)}
                onNotice={setNotice}
                onError={setError}
              />
            </Suspense>
          ) : lettersView === "compose" ? (
            <LetterComposer
              key={`letter-compose-${lettersComposeKey}`}
              token={token}
              folderId={lettersFolderId}
              letterId={activeLetterId}
              onBack={() => openLettersList(lettersFolderId)}
              onNotice={setNotice}
              onError={setError}
              onSaved={() => loadLetters()}
            />
          ) : (
            <LettersList
              listTitle={listTitle}
              letters={letters}
              loading={lettersLoading}
              onSelect={(letterId) => openLetterCompose(lettersFolderId, letterId)}
              onCompose={() => openLetterCompose(lettersFolderId)}
              onDelete={handleDeleteLetter}
            />
          )
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
