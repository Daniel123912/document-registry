import { useEffect, useMemo, useRef, useState } from "react";
import { TYPE_OPTIONS } from "../constants";
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

export default function Sidebar({
  user,
  isResponsible,
  section,
  activeType,
  activeFolderId,
  activeOpen,
  folders,
  onToggleActive,
  onInbox,
  onSelectType,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onArchive,
  onTrash,
  onReport,
  onCreate,
  onLogout,
  inboxPendingCount = 0,
}) {
  const [workOpen, setWorkOpen] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
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

  function openContextMenu(event, menu) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 210;
    const menuHeight = menu.kind === "folder" ? 132 : 48;
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
              Рабочие разделы
            </button>
          </div>

          {workOpen ? (
            <div className="nav-tree-children">
              <div className="nav-tree-branch">
                <div className={navTreeRowClass({})}>
                  <TreeToggle visible open={activeOpen} onClick={onToggleActive} />
                  <button type="button" className="nav-tree-name" onClick={onToggleActive}>
                    Действующие документы
                  </button>
                </div>

                {activeOpen ? (
                  <div className="nav-tree-children">
                    {TYPE_OPTIONS.map((option) => {
                      const typeFolders = foldersForType(folders, option.value);
                      const typeExpanded = expandedTypes.has(option.value);
                      const typeActive =
                        section === "active" &&
                        activeType === option.value &&
                        activeFolderId == null;

                      return (
                        <div key={option.value} className="nav-tree-branch">
                          <div
                            className={navTreeRowClass({
                              active: typeActive,
                              menuOpen: contextMenu?.kind === "type" && contextMenu.type === option.value,
                            })}
                            onContextMenu={
                              isResponsible
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
                            <button
                              type="button"
                              className="nav-tree-name"
                              onClick={() => onSelectType(option.value)}
                            >
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
                              contextFolderId={
                                contextMenu?.kind === "folder" ? contextMenu.folder.id : null
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
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
        </div>
      ) : null}
    </aside>
  );
}
