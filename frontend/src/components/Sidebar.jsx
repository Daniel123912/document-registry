import { useEffect, useMemo, useState } from "react";
import { TYPE_OPTIONS } from "../constants";
import { buildFolderChildrenMap, foldersForType } from "../utils/folders";

function FolderBranch({
  folders,
  parentId,
  depth,
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

  return children.map((folder) => {
    const hasChildren = (byParent.get(String(folder.id)) || []).length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isActive =
      section === "active" && activeType === folder.type && activeFolderId === folder.id;

    return (
      <div key={folder.id} className="nav-folder-block">
        <div
          className={isActive ? "nav-folder-row active" : "nav-folder-row"}
          style={{ paddingLeft: `${14 + depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="nav-folder-toggle"
              onClick={() => onToggleFolder(folder.id)}
              aria-label={isExpanded ? "Свернуть" : "Развернуть"}
            >
              <span className={isExpanded ? "chevron open" : "chevron"} />
            </button>
          ) : (
            <span className="nav-folder-toggle spacer" />
          )}
          <button
            type="button"
            className="nav-folder-name"
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
            depth={depth + 1}
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
  });
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
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());

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

        <div className="nav-title">Рабочие разделы</div>

        <button className="nav-parent" onClick={onToggleActive}>
          <span>Действующие документы</span>
          <span className={activeOpen ? "chevron open" : "chevron"} />
        </button>

        {activeOpen
          ? TYPE_OPTIONS.map((option) => {
              const typeFolders = foldersForType(folders, option.value);
              const typeExpanded = expandedTypes.has(option.value);
              const typeActive =
                section === "active" &&
                activeType === option.value &&
                activeFolderId == null;

              return (
                <div key={option.value} className="nav-type-block">
                  <div className={typeActive ? "nav-type-row active" : "nav-type-row"}>
                    {typeFolders.length ? (
                      <button
                        type="button"
                        className="nav-folder-toggle"
                        onClick={() => toggleTypeFolders(option.value)}
                        aria-label={typeExpanded ? "Свернуть папки" : "Развернуть папки"}
                      >
                        <span className={typeExpanded ? "chevron open" : "chevron"} />
                      </button>
                    ) : (
                      <span className="nav-folder-toggle spacer" />
                    )}
                    <button
                      type="button"
                      className="nav-type-name"
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
                      depth={1}
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
            })
          : null}

        <button
          className={section === "archive" ? "nav-parent active" : "nav-parent"}
          onClick={onArchive}
        >
          <span>Архив</span>
          <span className="chevron" />
        </button>

        {isResponsible ? (
          <button
            className={section === "trash" ? "nav-item active" : "nav-item"}
            onClick={onTrash}
          >
            Корзина
          </button>
        ) : null}

        {isResponsible ? (
          <button
            className={section === "report" ? "nav-item active" : "nav-item"}
            onClick={onReport}
          >
            Отчеты
          </button>
        ) : null}
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
