import DOMPurify from "dompurify";
import {
  isLegacyWordFile,
  isPdfFile,
  isWordFile,
  MAX_PREVIEW_PARSE_BYTES,
} from "./filePreview";

export const EMAIL_TEMPLATE_IMPORT_ACCEPT = ".pdf,.docx,.svg";

const MAX_PDF_PAGES = 20;
const PDF_RENDER_SCALE = 2;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_PAGE_BREAK_PATTERN =
  /<w:br[^>]*w:type="page"|<w:lastRenderedPageBreak|<w:pageBreakBefore/g;
const MAMMOTH_PAGE_BREAK_STYLE_MAP = [`br[type=page] => div.import-page-break:fresh`];

function isZipArrayBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function escapeHtmlText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeEmailImportHtml(html) {
  return DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: [
      "style",
      "class",
      "align",
      "width",
      "height",
      "border",
      "cellpadding",
      "cellspacing",
      "colspan",
      "rowspan",
      "valign",
      "alt",
      "src",
      "viewBox",
      "xmlns",
      "fill",
      "stroke",
      "d",
      "cx",
      "cy",
      "r",
      "x",
      "y",
      "x1",
      "y1",
      "x2",
      "y2",
      "points",
      "transform",
      "opacity",
      "preserveAspectRatio",
    ],
    ADD_URI_SAFE_ATTR: ["src", "href", "xlink:href"],
    ALLOW_UNKNOWN_PROTOCOLS: true,
    FORBID_TAGS: ["form", "input", "button", "script", "iframe", "object", "embed", "math"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
  });
}

function isSvgFile(filename, mimeType) {
  return (
    /\.svg$/i.test(filename || "") ||
    String(mimeType || "").toLowerCase() === "image/svg+xml"
  );
}

function svgTextToDataUrl(svgText) {
  const sanitized = DOMPurify.sanitize(String(svgText || "").trim(), {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script"],
  });

  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return null;
  }

  const encoded = btoa(unescape(encodeURIComponent(sanitized)));

  return `data:image/svg+xml;base64,${encoded}`;
}

function mammothImageConverter(mammoth) {
  return {
    convertImage: mammoth.images.imgElement(async (image) => {
      const imageBuffer = await image.read("base64");
      return { src: `data:${image.contentType};base64,${imageBuffer}` };
    }),
  };
}

async function convertDocxBufferToHtml(arrayBuffer, mammoth, imageOptions) {
  const rendered = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      ...imageOptions,
      styleMap: MAMMOTH_PAGE_BREAK_STYLE_MAP,
    }
  );
  return rendered.value || "";
}

function countDocxPages(documentXml) {
  if (!documentXml) {
    return 1;
  }

  DOCX_PAGE_BREAK_PATTERN.lastIndex = 0;
  const matches = documentXml.match(DOCX_PAGE_BREAK_PATTERN);
  return (matches?.length || 0) + 1;
}

