export function foldersForType(folders, type) {
  return (Array.isArray(folders) ? folders : []).filter((folder) => folder.type === type);
}

export function buildFolderChildrenMap(folders) {
  const byParent = new Map();

  for (const folder of folders) {
    const parentKey = folder.parentId == null ? "root" : String(folder.parentId);
    const list = byParent.get(parentKey) || [];
    list.push(folder);
    byParent.set(parentKey, list);
  }

  return byParent;
}

export function flattenFoldersForSelect(folders, type) {
  const scoped = foldersForType(folders, type);
  const byParent = buildFolderChildrenMap(scoped);
  const rows = [];

  function walk(parentId, depth) {
    const key = parentId == null ? "root" : String(parentId);
    const children = byParent.get(key) || [];
    for (const folder of children) {
      rows.push({
        ...folder,
        depth,
        label: `${"— ".repeat(depth)}${folder.name}`,
      });
      walk(folder.id, depth + 1);
    }
  }

  walk(null, 0);
  return rows;
}

export function folderPathLabels(folders, folderId) {
  if (folderId == null) {
    return [];
  }

  const byId = new Map((Array.isArray(folders) ? folders : []).map((folder) => [folder.id, folder]));
  const labels = [];
  let current = byId.get(Number(folderId));
  const guard = new Set();

  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    labels.unshift(current.name);
    current = current.parentId == null ? null : byId.get(current.parentId);
  }

  return labels;
}
