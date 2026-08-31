import { useEffect, useMemo, useRef, useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  AutoImage,
  AutoLink,
  BlockQuote,
  Bold,
  DecoupledEditor,
  Essentials,
  Font,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  GeneralHtmlSupport,
  Heading,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  Indent,
  IndentBlock,
  Italic,
  Link,
  List,
  Paragraph,
  RemoveFormat,
  SelectAll,
  SourceEditing,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  Underline,
  WordCount,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  fetchEmailTemplates,
  updateEmailTemplate,
} from "../api/client";
import {
  EMAIL_TEMPLATE_IMPORT_ACCEPT,
  importEmailTemplateFromFile,
} from "../utils/emailTemplateImport";
import LetterTemplate from "./LetterTemplate";
import {
  buildLetterPrintDocument,
  isBakorLetterLayout,
  LAYOUT_KIND_BAKOR,
} from "../utils/bakorLetterTemplate";

const MENU_MENUS = [
  { id: "file", label: "Файл" },
  { id: "edit", label: "Редактировать" },
  { id: "view", label: "Вид" },
  { id: "insert", label: "Вставка" },
  { id: "format", label: "Формат" },
];

function getMenuItems(menuId, { canSave, importing, saving, commandEnabled }) {
  const disabled = (command) => command && !commandEnabled(command);

  switch (menuId) {
    case "file":
      return [
        {
          id: "import",
          label: "Загрузить из файла…",
          action: "import",
          disabled: importing || saving,
        },
        {
          id: "save",
          label: "Сохранить шаблон",
          action: "save",
          shortcut: "Ctrl+S",
          disabled: !canSave || saving || importing,
        },
        { type: "separator", id: "sep-print" },
        { id: "print", label: "Печать…", action: "print" },
      ];
    case "edit":
      return [
        {
          id: "undo",
          label: "Отменить",
          action: "undo",
          shortcut: "Ctrl+Z",
          disabled: disabled("undo"),
        },
        {
          id: "redo",
          label: "Повторить",
          action: "redo",
          shortcut: "Ctrl+Y",
          disabled: disabled("redo"),
        },
        { type: "separator", id: "sep-clipboard" },
        { id: "cut", label: "Вырезать", action: "cut", shortcut: "Ctrl+X" },
        { id: "copy", label: "Копировать", action: "copy", shortcut: "Ctrl+C" },
        { id: "paste", label: "Вставить", action: "paste", shortcut: "Ctrl+V" },
        { type: "separator", id: "sep-select" },
        {
          id: "selectAll",
          label: "Выделить всё",
          action: "selectAll",
          shortcut: "Ctrl+A",
          disabled: disabled("selectAll"),
        },
      ];
    case "view":
      return [
        {
          id: "sourceEditing",
          label: "Редактирование HTML",
          action: "sourceEditing",
          disabled: disabled("sourceEditing"),
        },
      ];
    case "insert":
      return [
        {
          id: "link",
          label: "Ссылка…",
          action: "link",
          shortcut: "Ctrl+K",
          disabled: disabled("link"),
        },
        {
          id: "insertImage",
          label: "Изображение…",
          action: "insertImage",
          disabled: disabled("insertImage"),
        },
        {
          id: "insertTable",
          label: "Таблица",
          action: "insertTable",
          disabled: disabled("insertTable"),
        },
        { type: "separator", id: "sep-insert" },
        {
          id: "horizontalLine",
          label: "Горизонтальная линия",
          action: "horizontalLine",
          disabled: disabled("horizontalLine"),
        },
        {
          id: "blockQuote",
          label: "Цитата",
          action: "blockQuote",
          disabled: disabled("blockQuote"),
        },
      ];
    case "format":
      return [
        { id: "paragraph", label: "Обычный текст", action: "heading", value: "paragraph" },
        { id: "heading1", label: "Заголовок 1", action: "heading", value: "heading1" },
        { id: "heading2", label: "Заголовок 2", action: "heading", value: "heading2" },
        { id: "heading3", label: "Заголовок 3", action: "heading", value: "heading3" },
        { type: "separator", id: "sep-style" },
        {
          id: "bold",
          label: "Жирный",
          action: "bold",
          shortcut: "Ctrl+B",
          disabled: disabled("bold"),
        },
        {
          id: "italic",
          label: "Курсив",
          action: "italic",
          shortcut: "Ctrl+I",
          disabled: disabled("italic"),
        },
        {
          id: "underline",
          label: "Подчёркнутый",
          action: "underline",
          shortcut: "Ctrl+U",
          disabled: disabled("underline"),
        },
        {
          id: "strikethrough",
          label: "Зачёркнутый",
          action: "strikethrough",
          disabled: disabled("strikethrough"),
        },
        {
          id: "removeFormat",
          label: "Убрать форматирование",
          action: "removeFormat",
          disabled: disabled("removeFormat"),
        },
        { type: "separator", id: "sep-align" },
        { id: "alignLeft", label: "По левому краю", action: "alignment", value: "left" },
        { id: "alignCenter", label: "По центру", action: "alignment", value: "center" },
        { id: "alignRight", label: "По правому краю", action: "alignment", value: "right" },
        { id: "alignJustify", label: "По ширине", action: "alignment", value: "justify" },
      ];
    default:
      return [];
  }
}

