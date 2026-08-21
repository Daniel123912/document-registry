import { useEffect, useMemo, useState } from "react";
import { TYPE_OPTIONS } from "../constants";
import { buildFolderChildrenMap, foldersForType } from "../utils/folders";

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
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
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
            <div className={isActive ? "nav-tree-row active" : "nav-tree-row"}>
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
              {isResponsible ? (
                <div className="nav-folder-actions">
                  <button
                    type="button"
                    className="nav-folder-action"
                    title="Создать подпапку"
                    onClick={() => onCreateFolder(folder.type, folder.id)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="nav-folder-action"
                    title="Переименовать"
                    onClick={() => onRenameFolder(folder)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="nav-folder-action"
                    title="Удалить"
                    onClick={() => onDeleteFolder(folder)}
                  >
                    ×
                  </button>
                </div>
              ) : null}
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
                onCreateFolder={onCreateFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
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
}) {
  const [workOpen, setWorkOpen] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());

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
          Мои документы
        </button>

        <div className="nav-tree">
          <div className="nav-tree-row nav-tree-root">
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
                <div className="nav-tree-row">
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
                          <div className={typeActive ? "nav-tree-row active" : "nav-tree-row"}>
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
                            {isResponsible ? (
                              <button
                                type="button"
                                className="nav-folder-action"
                                title="Создать папку"
                                onClick={() => onCreateFolder(option.value, null)}
                              >
                                +
                              </button>
                            ) : null}
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
                              onCreateFolder={onCreateFolder}
                              onRenameFolder={onRenameFolder}
                              onDeleteFolder={onDeleteFolder}
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
                className={section === "archive" ? "nav-tree-row active" : "nav-tree-row"}
                onClick={onArchive}
              >
                <TreeToggle visible={false} />
                <span className="nav-tree-name">Архив</span>
              </button>

              {isResponsible ? (
                <button
                  type="button"
                  className={section === "trash" ? "nav-tree-row active" : "nav-tree-row"}
                  onClick={onTrash}
                >
                  <TreeToggle visible={false} />
                  <span className="nav-tree-name">Корзина</span>
                </button>
              ) : null}

              {isResponsible ? (
                <button
                  type="button"
                  className={section === "report" ? "nav-tree-row active" : "nav-tree-row"}
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
    </aside>
  );
}
