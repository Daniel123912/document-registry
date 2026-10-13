import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchDocumentFile } from "../api/client";
import { TYPE_OPTIONS } from "../constants";
import {
  buildLineDiff,
  htmlToLines,
  previousVersionNo,
  sheetToLines,
} from "../utils/documentDiff";
import AccessUsersModal from "./AccessUsersModal";
import DiffViewer from "./DiffViewer";
import { formatDate, toIsoDateValue, daysUntilTrashPurge } from "../utils/dates";
import {
  isImageFile,
  isLegacyWordFile,
  isPdfFile,
  isSpreadsheetFile,
  isWordFile,
  parseDocumentPreview,
  sheetToPreviewHtml,
} from "../utils/filePreview";
import { flattenFoldersForSelect } from "../utils/folders";

const emptyVersionForm = {
  changeReason: "",
  versionFile: null,
};

const ACCESS_SUMMARY_EXPAND_AT = 5;

const emptyComparePreview = {
  url: null,
  mimeType: null,
  docHtml: "",
  textLines: [],
  sheetNames: [],
  size: 0,
  loading: false,
  error: "",
  name: "",
};

function pdfViewerSrc(url) {
  return url ? `${url}#toolbar=1&navpanes=0` : "";
}

function previewFilename(document, previewVersionNo) {
  const versions = document.versions || [];
  const selected = versions.find((version) => version.versionNo === previewVersionNo);
  return selected?.originalFilename || document.currentFilename || "";
}

function versionLabel(versionNo, activeVersionNo) {
  if (!versionNo) {
    return "Черновик";
  }
  return versionNo === activeVersionNo ? `v${versionNo} (текущая)` : `v${versionNo}`;
}

