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
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    if (decoded.includes("\uFFFD")) {
      return name;
    }
    if (/[\u0400-\u04FF]/.test(decoded)) {
      return decoded;
    }
  } catch (error) {
    return name;
  }

  return name;
}

module.exports = {
  decodeOriginalFilename,
};
