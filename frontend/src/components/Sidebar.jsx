import { useEffect, useMemo, useRef, useState } from "react";
import {
  TYPE_OPTIONS,
  ORDER_TYPE,
  WORK_DOCUMENT_TYPE_OPTIONS,
  LEGAL_ENTITY_TYPE,
  LEGAL_ENTITY_OPTION,
  typeAllowsFolders,
} from "../constants";
import { buildFolderChildrenMap, foldersForType } from "../utils/folders";

function navTreeRowClass({ active = false, menuOpen = false, root = false }) {
  return [
    "nav-tree-row",
    root ? "nav-tree-root" : "",
    active ? "active" : "",
    menuOpen ? "menu-open" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function TreeToggle({ open, onClick, visible }) {
  if (!visible) {
    return <span className="nav-folder-toggle spacer" />;
  }

  return (
    <button
      type="button"
      className="nav-folder-toggle"
      onClick={onClick}
      aria-label={open ? "Свернуть" : "Развернуть"}
    >
      <span className={open ? "chevron open" : "chevron"} />
    </button>
  );
}

function FolderBranch({
  folders,
  parentId,
  activeType,
  activeFolderId,
  section,
  expandedFolders,
  isResponsible,
  onSelectFolder,
  onToggleFolder,
  onFolderContextMenu,
  contextFolderId,
}) {
  const byParent = useMemo(() => buildFolderChildrenMap(folders), [folders]);
  const children = byParent.get(parentId == null ? "root" : String(parentId)) || [];

  if (!children.length) {
    return null;
  }

  return (
    <div className="nav-tree-children">
      {children.map((folder) => {
        const hasChildren = (byParent.get(String(folder.id)) || []).length > 0;
        const isExpanded = expandedFolders.has(folder.id);
        const isActive =
          section === "active" && activeType === folder.type && activeFolderId === folder.id;

        return (
          <div key={folder.id} className="nav-tree-branch">
            <div
              className={navTreeRowClass({
                active: isActive,
                menuOpen: contextFolderId === folder.id,
              })}
        onContextMenu={
          isResponsible ? (event) => onFolderContextMenu(event, folder) : undefined
        }
            >
              <TreeToggle
                visible={hasChildren}
                open={isExpanded}
                onClick={() => onToggleFolder(folder.id)}
              />
              <button
                type="button"
                className="nav-tree-name"
                onClick={() => onSelectFolder(folder.type, folder.id)}
              >
                {folder.name}
              </button>
            </div>
            {isExpanded ? (
              <FolderBranch
                folders={folders}
                parentId={folder.id}
                activeType={activeType}
                activeFolderId={activeFolderId}
                section={section}
                expandedFolders={expandedFolders}
                isResponsible={isResponsible}
                onSelectFolder={onSelectFolder}
                onToggleFolder={onToggleFolder}
                onFolderContextMenu={onFolderContextMenu}
                contextFolderId={contextFolderId}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TypeNavBranch({
  option,
  folders,
  section,
  activeType,
  activeFolderId,
  expandedTypes,
  expandedFolders,
  isResponsible,
  contextMenu,
  onSelectType,
  toggleTypeFolders,
  onSelectFolder,
  toggleFolder,
  openContextMenu,
}) {
  const typeFolders = foldersForType(folders, option.value);
  const typeExpanded = expandedTypes.has(option.value);
  const typeActive =
    section === "active" && activeType === option.value && activeFolderId == null;

  return (
    <div className="nav-tree-branch">
      <div
        className={navTreeRowClass({
          active: typeActive,
          menuOpen: contextMenu?.kind === "type" && contextMenu.type === option.value,
        })}
        onContextMenu={
          isResponsible && typeAllowsFolders(option.value)
            ? (event) =>
                openContextMenu(event, {
                  kind: "type",
                  type: option.value,
                })
            : undefined
        }
      >
        <TreeToggle
          visible={typeFolders.length > 0}
          open={typeExpanded}
          onClick={() => toggleTypeFolders(option.value)}
        />
        <button type="button" className="nav-tree-name" onClick={() => onSelectType(option.value)}>
          {option.label}
        </button>
      </div>

      {typeExpanded ? (
        <FolderBranch
          folders={typeFolders}
          parentId={null}
          activeType={activeType}
          activeFolderId={activeFolderId}
          section={section}
          expandedFolders={expandedFolders}
          isResponsible={isResponsible}
          onSelectFolder={onSelectFolder}
          onToggleFolder={toggleFolder}
          onFolderContextMenu={(event, folder) =>
            openContextMenu(event, { kind: "folder", folder })
          }
          contextFolderId={contextMenu?.kind === "folder" ? contextMenu.folder.id : null}
        />
      ) : null}
    </div>
  );
}

function EmailFolderBranch({
  folders,
  parentId,
  lettersFolderId,
  section,
  expandedFolders,
  isResponsible,
  onSelectLettersFolder,
  onToggleLettersFolder,
  onEmailFolderContextMenu,
  contextEmailFolderId,
}) {
  const byParent = useMemo(() => buildFolderChildrenMap(folders), [folders]);
  const children = byParent.get(parentId == null ? "root" : String(parentId)) || [];

  if (!children.length) {
    return null;
  }

  return (
    <div className="nav-tree-children">
      {children.map((folder) => {
        const hasChildren = (byParent.get(String(folder.id)) || []).length > 0;
        const isExpanded = expandedFolders.has(folder.id);
        const isActive = section === "letters" && lettersFolderId === folder.id;

        return (
          <div key={folder.id} className="nav-tree-branch">
            <div
              className={navTreeRowClass({
                active: isActive,
                menuOpen: contextEmailFolderId === folder.id,
              })}
              onContextMenu={
                isResponsible ? (event) => onEmailFolderContextMenu(event, folder) : undefined
              }
            >
              <TreeToggle
                visible={hasChildren}
                open={isExpanded}
                onClick={() => onToggleLettersFolder(folder.id)}
              />
              <button
                type="button"
                className="nav-tree-name"
                onClick={() => onSelectLettersFolder(folder.id)}
              >
                {folder.name}
              </button>
            </div>
            {isExpanded ? (
              <EmailFolderBranch
                folders={folders}
                parentId={folder.id}
                lettersFolderId={lettersFolderId}
                section={section}
                expandedFolders={expandedFolders}
                isResponsible={isResponsible}
                onSelectLettersFolder={onSelectLettersFolder}
                onToggleLettersFolder={onToggleLettersFolder}
                onEmailFolderContextMenu={onEmailFolderContextMenu}
                contextEmailFolderId={contextEmailFolderId}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function Sidebar({
  user,
  isResponsible,
  section,
  activeType,
  activeFolderId,
  folders,
  lettersOpen,
  lettersFolderId,
  emailTemplateFolders,
  onInbox,
  onSelectType,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onArchive,
  onTrash,
  onReport,
  onLetters,
  onToggleLetters,
  onSelectLettersFolder,
  onCreateEmailFolder,
  onRenameEmailFolder,
  onDeleteEmailFolder,
  onViewLetterTemplates,
  onComposeLetter,
  onCreate,
  onLogout,
  inboxPendingCount = 0,
}) {
  const [workOpen, setWorkOpen] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [expandedEmailFolders, setExpandedEmailFolders] = useState(() => new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);

  useEffect(() => {
    if (section === "inbox") {
      return;
    }
    setWorkOpen(true);
  }, [section]);

  useEffect(() => {
    if (section === "active" && activeType) {
      setExpandedTypes((current) => {
        if (current.has(activeType)) {
          return current;
        }
        const next = new Set(current);
        next.add(activeType);
        return next;
      });
    }
  }, [activeType, section]);

  useEffect(() => {
    if (activeFolderId == null) {
      return;
    }
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const ancestors = [];
    let current = byId.get(activeFolderId);
    while (current?.parentId != null) {
      ancestors.push(current.parentId);
      current = byId.get(current.parentId);
    }
    if (!ancestors.length) {
      return;
    }
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeFolderId, folders]);

  useEffect(() => {
    if (lettersFolderId == null) {
      return;
    }
    const byId = new Map(emailTemplateFolders.map((folder) => [folder.id, folder]));
    const ancestors = [];
    let current = byId.get(lettersFolderId);
    while (current?.parentId != null) {
      ancestors.push(current.parentId);
      current = byId.get(current.parentId);
    }
    if (!ancestors.length) {
      return;
    }
    setExpandedEmailFolders((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [emailTemplateFolders, lettersFolderId]);

  function toggleTypeFolders(type) {
    setExpandedTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleFolder(folderId) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function toggleLettersFolder(folderId) {
    setExpandedEmailFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function openContextMenu(event, menu) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 210;
    const menuHeight = menu.kind === "folder" || menu.kind === "email-folder" ? 132 : 48;
    setContextMenu({
      ...menu,
      x: Math.min(event.clientX, window.innerWidth - menuWidth),
      y: Math.min(event.clientY, window.innerHeight - menuHeight),
    });
  }

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    function closeMenu(event) {
      if (contextMenuRef.current?.contains(event.target)) {
        return;
      }
      setContextMenu(null);
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("contextmenu", closeMenu);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("contextmenu", closeMenu);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [contextMenu]);

  const legalFolders = foldersForType(folders, LEGAL_ENTITY_TYPE);
  const orderOption = TYPE_OPTIONS.find((option) => option.value === ORDER_TYPE);
  const legalExpanded = expandedTypes.has(LEGAL_ENTITY_TYPE);
  const legalActive =
    section === "active" && activeType === LEGAL_ENTITY_TYPE && activeFolderId == null;

  return (
    <aside className="sidebar">
      <h1 className="logo">Реестр</h1>
      {isResponsible ? (
        <button className="create-btn" onClick={onCreate}>
          + Создать документ
        </button>
      ) : null}

      <nav className="nav">
        <button
          className={section === "inbox" ? "nav-item active" : "nav-item"}
          onClick={onInbox}
        >
          <span>На ознакомление</span>
          {inboxPendingCount > 0 ? (
            <span className="nav-badge" aria-label={`Ожидает ознакомления: ${inboxPendingCount}`}>
              {inboxPendingCount > 99 ? "99+" : inboxPendingCount}
            </span>
          ) : null}
        </button>

        <div className="nav-tree">
          {orderOption ? (
            <TypeNavBranch
              option={orderOption}
              folders={folders}
              section={section}
              activeType={activeType}
              activeFolderId={activeFolderId}
              expandedTypes={expandedTypes}
              expandedFolders={expandedFolders}
              isResponsible={isResponsible}
              contextMenu={contextMenu}
              onSelectType={onSelectType}
              toggleTypeFolders={toggleTypeFolders}
              onSelectFolder={onSelectFolder}
              toggleFolder={toggleFolder}
              openContextMenu={openContextMenu}
            />
          ) : null}

          <div className={navTreeRowClass({ root: true })}>
            <TreeToggle
              visible
              open={workOpen}
              onClick={() => setWorkOpen((current) => !current)}
            />
            <button
              type="button"
              className="nav-tree-name"
              onClick={() => setWorkOpen((current) => !current)}
            >
              Рабочие документы
            </button>
          </div>

          {workOpen ? (
            <div className="nav-tree-children">
              {WORK_DOCUMENT_TYPE_OPTIONS.map((option) => (
                <TypeNavBranch
                  key={option.value}
                  option={option}
                  folders={folders}
                  section={section}
                  activeType={activeType}
                  activeFolderId={activeFolderId}
                  expandedTypes={expandedTypes}
                  expandedFolders={expandedFolders}
                  isResponsible={isResponsible}
                  contextMenu={contextMenu}
                  onSelectType={onSelectType}
                  toggleTypeFolders={toggleTypeFolders}
                  onSelectFolder={onSelectFolder}
                  toggleFolder={toggleFolder}
                  openContextMenu={openContextMenu}
                />
              ))}
            </div>
          ) : null}

          <div className="nav-tree-branch">
            <div
              className={navTreeRowClass({
                active: legalActive,
                menuOpen: contextMenu?.kind === "type" && contextMenu.type === LEGAL_ENTITY_TYPE,
              })}
              onContextMenu={
                isResponsible
                  ? (event) =>
                      openContextMenu(event, {
                        kind: "type",
                        type: LEGAL_ENTITY_TYPE,
                      })
                  : undefined
              }
            >
              <TreeToggle
                visible={legalFolders.length > 0}
                open={legalExpanded}
                onClick={() => toggleTypeFolders(LEGAL_ENTITY_TYPE)}
              />
              <button
                type="button"
                className="nav-tree-name"
                onClick={() => onSelectType(LEGAL_ENTITY_TYPE)}
              >
                {LEGAL_ENTITY_OPTION.label}
              </button>
            </div>

            {legalExpanded ? (
              <FolderBranch
                folders={legalFolders}
                parentId={null}
                activeType={activeType}
                activeFolderId={activeFolderId}
                section={section}
                expandedFolders={expandedFolders}
                isResponsible={isResponsible}
                onSelectFolder={onSelectFolder}
                onToggleFolder={toggleFolder}
                onFolderContextMenu={(event, folder) =>
                  openContextMenu(event, { kind: "folder", folder })
                }
                contextFolderId={contextMenu?.kind === "folder" ? contextMenu.folder.id : null}
              />
            ) : null}
          </div>

          <button
            type="button"
            className={navTreeRowClass({ active: section === "archive" })}
            onClick={onArchive}
          >
            <TreeToggle visible={false} />
            <span className="nav-tree-name">Архив</span>
          </button>

          {isResponsible ? (
            <button
              type="button"
              className={navTreeRowClass({ active: section === "trash" })}
              onClick={onTrash}
            >
              <TreeToggle visible={false} />
              <span className="nav-tree-name">Корзина</span>
            </button>
          ) : null}

          {isResponsible ? (
            <button
              type="button"
              className={navTreeRowClass({ active: section === "report" })}
              onClick={onReport}
            >
              <TreeToggle visible={false} />
              <span className="nav-tree-name">Отчеты</span>
            </button>
          ) : null}
        </div>
      </nav>

      <div className="sidebar-foot">
        <div>{user.fullName}</div>
        <div>{isResponsible ? "Ответственный" : "Сотрудник"}</div>
        <button className="logout-btn" onClick={onLogout}>
          Выйти
        </button>
      </div>

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="nav-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {contextMenu.kind === "letters-root" || contextMenu.kind === "email-folder" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (contextMenu.kind === "email-folder") {
                    onViewLetterTemplates(contextMenu.folder.id);
                  } else {
                    onViewLetterTemplates(null);
                  }
                  setContextMenu(null);
                }}
              >
                Посмотреть шаблоны
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (contextMenu.kind === "email-folder") {
                    onComposeLetter(contextMenu.folder.id);
                  } else {
                    onComposeLetter(null);
                  }
                  setContextMenu(null);
                }}
              >
                Написать письмо
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (contextMenu.kind === "email-folder") {
                    onCreateEmailFolder(contextMenu.folder.id);
                  } else {
                    onCreateEmailFolder(null);
                  }
                  setContextMenu(null);
                }}
              >
                Добавить папку
              </button>
            </>
          ) : (contextMenu.kind === "type" && typeAllowsFolders(contextMenu.type)) ||
            (contextMenu.kind === "folder" && typeAllowsFolders(contextMenu.folder.type)) ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (contextMenu.kind === "folder") {
                  onCreateFolder(contextMenu.folder.type, contextMenu.folder.id);
                } else {
                  onCreateFolder(contextMenu.type, null);
                }
                setContextMenu(null);
              }}
            >
              Добавить папку
            </button>
          ) : null}
          {contextMenu.kind === "folder" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onRenameFolder(contextMenu.folder);
                  setContextMenu(null);
                }}
              >
                Переименовать
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  onDeleteFolder(contextMenu.folder);
                  setContextMenu(null);
                }}
              >
                Удалить
              </button>
            </>
          ) : null}
          {contextMenu.kind === "email-folder" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onRenameEmailFolder(contextMenu.folder);
                  setContextMenu(null);
                }}
              >
                Переименовать
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  onDeleteEmailFolder(contextMenu.folder);
                  setContextMenu(null);
                }}
              >
                Удалить
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
