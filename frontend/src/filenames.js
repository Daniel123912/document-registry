function decodeOriginalFilename(name) {
  if (!name || typeof name !== "string") {
    return "";
  }

  const hasCyrillic = /[\u0400-\u04FF]/.test(name);
  const hasMojibake = /[\u0080-\u00FF]/.test(name);

  if (hasCyrillic && !hasMojibake) {
    return name;
  }

  try {
    const bytes = new Uint8Array(name.length);
    for (let i = 0; i < name.length; i += 1) {
      bytes[i] = name.charCodeAt(i) & 0xff;
    }
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!decoded.includes("\uFFFD") && /[\u0400-\u04FF]/.test(decoded)) {
      return decoded;
    }
  } catch {
    return name;
  }

  return name;
}

function withReadableFilenames(document) {
  return {
    ...document,
    currentFilename: decodeOriginalFilename(document.currentFilename),
    versions: (document.versions || []).map((version) => ({
      ...version,
      originalFilename: decodeOriginalFilename(version.originalFilename),
    })),
  };
}

export { decodeOriginalFilename, withReadableFilenames };
