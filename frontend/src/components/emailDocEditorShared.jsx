import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alignment,
  AutoImage,
  AutoLink,
  BlockQuote,
  Bold,
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
import { InsertLetterPageBreak } from "../utils/insertLetterPageBreakPlugin";

const MENU_MENUS = [
  { id: "file", label: "Файл" },
  { id: "edit", label: "Редактировать" },
  { id: "view", label: "Вид" },
  { id: "insert", label: "Вставка" },
  { id: "format", label: "Формат" },
];

function getMenuItems(menuId, { canSave, importing, saving, commandEnabled, variant }) {
  const disabled = (command) => command && !commandEnabled(command);

  switch (menuId) {
    case "file":
      if (variant === "letter") {
        return [
          {
            id: "save",
            label: "Сохранить черновик",
            action: "save",
            shortcut: "Ctrl+S",
            disabled: !canSave || saving,
          },
          { type: "separator", id: "sep-print" },
          { id: "print", label: "Печать…", action: "print" },
        ];
      }

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
        { type: "separator", id: "sep-letter" },
        {
          id: "insertOutgoingRequisites",
          label: "Исходящий номер",
          action: "insertOutgoingRequisites",
          disabled: importing || saving,
        },
        ...(variant === "letter" ?
          [
            {
              id: "insertPageBreak",
              label: "Разрыв страницы",
              action: "insertPageBreak",
              shortcut: "Ctrl+Enter",
              disabled: importing || saving,
            },
          ]
        : []),
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

export function EmailEditorMenubar({
  openMenu,
  onToggleMenu,
  onCloseMenu,
  onMenuAction,
  canSave,
  importing,
  saving,
  commandEnabled,
  variant = "template",
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
        const items = getMenuItems(menu.id, {
          canSave,
          importing,
          saving,
          commandEnabled,
          variant,
        });

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

export function createEditorConfig(onWordCountUpdate, { letterPageBreak = false } = {}) {
  const plugins = letterPageBreak ? [...editorPlugins, InsertLetterPageBreak] : editorPlugins;
  const toolbarItems = [
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
  ];

  if (letterPageBreak) {
    toolbarItems.push("|", "insertLetterPageBreak");
  }

  return {
    licenseKey: "GPL",
    plugins,
    toolbar: {
      items: toolbarItems,
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
        { name: "div", classes: true, attributes: ["class", "aria-hidden", "contenteditable", "data-auto-page-break", "data-manual-page-break", "title"] },
        { name: "img", classes: true, attributes: ["src", "alt", "class", "draggable"] },
        { name: "p", classes: true },
        { name: "span", classes: true },
        { name: "a", classes: true, attributes: ["href", "target", "rel"] },
        { name: "ul", classes: true },
        { name: "li", classes: true },
        { name: "strong" },
        { name: "br" },
      ],
    },
  };
}

export function getEditorHtml(editorRef, fallbackHtml = "") {
  const editor = editorRef.current;
  if (!editor) {
    return fallbackHtml;
  }

  try {
    if (editor.state === "destroyed") {
      return fallbackHtml;
    }

    return editor.getData();
  } catch {
    return fallbackHtml;
  }
}

export function mountEditorToolbar(editor, toolbarRef) {
  if (toolbarRef.current) {
    toolbarRef.current.replaceChildren();
    toolbarRef.current.appendChild(editor.ui.view.toolbar.element);
  }
}

export function useEmailDocEditorMount({ editorRef, toolbarRef, letterLayoutCleanupRef }) {
  const [editorMountKey, setEditorMountKey] = useState(0);
  const [editorVisible, setEditorVisible] = useState(true);

  const remountEditor = useCallback(() => {
    setEditorVisible(false);
  }, []);

  useEffect(() => {
    if (editorVisible) {
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      setEditorMountKey((current) => current + 1);
      setEditorVisible(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [editorVisible]);

  useEffect(() => {
    return () => {
      letterLayoutCleanupRef.current?.();
      letterLayoutCleanupRef.current = null;
      editorRef.current = null;
      toolbarRef.current?.replaceChildren();
    };
  }, [editorMountKey, editorRef, letterLayoutCleanupRef, toolbarRef]);

  return { editorMountKey, editorVisible, remountEditor };
}

export function isEditorCommandEnabled(editorRef, commandName) {
  return editorRef.current?.commands.get(commandName)?.isEnabled ?? false;
}

export function runEditorCommand(editorRef, commandName, options) {
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

export function runClipboardCommand(editorRef, operation, onError) {
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
            editor.model.insertContent(writer.createText(text), editor.model.document.selection);
          });
        })
        .catch(() => {
          onError?.("Не удалось вставить из буфера обмена.");
        });
    }
  }

  editor.editing.view.focus();
}

export function insertHtmlSnippet(editorRef, snippet) {
  const editor = editorRef.current;
  if (!editor || !snippet) {
    return null;
  }

  editor.model.change((writer) => {
    const viewFragment = editor.data.processor.toView(snippet);
    const modelFragment = editor.data.toModel(viewFragment);
    editor.model.insertContent(modelFragment);
  });

  return editor.getData();
}

export function createMenuActionHandler({
  editorRef,
  onError,
  onImport,
  onSave,
  onPrint,
  onInsertOutgoingRequisites,
  onInsertPageBreak,
  setOpenMenu,
}) {
  return function handleMenuAction(action, value) {
    setOpenMenu(null);

    switch (action) {
      case "import":
        onImport?.();
        break;
      case "save":
        onSave?.();
        break;
      case "print":
        onPrint?.();
        break;
      case "insertOutgoingRequisites":
        onInsertOutgoingRequisites?.();
        break;
      case "insertPageBreak":
        onInsertPageBreak?.();
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
        runEditorCommand(editorRef, action);
        break;
      case "insertTable":
        runEditorCommand(editorRef, "insertTable", { rows: 3, columns: 3, headingRows: 0 });
        break;
      case "heading":
        runEditorCommand(editorRef, "heading", { value });
        break;
      case "alignment":
        runEditorCommand(editorRef, "alignment", { value });
        break;
      case "cut":
      case "copy":
      case "paste":
        runClipboardCommand(editorRef, action, onError);
        break;
      default:
        editorRef.current?.editing.view.focus();
        break;
    }
  };
}