function EmailEditorMenubar({
  openMenu,
  onToggleMenu,
  onCloseMenu,
  onMenuAction,
  canSave,
  importing,
  saving,
  commandEnabled,
}) {
  const menubarRef = useRef(null);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menubarRef.current && !menubarRef.current.contains(event.target)) {
        onCloseMenu();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCloseMenu();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu, onCloseMenu]);

  return (
    <div ref={menubarRef} className="email-doc-editor__menubar" role="menubar" aria-label="Меню редактора">
      {MENU_MENUS.map((menu) => {
        const items = getMenuItems(menu.id, { canSave, importing, saving, commandEnabled });

        return (
          <div key={menu.id} className="email-doc-editor__menu">
            <button
              type="button"
              className={`email-doc-editor__menu-trigger${openMenu === menu.id ? " is-open" : ""}`}
              onClick={() => onToggleMenu(menu.id)}
              aria-expanded={openMenu === menu.id}
              aria-haspopup="menu"
            >
              {menu.label}
            </button>

            {openMenu === menu.id ? (
              <div className="email-doc-editor__menu-dropdown" role="menu">
                {items.map((item) =>
                  item.type === "separator" ? (
                    <div key={`${menu.id}-${item.id}`} className="email-doc-editor__menu-separator" />
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className="email-doc-editor__menu-dropdown-item"
                      disabled={item.disabled}
                      onClick={() => onMenuAction(item.action, item.value)}
                    >
                      <span>{item.label}</span>
                      {item.shortcut ? (
                        <span className="email-doc-editor__menu-shortcut">{item.shortcut}</span>
                      ) : null}
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const editorPlugins = [
  Essentials,
  GeneralHtmlSupport,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Font,
  FontFamily,
  FontSize,
  FontColor,
  FontBackgroundColor,
  RemoveFormat,
  Link,
  AutoLink,
  List,
  Alignment,
  Indent,
  IndentBlock,
  BlockQuote,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  AutoImage,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  SelectAll,
  SourceEditing,
  WordCount,
];

function createEditorConfig(onWordCountUpdate) {
  return {
  licenseKey: "GPL",
  plugins: editorPlugins,
  toolbar: {
    items: [
      "undo",
      "redo",
      "|",
      "heading",
      "|",
      "fontFamily",
      "fontSize",
      "|",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "|",
      "fontColor",
      "fontBackgroundColor",
      "|",
      "superscript",
      "subscript",
      "removeFormat",
      "|",
      "alignment",
      "|",
      "bulletedList",
      "numberedList",
      "outdent",
      "indent",
      "|",
      "link",
      "insertImage",
      "insertTable",
      "|",
      "blockQuote",
      "horizontalLine",
      "|",
      "sourceEditing",
    ],
    shouldNotGroupWhenFull: true,
  },
  heading: {
    options: [
      { model: "paragraph", title: "Обычный текст", class: "ck-heading_paragraph" },
      { model: "heading1", view: "h1", title: "Заголовок 1", class: "ck-heading_heading1" },
      { model: "heading2", view: "h2", title: "Заголовок 2", class: "ck-heading_heading2" },
      { model: "heading3", view: "h3", title: "Заголовок 3", class: "ck-heading_heading3" },
    ],
  },
  fontFamily: {
    options: [
      "default",
      "Arial, Helvetica, sans-serif",
      "Georgia, serif",
      "Times New Roman, Times, serif",
      "Courier New, Courier, monospace",
      "Verdana, Geneva, sans-serif",
    ],
  },
  fontSize: {
    options: [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32],
    supportAllValues: true,
  },
  wordCount: {
    onUpdate: onWordCountUpdate,
  },
  link: {
    addTargetToExternalLinks: true,
    defaultProtocol: "https://",
  },
  image: {
    toolbar: [
      "imageStyle:inline",
      "imageStyle:block",
      "imageStyle:side",
      "|",
      "toggleImageCaption",
      "imageTextAlternative",
      "|",
      "resizeImage",
    ],
  },
  table: {
    contentToolbar: [
      "tableColumn",
      "tableRow",
      "mergeTableCells",
      "tableProperties",
      "tableCellProperties",
    ],
  },
  htmlSupport: {
    allow: [
      { name: "div", classes: true, attributes: ["class", "aria-hidden", "contenteditable"] },
      { name: "img", classes: true, attributes: ["src", "alt", "class", "draggable"] },
      { name: "p", classes: true },
      { name: "a", classes: true, attributes: ["href", "target", "rel"] },
      { name: "ul", classes: true },
      { name: "li", classes: true },
      { name: "strong" },
      { name: "br" },
    ],
  },
};
}

function emptyDraft() {
  return {
    name: "",
    subject: "",
    triggerKind: "publish",
    layoutKind: "default",
    isDefault: false,
    htmlBody: "",
  };
}

export default function EmailTemplatesEditor({
  listTitle,
  folderId,
  token,
  onNotice,
  onError,
  onBack,
  autoCreate = false,
}) {
  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const [wordStats, setWordStats] = useState({ words: 0, characters: 0 });
  const [openMenu, setOpenMenu] = useState(null);
  const importInputRef = useRef(null);
  const toolbarRef = useRef(null);
  const editorRef = useRef(null);
  const autoCreateStartedRef = useRef(false);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) || null,
    [activeTemplateId, templates]
  );

  const canSave = Boolean(
    activeTemplate &&
      !saving &&
      !importing &&
      draft.name.trim() &&
      draft.subject.trim() &&
      draft.htmlBody.trim()
  );

  useEffect(() => {
    setEditorReady(true);
  }, []);

  useEffect(() => {
    return () => {
      editorRef.current = null;
      if (toolbarRef.current) {
        toolbarRef.current.replaceChildren();
      }
    };
  }, [activeTemplateId, editorVersion]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setLoading(true);
      onError("");

      try {
        const rows = await fetchEmailTemplates(token, folderId ?? null);
        if (cancelled) {
          return;
        }

        const nextTemplates = Array.isArray(rows) ? rows : [];
        setTemplates(nextTemplates);
        setActiveTemplateId((current) => {
          if (current && nextTemplates.some((template) => template.id === current)) {
            return current;
          }
          return nextTemplates[0]?.id ?? null;
        });
      } catch (requestError) {
        if (!cancelled) {
          onError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [folderId, token]);

  useEffect(() => {
    autoCreateStartedRef.current = false;
  }, [folderId, autoCreate]);

  useEffect(() => {
    if (!autoCreate || loading || creating || autoCreateStartedRef.current) {
      return;
    }

    autoCreateStartedRef.current = true;
    handleCreateTemplate();
  }, [autoCreate, loading, creating, templates.length]);

  useEffect(() => {
    if (!activeTemplate) {
      setDraft(emptyDraft());
      return;
    }

    setDraft({
      name: activeTemplate.name || "",
      subject: activeTemplate.subject || "",
      triggerKind: activeTemplate.triggerKind || "publish",
      layoutKind: activeTemplate.layoutKind || "default",
      isDefault: Boolean(activeTemplate.isDefault),
      htmlBody: activeTemplate.htmlBody || "",
    });
    setEditorVersion((current) => current + 1);
    setWordStats({ words: 0, characters: 0 });
  }, [activeTemplate]);

  function handleEditorReady(editor) {
    editorRef.current = editor;

    if (toolbarRef.current) {
      toolbarRef.current.replaceChildren();
      toolbarRef.current.appendChild(editor.ui.view.toolbar.element);
    }
  }

  function isCommandEnabled(commandName) {
    return editorRef.current?.commands.get(commandName)?.isEnabled ?? false;
  }

  function focusEditor() {
    editorRef.current?.editing.view.focus();
  }

  function runEditorCommand(commandName, options) {
    const editor = editorRef.current;
    if (!editor) {
      return false;
    }

    const command = editor.commands.get(commandName);
    if (!command?.isEnabled) {
      return false;
    }

    if (options !== undefined) {
      editor.execute(commandName, options);
    } else {
      editor.execute(commandName);
    }

    editor.editing.view.focus();
    return true;
  }

  function runClipboardCommand(operation) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const editable = editor.ui.getEditableElement();
    if (!editable) {
      return;
    }

    editable.focus();

    try {
      document.execCommand(operation);
    } catch {
      if (operation === "paste") {
        navigator.clipboard
          .readText()
          .then((text) => {
            if (!text) {
              return;
            }

            editor.model.change((writer) => {
              editor.model.insertContent(
                writer.createText(text),
                editor.model.document.selection
              );
            });
          })
          .catch(() => {
            onError("Не удалось вставить из буфера обмена.");
          });
      }
    }

    editor.editing.view.focus();
  }

  function printEditorContent() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      onError("Браузер заблокировал окно печати.");
      return;
    }

    const html = editor.getData();
    const documentHtml = isBakorLetterLayout(draft.layoutKind)
      ? buildLetterPrintDocument(html)
      : `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Печать шаблона</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.6;
        padding: 40px;
        color: #1f2933;
      }
      img { max-width: 100%; height: auto; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #d5dde6; padding: 8px 10px; }
    </style>
  </head>
  <body>${html}</body>
</html>`;

    printWindow.document.write(documentHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function handleMenuAction(action, value) {
    setOpenMenu(null);

    switch (action) {
      case "import":
        importInputRef.current?.click();
        break;
      case "save":
        handleSave();
        break;
      case "print":
        printEditorContent();
        break;
      case "undo":
      case "redo":
      case "selectAll":
      case "sourceEditing":
      case "link":
      case "insertImage":
      case "horizontalLine":
      case "blockQuote":
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough":
      case "removeFormat":
        runEditorCommand(action);
        break;
      case "insertTable":
        runEditorCommand("insertTable", { rows: 3, columns: 3, headingRows: 0 });
        break;
      case "heading":
        runEditorCommand("heading", { value });
        break;
      case "alignment":
        runEditorCommand("alignment", { value });
        break;
      case "cut":
      case "copy":
      case "paste":
        runClipboardCommand(action);
        break;
      default:
        focusEditor();
        break;
    }
  }

  useEffect(() => {
    function handleSaveShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();
      if (canSave) {
        handleSave();
      }
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [canSave, activeTemplate, draft, folderId, token, saving, importing]);

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setImporting(true);
    onError("");

    try {
      const imported = await importEmailTemplateFromFile(file);
      setDraft((current) => ({
        ...current,
        htmlBody: imported.htmlBody,
      }));
      setEditorVersion((current) => current + 1);
      onNotice("Шаблон загружен из файла. Проверьте текст и сохраните изменения.");
    } catch (requestError) {
      onError(requestError.message || "Не удалось загрузить файл.");
    } finally {
      setImporting(false);
    }
  }

  async function handleCreateTemplate() {
    setCreating(true);
    onError("");

    try {
      const created = await createEmailTemplate(token, {
        folderId: folderId ?? null,
        triggerKind: "publish",
        name: "Новый шаблон",
        subject: "Документ: {{title}}",
        htmlBody: "<p>Здравствуйте, {{fullName}}!</p>",
        layoutKind: "default",
        isDefault: false,
      });
      setTemplates((current) => [...current, created]);
      setActiveTemplateId(created.id);
      onNotice("Шаблон создан.");
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!activeTemplate) {
      return;
    }

    if (!window.confirm(`Удалить шаблон «${activeTemplate.name}»?`)) {
      return;
    }

    setDeleting(true);
    onError("");

    try {
      await deleteEmailTemplate(token, activeTemplate.id);
      const nextTemplates = templates.filter((template) => template.id !== activeTemplate.id);
      setTemplates(nextTemplates);
      setActiveTemplateId(nextTemplates[0]?.id ?? null);
      onNotice("Шаблон удалён.");
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!activeTemplate) {
      return;
    }

    setSaving(true);
    onError("");

    try {
      const updated = await updateEmailTemplate(token, activeTemplate.id, {
        folderId: folderId ?? null,
        name: draft.name,
        htmlBody: draft.htmlBody,
        subject: draft.subject,
        triggerKind: draft.triggerKind,
        layoutKind: draft.layoutKind,
        isDefault: draft.isDefault,
      });
      setTemplates((current) =>
        current.map((template) => (template.id === updated.id ? updated : template))
      );
      onNotice("Шаблон письма сохранён.");
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="list-card email-templates-card">
      {onBack ? (
        <div className="letters-compose-header">
          <button type="button" className="btn cancel" onClick={onBack}>
            ← К списку писем
          </button>
          <h2 className="list-title">{listTitle}</h2>
        </div>
      ) : (
        <h2 className="list-title">{listTitle}</h2>
      )}
      <p className="helper">
        Выберите папку слева и шаблон ниже. Можно создавать несколько шаблонов в одной папке,
        загружать макет из PDF, DOCX или SVG, либо использовать готовый фирменный бланк Бакор.
      </p>

      {loading ? <div className="empty">Загрузка шаблонов...</div> : null}

      {!loading && templates.length === 0 ? (
        <div className="email-template-empty">
          <div className="empty">В этой папке пока нет шаблонов.</div>
          <button
            type="button"
            className="btn primary"
            onClick={handleCreateTemplate}
            disabled={creating}
          >
            {creating ? "Создание..." : "Создать шаблон"}
          </button>
        </div>
      ) : null}

      {!loading && templates.length > 0 ? (
        <>
          <div className="email-template-toolbar">
            <label className="form-field email-template-select-field">
              Шаблон
              <select
                className="field-input"
                value={activeTemplateId ?? ""}
                onChange={(event) => setActiveTemplateId(Number(event.target.value))}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="email-template-toolbar-actions">
              <button
                type="button"
                className="btn cancel"
                onClick={handleCreateTemplate}
                disabled={creating || saving || deleting}
              >
                {creating ? "Создание..." : "Новый шаблон"}
              </button>
              <button
                type="button"
                className="btn danger-text"
                onClick={handleDeleteTemplate}
                disabled={!activeTemplate || saving || deleting || creating}
              >
                {deleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>

          <div className="email-template-form">
            <label className="form-field">
              Название шаблона
              <input
                className="field-input"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="form-field">
              Тема письма
              <input
                className="field-input"
                value={draft.subject}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, subject: event.target.value }))
                }
                placeholder="Документ на ознакомление: {{title}}"
              />
            </label>

            <div className="email-template-meta-row">
              <label className="form-field email-template-default-field">
                <span>Макет страницы</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={isBakorLetterLayout(draft.layoutKind)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        layoutKind: event.target.checked ? LAYOUT_KIND_BAKOR : "default",
                      }))
                    }
                  />
                  Фирменный бланк Бакор (шапка и подвал)
                </label>
              </label>
            </div>

            <div className="form-field email-doc-field">
              <span>Текст письма</span>
              <div className="email-doc-editor">
                <EmailEditorMenubar
                  openMenu={openMenu}
                  onToggleMenu={(menuId) =>
                    setOpenMenu((current) => (current === menuId ? null : menuId))
                  }
                  onCloseMenu={() => setOpenMenu(null)}
                  onMenuAction={handleMenuAction}
                  canSave={canSave}
                  importing={importing}
                  saving={saving}
                  commandEnabled={isCommandEnabled}
                />

                <div ref={toolbarRef} className="email-doc-editor__toolbar" />

                <div className="email-doc-editor__workspace">
                  <div
                    className={`email-doc-editor__canvas${
                      isBakorLetterLayout(draft.layoutKind) ? " email-doc-editor__canvas--letter" : ""
                    }`}
                  >
                    {editorReady ? (
                      isBakorLetterLayout(draft.layoutKind) ? (
                        <LetterTemplate>
                          <CKEditor
                            key={`${activeTemplateId}-${editorVersion}`}
                            editor={DecoupledEditor}
                            config={createEditorConfig((stats) => {
                              setWordStats({
                                words: stats.words,
                                characters: stats.characters,
                              });
                            })}
                            data={draft.htmlBody}
                            onReady={handleEditorReady}
                            onChange={(_event, editor) => {
                              setDraft((current) => ({
                                ...current,
                                htmlBody: editor.getData(),
                              }));
                            }}
                            onError={(editorError) => {
                              onError(editorError.message || "Не удалось загрузить редактор.");
                            }}
                          />
                        </LetterTemplate>
                      ) : (
                        <CKEditor
                          key={`${activeTemplateId}-${editorVersion}`}
                          editor={DecoupledEditor}
                          config={createEditorConfig((stats) => {
                            setWordStats({
                              words: stats.words,
                              characters: stats.characters,
                            });
                          })}
                          data={draft.htmlBody}
                          onReady={handleEditorReady}
                          onChange={(_event, editor) => {
                            setDraft((current) => ({
                              ...current,
                              htmlBody: editor.getData(),
                            }));
                          }}
                          onError={(editorError) => {
                            onError(editorError.message || "Не удалось загрузить редактор.");
                          }}
                        />
                      )
                    ) : (
                      <div className="empty">Загрузка редактора...</div>
                    )}
                  </div>
                </div>

                <div className="email-doc-editor__statusbar">
                  <span>Количество слов: {wordStats.words}</span>
                  <span>Количество символов: {wordStats.characters}</span>
                </div>
              </div>
            </div>

            <div className="email-template-actions">
              <input
                ref={importInputRef}
                type="file"
                accept={EMAIL_TEMPLATE_IMPORT_ACCEPT}
                className="visually-hidden"
                onChange={handleImportFile}
              />
              <button
                type="button"
                className="btn cancel"
                onClick={() => importInputRef.current?.click()}
                disabled={importing || saving}
              >
                {importing ? "Загрузка файла..." : "Загрузить из PDF/DOCX/SVG"}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleSave}
                disabled={!canSave}
              >
                {saving ? "Сохранение..." : "Сохранить шаблон"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
