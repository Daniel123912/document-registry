const crypto = require("crypto");

const IMG_TAG_RE = /<img\b([^>]*?)>/gi;
const IMG_SRC_RE = /\bsrc=(["'])(data:[^"']+)\1/i;
const BG_URL_RE = /url\(\s*(["']?)(data:[^"')]+)\1\s*\)/gi;
const SVG_TAG_RE = /<svg\b[\s\S]*?<\/svg>/gi;

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/is.exec(String(dataUrl || ""));
  if (!match) {
    return null;
  }

  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3];

  const content = isBase64
    ? Buffer.from(payload.replace(/\s+/g, ""), "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  if (!content.length) {
    return null;
  }

  return { mimeType, content };
}

function extensionForMime(mimeType) {
  const map = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
  };
  return map[String(mimeType || "").toLowerCase()] || "bin";
}

function svgMarkupToDataUrl(svgMarkup) {
  const content = Buffer.from(String(svgMarkup || "").trim(), "utf8");
  if (!content.length || !/<svg[\s>]/i.test(content)) {
    return null;
  }

  return {
    mimeType: "image/svg+xml",
    content,
  };
}

function wrapEmailHtml(html) {
  const body = String(html || "").trim();
  if (!body) {
    return "";
  }

  if (/<html[\s>]/i.test(body)) {
    return body;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:16px;background:#f5f5f5;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;">
    ${body}
  </div>
</body>
</html>`;
}

function prepareHtmlForEmail(html) {
  const attachments = [];
  let counter = 0;

  function attachDataUrl(dataUrl) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return dataUrl;
    }

    return attachBuffer(parsed.mimeType, parsed.content);
  }

  function attachBuffer(mimeType, content) {
    if (!content?.length) {
      return null;
    }

    counter += 1;
    const cid = `img${counter}_${crypto.randomBytes(4).toString("hex")}@bakor`;
    attachments.push({
      filename: `image-${counter}.${extensionForMime(mimeType)}`,
      content,
      contentType: mimeType,
      cid,
      contentDisposition: "inline",
    });

    return `cid:${cid}`;
  }

  let processed = String(html || "");

  processed = processed.replace(SVG_TAG_RE, (svgMarkup) => {
    const parsed = svgMarkupToDataUrl(svgMarkup);
    if (!parsed) {
      return svgMarkup;
    }

    const cid = attachBuffer(parsed.mimeType, parsed.content);
    if (!cid) {
      return svgMarkup;
    }

    return `<img src="${cid}" alt="" style="display:block;max-width:100%;height:auto;" />`;
  });

  processed = processed.replace(IMG_TAG_RE, (fullMatch, attrs) => {
    const srcMatch = IMG_SRC_RE.exec(attrs);
    IMG_SRC_RE.lastIndex = 0;
    if (!srcMatch) {
      return fullMatch;
    }

    const cid = attachDataUrl(srcMatch[2]);
    const nextAttrs = attrs.replace(srcMatch[0], `src="${cid}"`);
    return `<img${nextAttrs}>`;
  });

  processed = processed.replace(BG_URL_RE, (_fullMatch, quote, dataUrl) => {
    const cid = attachDataUrl(dataUrl);
    const q = quote || "";
    return `url(${q}${cid}${q})`;
  });

  return {
    html: wrapEmailHtml(processed),
    attachments,
  };
}

module.exports = {
  prepareHtmlForEmail,
  wrapEmailHtml,
};