export default function DocumentPage({
  document,
  users,
  folders = [],
  isResponsible,
  isTrash = false,
  loading,
  token,
  onClose,
  onSaveRequisites,
  onArchive,
  onUnarchive,
  onDelete,
  onRestore,
  onPermanentDelete,
  onCreateVersion,
  onDeleteVersion,
  onAcknowledge,
  onPublish,
  notice,
  error,
}) {
  const [tab, setTab] = useState("preview");
  const [previewVersionNo, setPreviewVersionNo] = useState(document.activeVersionNo || 0);
  const [activeSheetName, setActiveSheetName] = useState("");
  const [previewScale, setPreviewScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareWithVersionNo, setCompareWithVersionNo] = useState(null);
  const previewStageRef = useRef(null);
  const spreadsheetRef = useRef({ workbook: null, xlsx: null });
  const compareSpreadsheetRef = useRef({ workbook: null, xlsx: null });
  const [editForm, setEditForm] = useState({
    title: document.title || "",
    type: document.type,
    number: document.number || "",
    documentDate: toIsoDateValue(document.documentDate),
    description: document.description || "",
    assignedUsers: (document.assignedUsers || []).map((user) => user.id),
    folderId: document.folderId == null ? "" : String(document.folderId),
  });
  const [versionForm, setVersionForm] = useState(emptyVersionForm);
  const [requisitesOpen, setRequisitesOpen] = useState({
    documents: false,
    access: false,
  });
  const [previewOpen, setPreviewOpen] = useState({
    versions: false,
    ack: false,
  });
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [versionMenu, setVersionMenu] = useState(null);
  const versionMenuRef = useRef(null);
  const [filePreview, setFilePreview] = useState({
    url: null,
    mimeType: null,
    docHtml: "",
    textLines: [],
    sheetNames: [],
    size: 0,
    loading: false,
    error: "",
  });
  const [comparePreview, setComparePreview] = useState(emptyComparePreview);

  const employeeUsers = (Array.isArray(users) ? users : []).filter(
    (candidate) => candidate.isActive !== false
  );
  const selectedAccessUsers = employeeUsers.filter((candidate) =>
    editForm.assignedUsers.includes(candidate.id)
  );
  const accessSummaryExpanded = selectedAccessUsers.length >= ACCESS_SUMMARY_EXPAND_AT;
  const previewVersionsExpanded = (document.versions || []).length >= ACCESS_SUMMARY_EXPAND_AT;
  const previewAckExpanded = (document.assignedUsers || []).length >= ACCESS_SUMMARY_EXPAND_AT;
  const folderOptions = flattenFoldersForSelect(folders, editForm.type);
  const ackTotal = document.assignedCount || document.assignedUsers?.length || 0;
  const ackDone = document.acknowledgedCount || 0;
  const ackPercent = ackTotal ? Math.round((ackDone / ackTotal) * 100) : 0;

  const previewFile = useMemo(() => {
    const versions = document.versions || [];
    const selected = versions.find((version) => version.versionNo === previewVersionNo);
    if (selected) {
      return {
        url: filePreview.url,
        name: selected.originalFilename,
        mimeType: filePreview.mimeType || selected.mimeType,
        label: versionLabel(selected.versionNo, document.activeVersionNo),
      };
    }
    return {
      url: filePreview.url,
      name: document.currentFilename,
      mimeType: filePreview.mimeType || document.currentMimeType,
      label: versionLabel(document.activeVersionNo, document.activeVersionNo),
    };
  }, [document, previewVersionNo, filePreview]);

  const canCompare = (document.versions || []).length > 1;
  const compareVersionOptions = useMemo(
    () =>
      (document.versions || [])
        .filter((version) => version.versionNo !== previewVersionNo)
        .sort((left, right) => right.versionNo - left.versionNo),
    [document.versions, previewVersionNo]
  );

  const comparing =
    compareEnabled &&
    canCompare &&
    Boolean(compareWithVersionNo) &&
    !filePreview.loading &&
    !comparePreview.loading;

  const canZoom =
    !comparing &&
    (isImageFile(previewFile.name, previewFile.mimeType) ||
      isWordFile(previewFile.name, previewFile.mimeType) ||
      isSpreadsheetFile(previewFile.name, previewFile.mimeType));

  const lineDiff = useMemo(() => {
    if (!comparing || filePreview.loading || comparePreview.loading) {
      return null;
    }
    if (isWordFile(previewFile.name, previewFile.mimeType)) {
      return buildLineDiff(
        htmlToLines(comparePreview.docHtml),
        htmlToLines(filePreview.docHtml)
      );
    }
    if (
      isSpreadsheetFile(previewFile.name, previewFile.mimeType) &&
      filePreview.docHtml &&
      !filePreview.sheetNames.length
    ) {
      return buildLineDiff(
        htmlToLines(comparePreview.docHtml),
        htmlToLines(filePreview.docHtml)
      );
    }
    if (isSpreadsheetFile(previewFile.name, previewFile.mimeType)) {
      const current = spreadsheetRef.current;
      const base = compareSpreadsheetRef.current;
      const xlsx = current.xlsx || base.xlsx;
      if (!xlsx) {
        return null;
      }
      return buildLineDiff(
        sheetToLines(base.workbook?.Sheets?.[activeSheetName], xlsx),
        sheetToLines(current.workbook?.Sheets?.[activeSheetName], xlsx)
      );
    }
    return null;
  }, [
    comparing,
    previewFile.name,
    previewFile.mimeType,
    filePreview.docHtml,
    filePreview.textLines,
    filePreview.sheetNames,
    filePreview.loading,
    comparePreview.docHtml,
    comparePreview.textLines,
    comparePreview.loading,
    comparePreview.sheetNames,
    activeSheetName,
  ]);

  const stageKind =
    filePreview.loading || filePreview.error || (compareEnabled && comparePreview.loading)
      ? "empty"
      : comparing && lineDiff
        ? "diff"
        : comparing &&
            (isPdfFile(previewFile.name, previewFile.mimeType) ||
              isImageFile(previewFile.name, previewFile.mimeType))
          ? "compare-split"
          : isPdfFile(previewFile.name, previewFile.mimeType)
            ? "embed"
            : isImageFile(previewFile.name, previewFile.mimeType)
              ? "image"
              : isSpreadsheetFile(previewFile.name, previewFile.mimeType)
                ? "sheet"
                : isWordFile(previewFile.name, previewFile.mimeType)
                  ? "docx"
                  : "empty";

  const sheetNames = useMemo(() => {
    if (!comparing) {
      return filePreview.sheetNames;
    }
    return Array.from(
      new Set([...(filePreview.sheetNames || []), ...(comparePreview.sheetNames || [])])
    );
  }, [comparing, filePreview.sheetNames, comparePreview.sheetNames]);

  const activeSheetHtml = useMemo(() => {
    if (filePreview.loading) {
      return "";
    }
    const { workbook, xlsx } = spreadsheetRef.current;
    if (!workbook || !xlsx || !activeSheetName) {
      return "";
    }
    const sheet = workbook.Sheets[activeSheetName];
    if (!sheet) {
      return "";
    }
    return sheetToPreviewHtml(sheet, xlsx);
  }, [activeSheetName, filePreview.sheetNames, filePreview.loading]);

  useEffect(() => {
    setTab("preview");
    setPreviewVersionNo(document.activeVersionNo || 0);
    setCompareEnabled(false);
    setCompareWithVersionNo(null);
    setEditForm({
      title: document.title || "",
      type: document.type,
      number: document.number || "",
      documentDate: toIsoDateValue(document.documentDate),
      description: document.description || "",
      assignedUsers: (document.assignedUsers || []).map((user) => user.id),
      folderId: document.folderId == null ? "" : String(document.folderId),
    });
    setVersionForm(emptyVersionForm);
    setVersionMenu(null);
  }, [document.id]);

  useEffect(() => {
    setPreviewVersionNo(document.activeVersionNo || 0);
  }, [document.activeVersionNo]);

  useEffect(() => {
    const versions = document.versions || [];
    if (!versions.length) {
      setPreviewVersionNo(0);
      return;
    }
    if (!versions.some((version) => version.versionNo === previewVersionNo)) {
      setPreviewVersionNo(document.activeVersionNo || versions[0].versionNo);
    }
  }, [document.versions, document.activeVersionNo, previewVersionNo]);

  useEffect(() => {
    if (!canCompare) {
      setCompareEnabled(false);
      setCompareWithVersionNo(null);
      return;
    }
    const fallback = previousVersionNo(document.versions, previewVersionNo);
    setCompareWithVersionNo((current) => {
      if (current && current !== previewVersionNo) {
        const stillExists = (document.versions || []).some(
          (version) => version.versionNo === current
        );
        if (stillExists) {
          return current;
        }
      }
      return fallback;
    });
  }, [canCompare, document.versions, previewVersionNo]);

  useEffect(() => {
    if (tab === "version" && document.status !== "published") {
      setTab("preview");
    }
  }, [document.status, tab]);

  useEffect(() => {
    setPreviewScale(1);
  }, [document.id, previewVersionNo]);

  useEffect(() => {
    if (!sheetNames.length) {
      setActiveSheetName("");
      return;
    }

    setActiveSheetName((current) => (sheetNames.includes(current) ? current : sheetNames[0]));
  }, [sheetNames]);

  useEffect(() => {
    function handleFullscreenChange() {
      const stage = previewStageRef.current;
      setIsFullscreen(Boolean(stage && window.document.fullscreenElement === stage));
    }

    window.document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => window.document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!versionMenu) {
      return undefined;
    }

    function closeMenu(event) {
      if (versionMenuRef.current?.contains(event.target)) {
        return;
      }
      setVersionMenu(null);
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setVersionMenu(null);
      }
    }

    window.document.addEventListener("mousedown", closeMenu);
    window.document.addEventListener("contextmenu", closeMenu);
    window.document.addEventListener("keydown", handleKey);
    window.document.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.document.removeEventListener("mousedown", closeMenu);
      window.document.removeEventListener("contextmenu", closeMenu);
      window.document.removeEventListener("keydown", handleKey);
      window.document.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [versionMenu]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl;

    async function loadFile() {
      if (!token || !document.id) {
        return;
      }

      spreadsheetRef.current = { workbook: null, xlsx: null };
      setFilePreview({
        url: null,
        mimeType: null,
        docHtml: "",
        textLines: [],
        sheetNames: [],
        size: 0,
        loading: true,
        error: "",
      });

      try {
        const result = await fetchDocumentFile(token, document.id, previewVersionNo || undefined);
        objectUrl = result.objectUrl;
        const filename = previewFilename(document, previewVersionNo);
        const parsed = await parseDocumentPreview({
          blob: result.blob,
          mimeType: result.mimeType,
          size: result.size,
          filename,
        });

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        spreadsheetRef.current = { workbook: parsed.workbook, xlsx: parsed.xlsx };
        setFilePreview({
          url: result.objectUrl,
          mimeType: parsed.mimeType,
          docHtml: parsed.docHtml,
          textLines: parsed.textLines,
          sheetNames: parsed.sheetNames,
          size: parsed.size,
          loading: false,
          error: "",
        });
      } catch (requestError) {
        if (!cancelled) {
          setFilePreview({
            url: null,
            mimeType: null,
            docHtml: "",
            textLines: [],
            sheetNames: [],
            size: 0,
            loading: false,
            error: requestError.message,
          });
        }
      }
    }

    loadFile();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token, document.id, previewVersionNo]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl;

    async function loadCompareFile() {
      if (!token || !document.id || !compareEnabled || !compareWithVersionNo) {
        compareSpreadsheetRef.current = { workbook: null, xlsx: null };
        setComparePreview(emptyComparePreview);
        return;
      }

      compareSpreadsheetRef.current = { workbook: null, xlsx: null };
      setComparePreview({
        ...emptyComparePreview,
        loading: true,
      });

      try {
        const result = await fetchDocumentFile(token, document.id, compareWithVersionNo);
        objectUrl = result.objectUrl;
        const filename = previewFilename(document, compareWithVersionNo);
        const parsed = await parseDocumentPreview({
          blob: result.blob,
          mimeType: result.mimeType,
          size: result.size,
          filename,
        });

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        compareSpreadsheetRef.current = { workbook: parsed.workbook, xlsx: parsed.xlsx };
        setComparePreview({
          url: result.objectUrl,
          mimeType: parsed.mimeType,
          docHtml: parsed.docHtml,
          textLines: parsed.textLines,
          sheetNames: parsed.sheetNames,
          size: parsed.size,
          loading: false,
          error: "",
          name: filename,
        });
      } catch (requestError) {
        if (!cancelled) {
          compareSpreadsheetRef.current = { workbook: null, xlsx: null };
          setComparePreview({
            ...emptyComparePreview,
            loading: false,
            error: requestError.message,
          });
        }
      }
    }

    loadCompareFile();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token, document.id, compareEnabled, compareWithVersionNo]);

  function handleSave(event) {
    event.preventDefault();
    if (!String(editForm.title || "").trim() || !editForm.documentDate) {
      setRequisitesOpen((current) => ({ ...current, documents: true }));
      return;
    }
    onSaveRequisites(document.id, {
      title: editForm.title,
      type: editForm.type,
      number: editForm.number || "",
      documentDate: toIsoDateValue(editForm.documentDate),
      description: editForm.description || "",
      assignedUsers: (editForm.assignedUsers || []).map(Number),
      folderId: editForm.folderId ? Number(editForm.folderId) : null,
    });
  }

  function handleNewVersion(event) {
    event.preventDefault();
    onCreateVersion(event, document.id, versionForm);
    setTab("preview");
  }

  async function toggleFullscreen() {
    const stage = previewStageRef.current;
    if (!stage) {
      return;
    }

    try {
      if (window.document.fullscreenElement === stage) {
        await window.document.exitFullscreen();
        return;
      }

      await stage.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  }

  function adjustPreviewScale(delta) {
    setPreviewScale((current) => Math.min(2, Math.max(0.5, Number((current + delta).toFixed(2)))));
  }

  function openVersionMenu(event, version) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 196;
    const menuHeight = 48;
    setVersionMenu({
      versionNo: version.versionNo,
      x: Math.min(event.clientX, window.innerWidth - menuWidth),
      y: Math.min(event.clientY, window.innerHeight - menuHeight),
    });
  }

  const canManageVersions = isResponsible && !isTrash;
  const canDeleteSelectedVersion = (document.versions || []).length > 1;

  return (
    <section className="doc-page">
      <div className="doc-page-layout">
        <div className="doc-page-left">
          <header className="doc-page-head">
            <button
              className="doc-page-close"
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              title="Закрыть"
            >
              ×
            </button>
            <h2 className="doc-page-title">{document.title}</h2>
          </header>

          {notice ? <div className="alert success">{notice}</div> : null}
          {error ? <div className="alert error">{error}</div> : null}

          {isTrash ? (
            <div className="alert warn">
              Документ в корзине. Осталось {daysUntilTrashPurge(document.deletedAt)} дн. до
              безвозвратного удаления.
            </div>
          ) : null}

          <div className="doc-tabs">
            <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
              Просмотр
            </button>
            {isResponsible && !isTrash ? (
              <button
                className={tab === "requisites" ? "active" : ""}
                onClick={() => setTab("requisites")}
              >
                Реквизиты
              </button>
            ) : null}
            {isResponsible && !isTrash && document.status === "published" ? (
              <button className={tab === "version" ? "active" : ""} onClick={() => setTab("version")}>
                Новая версия
              </button>
            ) : null}
          </div>

          {tab === "preview" ? (
            <>
            <aside className="doc-preview-side">
              <div className="doc-side-block">
                <div className="doc-side-meta-line">
                  <span>
                    Автор <strong>{document.authorName}</strong>
                  </span>
                  <span>
                    Обновлено <strong>{formatDate(document.updatedAt)}</strong>
                  </span>
                </div>
                {document.description ? (
                  <div className="doc-side-row doc-side-description">
                    <span>Описание</span>
                    <strong>{document.description}</strong>
                  </div>
                ) : null}
              </div>

              <div
                className={[
                  "doc-requisites-grid",
                  previewOpen.versions ? "is-docs-open" : "",
                  previewOpen.ack ? "is-access-open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <section
                  className={[
                    "doc-collapse",
                    "doc-collapse-docs",
                    previewOpen.versions ? "is-open" : "",
                    previewVersionsExpanded ? "has-many-users" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="doc-collapse-toggle"
                    aria-expanded={previewOpen.versions}
                    onClick={() =>
                      setPreviewOpen((current) => ({
                        ...current,
                        versions: !current.versions,
                      }))
                    }
                  >
                    <span className={`chevron${previewOpen.versions ? " open" : ""}`} />
                    Версии
                  </button>
                  {previewOpen.versions ? (
                    <div className="doc-collapse-body">
                      {(document.versions || []).length === 0 ? (
                        <button
                          type="button"
                          className="version-chip active"
                          onClick={() => setPreviewVersionNo(0)}
                        >
                          Черновик
                        </button>
                      ) : (
                        (document.versions || []).map((version) => (
                          <button
                            key={version.versionNo}
                            type="button"
                            className={
                              previewVersionNo === version.versionNo
                                ? "version-chip active"
                                : "version-chip"
                            }
                            onClick={() => setPreviewVersionNo(version.versionNo)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              if (canManageVersions) {
                                openVersionMenu(event, version);
                              }
                            }}
                          >
                            <span>{versionLabel(version.versionNo, document.activeVersionNo)}</span>
                            {version.changeReason ? <small>{version.changeReason}</small> : null}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </section>

                <section
                  className={[
                    "doc-collapse",
                    "doc-collapse-access",
                    previewOpen.ack ? "is-open" : "",
                    previewAckExpanded ? "has-many-users" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="doc-collapse-toggle"
                    aria-expanded={previewOpen.ack}
                    onClick={() =>
                      setPreviewOpen((current) => ({
                        ...current,
                        ack: !current.ack,
                      }))
                    }
                  >
                    <span className={`chevron${previewOpen.ack ? " open" : ""}`} />
                    Ознакомление
                  </button>
                  {previewOpen.ack ? (
                    <div className="doc-collapse-body">
                      <div className="ack-progress">
                        <div className="ack-progress-bar" style={{ width: `${ackPercent}%` }} />
                      </div>
                      <div className="ack-progress-label">
                        {ackDone} из {ackTotal}
                      </div>
                      <div className="access-summary-list preview-ack-list">
                        {(document.assignedUsers || []).length > 0 ? (
                          (document.assignedUsers || []).map((user) => (
                            <div className="ack-user" key={user.id}>
                              <span>{user.fullName}</span>
                              {user.isAcknowledged ? <span className="ack-check">✓</span> : null}
                            </div>
                          ))
                        ) : (
                          <div className="muted">Никто не назначен</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>

              {canCompare ? (
                <div className="doc-compare">
                  <label className="doc-compare-toggle">
                    <input
                      type="checkbox"
                      checked={compareEnabled}
                      onChange={(event) => setCompareEnabled(event.target.checked)}
                    />
                    Показать изменения
                  </label>
                  {compareEnabled ? (
                    <label className="form-field">
                      Сравнить с
                      <select
                        className="field-select"
                        value={compareWithVersionNo || ""}
                        onChange={(event) =>
                          setCompareWithVersionNo(Number(event.target.value) || null)
                        }
                      >
                        {compareVersionOptions.map((version) => (
                          <option key={version.versionNo} value={version.versionNo}>
                            {versionLabel(version.versionNo, document.activeVersionNo)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="doc-side-block doc-side-actions">
                {canZoom && !filePreview.loading && previewFile.url ? (
                  <div className="preview-zoom">
                    <button
                      type="button"
                      onClick={() => adjustPreviewScale(-0.25)}
                      aria-label="Уменьшить"
                    >
                      −
                    </button>
                    <span>{Math.round(previewScale * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => adjustPreviewScale(0.25)}
                      aria-label="Увеличить"
                    >
                      +
                    </button>
                  </div>
                ) : null}

                <div className="doc-actions">
                  {previewFile.url ? (
                    <button className="btn cancel" type="button" onClick={toggleFullscreen}>
                      {isFullscreen ? "Свернуть" : "На весь экран"}
                    </button>
                  ) : null}
                  {previewFile.url ? (
                    <a
                      className="btn cancel"
                      href={previewFile.url}
                      download={previewFile.name || true}
                    >
                      Скачать файл
                    </a>
                  ) : null}
                  {isTrash && isResponsible ? (
                    <>
                      <button
                        className="btn primary"
                        type="button"
                        disabled={loading}
                        onClick={() => onRestore(document.id)}
                      >
                        Восстановить
                      </button>
                      <button
                        className="btn danger-text"
                        type="button"
                        disabled={loading}
                        onClick={() => onPermanentDelete(document.id)}
                      >
                        Удалить безвозвратно
                      </button>
                    </>
                  ) : null}
                  {!isTrash && isResponsible && document.status === "draft" ? (
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => onPublish(document.id)}
                    >
                      Опубликовать
                    </button>
                  ) : null}
                  {!isTrash && isResponsible && document.status === "archived" ? (
                    <button
                      className="btn primary"
                      type="button"
                      disabled={loading}
                      onClick={() => onUnarchive(document.id)}
                    >
                      Вернуть из архива
                    </button>
                  ) : null}
                  {!isTrash && !isResponsible && document.isAssigned && !document.isAcknowledged ? (
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => onAcknowledge(document.id, document.activeVersionNo)}
                    >
                      Ознакомлен
                    </button>
                  ) : null}
                </div>
              </div>
            </aside>
            </>
          ) : null}

          {tab === "requisites" && isResponsible && !isTrash ? (
            <form className="doc-form" onSubmit={handleSave}>
              <div
                className={[
                  "form-grid",
                  "doc-requisites-grid",
                  requisitesOpen.documents ? "is-docs-open" : "",
                  requisitesOpen.access ? "is-access-open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <section
                  className={`doc-collapse doc-collapse-docs${requisitesOpen.documents ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="doc-collapse-toggle"
                    aria-expanded={requisitesOpen.documents}
                    onClick={() =>
                      setRequisitesOpen((current) => ({
                        ...current,
                        documents: !current.documents,
                      }))
                    }
                  >
                    <span className={`chevron${requisitesOpen.documents ? " open" : ""}`} />
                    Документы
                  </button>
                  {requisitesOpen.documents ? (
                    <div className="doc-collapse-body">
                      <label className="form-field">
                        Тип документа
                        <select
                          className="field-select"
                          value={editForm.type}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              type: event.target.value,
                              folderId: "",
                            }))
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
                        Номер
                        <input
                          className="field-input"
                          value={editForm.number}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, number: event.target.value }))
                          }
                        />
                      </label>

                      <label className="form-field">
                        Папка
                        <select
                          className="field-select"
                          value={editForm.folderId || ""}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              folderId: event.target.value,
                            }))
                          }
                        >
                          <option value="">Выберите папку</option>
                          {folderOptions.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="form-field">
                        Название документа
                        <input
                          className="field-input"
                          value={editForm.title}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, title: event.target.value }))
                          }
                          required
                        />
                      </label>

                      <label className="form-field">
                        Описание
                        <textarea
                          rows="3"
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="form-field">
                        Дата создания документа
                        <input
                          className="field-input"
                          type="date"
                          value={editForm.documentDate}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              documentDate: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                    </div>
                  ) : null}
                </section>

                <section
                  className={[
                    "doc-collapse",
                    "doc-collapse-access",
                    requisitesOpen.access ? "is-open" : "",
                    accessSummaryExpanded ? "has-many-users" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="doc-collapse-toggle"
                    aria-expanded={requisitesOpen.access}
                    onClick={() =>
                      setRequisitesOpen((current) => ({
                        ...current,
                        access: !current.access,
                      }))
                    }
                  >
                    <span className={`chevron${requisitesOpen.access ? " open" : ""}`} />
                    Уведомления
                  </button>
                  {requisitesOpen.access ? (
                    <div className="doc-collapse-body">
                      <div className="form-field access-summary-field">
                        <div className="access-summary-head">
                          <span>Кому отправить уведомление</span>
                          <button
                            className="btn cancel access-edit-btn"
                            type="button"
                            onClick={() => setAccessModalOpen(true)}
                          >
                            Редактировать
                          </button>
                        </div>
                        <div className="access-summary-list">
                          {selectedAccessUsers.length > 0 ? (
                            selectedAccessUsers.map((user) => (
                              <div className="access-summary-item" key={user.id}>
                                <span>{user.fullName}</span>
                              </div>
                            ))
                          ) : (
                            <div className="muted">Никто не выбран</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="doc-form-actions">
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? "Сохранение..." : "Сохранить"}
                </button>
                <button
                  className="btn cancel"
                  type="button"
                  onClick={() => {
                    setEditForm({
                      title: document.title || "",
                      type: document.type,
                      number: document.number || "",
                      documentDate: toIsoDateValue(document.documentDate),
                      description: document.description || "",
                      assignedUsers: (document.assignedUsers || []).map((user) => user.id),
                      folderId: document.folderId == null ? "" : String(document.folderId),
                    });
                    setTab("preview");
                  }}
                >
                  Отмена
                </button>
                {document.status === "published" ? (
                  <button className="btn cancel" type="button" onClick={() => onArchive(document.id)}>
                    В архив
                  </button>
                ) : null}
                {document.status === "archived" ? (
                  <button
                    className="btn cancel"
                    type="button"
                    disabled={loading}
                    onClick={() => onUnarchive(document.id)}
                  >
                    Вернуть из архива
                  </button>
                ) : null}
                <button className="btn danger-text" type="button" onClick={() => onDelete(document.id)}>
                  Удалить документ
                </button>
              </div>
            </form>
          ) : null}

          {tab === "version" && isResponsible && !isTrash && document.status === "published" ? (
            <form className="doc-form" onSubmit={handleNewVersion}>
              <div className="form-grid">
                <label className="form-field">
                  Причина новой версии
                  <textarea
                    rows="3"
                    placeholder="Что изменилось в новой версии"
                    value={versionForm.changeReason}
                    onChange={(event) =>
                      setVersionForm((current) => ({ ...current, changeReason: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form-field">
                  Файл новой версии
                  <input
                    className="file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(event) =>
                      setVersionForm((current) => ({
                        ...current,
                        versionFile: event.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </label>
              </div>
              <div className="doc-form-actions">
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? "Сохранение..." : "Создать версию"}
                </button>
                <button className="btn cancel" type="button" onClick={() => setTab("preview")}>
                  Отмена
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="doc-preview-main">
            <div
              className={`preview-stage preview-stage-${stageKind}${isFullscreen ? " is-fullscreen" : ""}${comparing ? " is-comparing" : ""}`}
              ref={previewStageRef}
              style={{ "--preview-scale": previewScale }}
            >
              {filePreview.loading || (compareEnabled && comparePreview.loading) ? (
                <div className="preview-empty preview-loading">
                  <span className="preview-spinner" />
                  {compareEnabled && comparePreview.loading
                    ? "Сравнение версий..."
                    : "Загрузка файла..."}
                </div>
              ) : filePreview.error ? (
                <div className="preview-empty">{filePreview.error}</div>
              ) : compareEnabled && comparePreview.error ? (
                <div className="preview-empty">{comparePreview.error}</div>
              ) : comparing && lineDiff ? (
                isSpreadsheetFile(previewFile.name, previewFile.mimeType) && sheetNames.length ? (
                  <div className="preview-sheet-list is-diff">
                    <div className="preview-sheet-tabs">
                      {sheetNames.map((sheetName) => {
                        const inCurrent = filePreview.sheetNames.includes(sheetName);
                        const inBase = comparePreview.sheetNames.includes(sheetName);
                        const sheetClass = [
                          sheetName === activeSheetName
                            ? "preview-sheet-tab active"
                            : "preview-sheet-tab",
                          comparing && inCurrent && !inBase ? "diff-sheet-add" : "",
                          comparing && !inCurrent && inBase ? "diff-sheet-del" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <button
                            key={sheetName}
                            type="button"
                            className={sheetClass}
                            onClick={() => setActiveSheetName(sheetName)}
                          >
                            {sheetName}
                          </button>
                        );
                      })}
                    </div>
                    <DiffViewer
                      rows={lineDiff.rows}
                      added={lineDiff.added}
                      removed={lineDiff.removed}
                      leftLabel={versionLabel(compareWithVersionNo, document.activeVersionNo)}
                      rightLabel={previewFile.label}
                      filename={activeSheetName || previewFile.name}
                    />
                  </div>
                ) : (
                    <DiffViewer
                      rows={lineDiff.rows}
                      added={lineDiff.added}
                      removed={lineDiff.removed}
                      leftLabel={versionLabel(compareWithVersionNo, document.activeVersionNo)}
                      rightLabel={previewFile.label}
                      filename={previewFile.name}
                    />
                )
              ) : comparing &&
                previewFile.url &&
                isImageFile(previewFile.name, previewFile.mimeType) ? (
                <div className="preview-compare-split">
                  <figure>
                    <figcaption>
                      {versionLabel(compareWithVersionNo, document.activeVersionNo)}
                    </figcaption>
                    {comparePreview.url ? (
                      <img src={comparePreview.url} alt={comparePreview.name} />
                    ) : (
                      <div className="preview-empty">Нет файла базовой версии</div>
                    )}
                  </figure>
                  <figure>
                    <figcaption>{previewFile.label}</figcaption>
                    <img src={previewFile.url} alt={previewFile.name} />
                  </figure>
                </div>
              ) : comparing &&
                previewFile.url &&
                isPdfFile(previewFile.name, previewFile.mimeType) ? (
                <div className="preview-compare-split">
                  <figure>
                    <figcaption>
                      {versionLabel(compareWithVersionNo, document.activeVersionNo)}
                    </figcaption>
                    {comparePreview.url ? (
                      <iframe
                        title={comparePreview.name}
                        src={pdfViewerSrc(comparePreview.url)}
                      />
                    ) : (
                      <div className="preview-empty">Нет файла базовой версии</div>
                    )}
                  </figure>
                  <figure>
                    <figcaption>{previewFile.label}</figcaption>
                    <iframe title={previewFile.name} src={pdfViewerSrc(previewFile.url)} />
                  </figure>
                </div>
              ) : previewFile.url && isImageFile(previewFile.name, previewFile.mimeType) ? (
                <img src={previewFile.url} alt={previewFile.name} />
              ) : previewFile.url && isPdfFile(previewFile.name, previewFile.mimeType) ? (
                <iframe title={previewFile.name} src={pdfViewerSrc(previewFile.url)} />
              ) : previewFile.url && isWordFile(previewFile.name, previewFile.mimeType) ? (
                filePreview.docHtml ? (
                  <div className="preview-docx">
                    <div
                      className="preview-docx-page"
                      dangerouslySetInnerHTML={{ __html: filePreview.docHtml }}
                    />
                  </div>
                ) : (
                  <div className="preview-empty">Не удалось подготовить предпросмотр Word.</div>
                )
              ) : previewFile.url && isSpreadsheetFile(previewFile.name, previewFile.mimeType) ? (
                sheetNames.length ? (
                  <div className="preview-sheet-list">
                    <div className="preview-sheet-tabs">
                      {sheetNames.map((sheetName) => (
                        <button
                          key={sheetName}
                          type="button"
                          className={
                            sheetName === activeSheetName
                              ? "preview-sheet-tab active"
                              : "preview-sheet-tab"
                          }
                          onClick={() => setActiveSheetName(sheetName)}
                        >
                          {sheetName}
                        </button>
                      ))}
                    </div>
                    <section className="preview-sheet">
                      <div
                        className="preview-sheet-frame"
                        dangerouslySetInnerHTML={{ __html: activeSheetHtml }}
                      />
                    </section>
                  </div>
                ) : filePreview.docHtml ? (
                  <div className="preview-sheet-list">
                    <section className="preview-sheet">
                      <div
                        className="preview-sheet-frame"
                        dangerouslySetInnerHTML={{ __html: filePreview.docHtml }}
                      />
                    </section>
                  </div>
                ) : (
                  <div className="preview-empty">Не удалось подготовить предпросмотр Excel.</div>
                )
              ) : previewFile.url && isLegacyWordFile(previewFile.name, previewFile.mimeType) ? (
                <div className="preview-empty">
                  Предпросмотр старого формата Word `.doc` не поддерживается. Откройте или скачайте
                  файл.
                </div>
              ) : previewFile.url ? (
                <div className="preview-empty">Предпросмотр для этого типа файла недоступен.</div>
              ) : (
                <div className="preview-empty">Файл еще не загружен.</div>
              )}
            </div>
        </div>
      </div>

      {versionMenu && canManageVersions
        ? createPortal(
            <div
              ref={versionMenuRef}
              className="nav-context-menu"
              style={{ left: versionMenu.x, top: versionMenu.y }}
              role="menu"
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={!canDeleteSelectedVersion}
                title={
                  canDeleteSelectedVersion
                    ? undefined
                    : "Нельзя удалить единственную версию документа"
                }
                onClick={() => {
                  if (!canDeleteSelectedVersion) {
                    return;
                  }
                  onDeleteVersion(document.id, versionMenu.versionNo);
                  setVersionMenu(null);
                }}
              >
                Удалить версию
              </button>
            </div>,
            window.document.body
          )
        : null}

      {accessModalOpen
        ? createPortal(
            <AccessUsersModal
              employeeUsers={employeeUsers}
              selectedIds={editForm.assignedUsers}
              onClose={() => setAccessModalOpen(false)}
              onConfirm={(nextIds) => {
                setEditForm((current) => ({ ...current, assignedUsers: nextIds }));
                setAccessModalOpen(false);
              }}
            />,
            window.document.body
          )
        : null}
    </section>
  );
}