function sortedDocxParts(files, pattern) {
  return Object.keys(files)
    .filter((name) => pattern.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function normalizeDocxPageBreaksInXml(documentXml) {
  let result = String(documentXml || "");

  result = result.replace(
    /<w:p\b([^>]*)>(\s*<w:pPr>[\s\S]*?<w:pageBreakBefore\s*\/?>[\s\S]*?<\/w:pPr>)/g,
    '<w:p$1><w:r><w:br w:type="page"/></w:r>$2'
  );

  result = result.replace(/<w:lastRenderedPageBreak\s*\/>/g, '<w:r><w:br w:type="page"/></w:r>');

  return result;
}

async function buildDocxArrayBufferForMammoth(arrayBuffer, JSZipLib) {
  const zip = await JSZipLib.loadAsync(arrayBuffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    return arrayBuffer;
  }

  const documentXml = await documentFile.async("text");
  const normalizedXml = normalizeDocxPageBreaksInXml(documentXml);

  if (normalizedXml === documentXml) {
    return arrayBuffer;
  }

  zip.file("word/document.xml", normalizedXml);
  return zip.generateAsync({ type: "arraybuffer" });
}

async function extractDocxPartFallbackHtml(partXml) {
  if (!partXml || typeof DOMParser === "undefined") {
    return "";
  }

  const doc = new DOMParser().parseFromString(partXml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return "";
  }

  const paragraphs = [];
  const bodyElements = Array.from(doc.getElementsByTagName("*")).filter(
    (node) => node.localName === "p"
  );

  for (const paragraph of bodyElements) {
    const parts = [];
    for (const node of paragraph.getElementsByTagName("*")) {
      if (node.localName === "t" && node.textContent) {
        parts.push(node.textContent);
      }
    }
    const text = parts.join("").trim();
    if (text) {
      paragraphs.push(`<p>${escapeHtmlText(text)}</p>`);
    }
  }

  if (paragraphs.length) {
    return paragraphs.join("\n");
  }

  const fallbackText = Array.from(doc.getElementsByTagName("*"))
    .filter((node) => node.localName === "t" && node.textContent)
    .map((node) => node.textContent)
    .join(" ")
    .trim();

  return fallbackText ? `<p>${escapeHtmlText(fallbackText)}</p>` : "";
}

async function convertDocxPartToHtml(arrayBuffer, partPath, mammoth, JSZipLib, imageOptions) {
  const zip = await JSZipLib.loadAsync(arrayBuffer);
  const partFile = zip.file(partPath);
  if (!partFile) {
    return "";
  }

  try {
    const partContent = await partFile.async("uint8array");
    const patchedZip = await JSZipLib.loadAsync(arrayBuffer);
    patchedZip.file("word/document.xml", partContent);
    const patchedBuffer = await patchedZip.generateAsync({ type: "arraybuffer" });
    const html = await convertDocxBufferToHtml(patchedBuffer, mammoth, imageOptions);
    if (html.trim()) {
      return html;
    }
  } catch {
    // Fall back to plain-text extraction below.
  }

  const partXml = await partFile.async("text");
  return extractDocxPartFallbackHtml(partXml);
}

async function docxToEmailHtml(arrayBuffer) {
  if (!isZipArrayBuffer(arrayBuffer)) {
    throw new Error(
      "Файл не похож на DOCX. Если это старый .doc, сохраните документ как .docx в Word."
    );
  }

  const [mammothModule, jszipModule] = await Promise.all([import("mammoth"), import("jszip")]);
  const mammothLib = mammothModule.default || mammothModule;
  const JSZipLib = jszipModule.default || jszipModule;
  const imageOptions = mammothImageConverter(mammothLib);
  const zip = await JSZipLib.loadAsync(arrayBuffer);

  if (!zip.file("word/document.xml")) {
    throw new Error("В файле нет содержимого Word. Проверьте, что это настоящий .docx.");
  }

  const documentXml = await zip.file("word/document.xml").async("text");
  const pageCount = countDocxPages(documentXml);
  const mammothBuffer = await buildDocxArrayBufferForMammoth(arrayBuffer, JSZipLib);

  let bodyHtml = "";
  try {
    bodyHtml = await convertDocxBufferToHtml(mammothBuffer, mammothLib, imageOptions);
  } catch (error) {
    const message = String(error?.message || "");
    if (/body element|docx file/i.test(message)) {
      throw new Error(
        "Не удалось прочитать DOCX. Сохраните файл заново через «Файл → Сохранить как → Документ Word (.docx)»."
      );
    }
    throw error;
  }

  const headerPaths = sortedDocxParts(zip.files, /^word\/header\d+\.xml$/);
  const footerPaths = sortedDocxParts(zip.files, /^word\/footer\d+\.xml$/);

  const headerBlocks = [];
  for (const partPath of headerPaths) {
    try {
      const html = await convertDocxPartToHtml(
        arrayBuffer,
        partPath,
        mammothLib,
        JSZipLib,
        imageOptions
      );
      if (html.trim()) {
        headerBlocks.push(
          `<div class="email-template-header" style="margin-bottom:16px;">${html}</div>`
        );
      }
    } catch {
      // Skip broken header parts.
    }
  }

  const footerBlocks = [];
  for (const partPath of footerPaths) {
    try {
      const html = await convertDocxPartToHtml(
        arrayBuffer,
        partPath,
        mammothLib,
        JSZipLib,
        imageOptions
      );
      if (html.trim()) {
        footerBlocks.push(
          `<div class="email-template-footer" style="margin-top:16px;">${html}</div>`
        );
      }
    } catch {
      // Skip broken footer parts.
    }
  }

  return {
    htmlBody: sanitizeEmailImportHtml([...headerBlocks, bodyHtml, ...footerBlocks].join("\n")),
    pageCount,
    source: "docx",
  };
}

async function pdfToEmailHtml(arrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }

    await page.render({ canvasContext: context, viewport }).promise;
    pages.push(
      `<p style="margin:0 0 16px;"><img src="${canvas.toDataURL("image/png")}" alt="Страница ${pageNumber}" style="display:block;max-width:100%;height:auto;" /></p>`
    );
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    pages.push(
      `<p style="color:#666;font-size:12px;">Импортированы первые ${MAX_PDF_PAGES} страниц из ${pdf.numPages}.</p>`
    );
  }

  return {
    htmlBody: sanitizeEmailImportHtml(pages.join("\n")),
    pageCount: pdf.numPages,
    source: "pdf",
  };
}

async function svgToEmailHtml(arrayBuffer) {
  const svgText = new TextDecoder("utf-8").decode(arrayBuffer).trim();
  const dataUrl = svgTextToDataUrl(svgText);

  if (!dataUrl) {
    throw new Error("Файл не похож на SVG.");
  }

  return {
    htmlBody: sanitizeEmailImportHtml(
      `<p><img src="${dataUrl}" alt="SVG" style="display:block;max-width:100%;height:auto;" /></p>`
    ),
    pageCount: 1,
    source: "svg",
  };
}

export async function importEmailTemplateFromFile(file) {
  if (!file) {
    throw new Error("Файл не выбран.");
  }

  if (file.size > MAX_PREVIEW_PARSE_BYTES) {
    throw new Error("Файл слишком большой. Максимальный размер — 15 МБ.");
  }

  const filename = file.name || "";
  const mimeType = file.type || "";
  const arrayBuffer = await file.arrayBuffer();

  if (isPdfFile(filename, mimeType)) {
    const imported = await pdfToEmailHtml(arrayBuffer);
    if (!imported.htmlBody.trim()) {
      throw new Error("Не удалось прочитать PDF.");
    }
    return imported;
  }

  const looksLikeDocx =
    isWordFile(filename, mimeType) ||
    /\.docx$/i.test(filename) ||
    mimeType === DOCX_MIME ||
    (mimeType === "application/octet-stream" && /\.docx$/i.test(filename));

  if (looksLikeDocx) {
    const imported = await docxToEmailHtml(arrayBuffer);
    if (!imported.htmlBody.trim()) {
      throw new Error("Не удалось прочитать DOCX.");
    }
    return imported;
  }

  if (isLegacyWordFile(filename, mimeType)) {
    throw new Error("Формат .doc не поддерживается. Сохраните файл как .docx.");
  }

  if (isSvgFile(filename, mimeType)) {
    const imported = await svgToEmailHtml(arrayBuffer);
    if (!imported.htmlBody.trim()) {
      throw new Error("Не удалось прочитать SVG.");
    }
    return imported;
  }

  throw new Error("Поддерживаются только PDF, DOCX и SVG.");
}
