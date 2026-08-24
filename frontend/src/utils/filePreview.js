import DOMPurify from "dompurify";

export const MAX_PREVIEW_PARSE_BYTES = 15 * 1024 * 1024;
export const MAX_SHEET_PREVIEW_CELLS = 20000;

export function isImageFile(filename, mimeType) {
  return (
    String(mimeType || "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/i.test(filename || "")
  );
}

export function isPdfFile(filename, mimeType) {
  return mimeType === "application/pdf" || /\.pdf$/i.test(filename || "");
}

export function isWordFile(filename, mimeType) {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(filename || "")
  );
}

export function isLegacyWordFile(filename, mimeType) {
  return mimeType === "application/msword" || /\.doc$/i.test(filename || "");
}

export function isSpreadsheetFile(filename, mimeType) {
  return (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    /\.xlsx?$/i.test(filename || "")
  );
}

export async function blobLooksLikeHtml(blob) {
  try {
    const head = (await blob.slice(0, 256).text()).trim();
    return /^<(?:!doctype\s+html|html|head|body|table)\b/i.test(head);
  } catch {
    return false;
  }
}

export function extractHtmlTable(html) {
  const match = String(html || "").match(/<table[\s\S]*<\/table>/i);
  return match ? match[0] : "";
}

export function sanitizePreviewHtml(html) {
  return DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["ins", "del"],
    ADD_ATTR: ["class", "title"],
    FORBID_TAGS: ["form", "input", "button", "script", "style", "svg", "math"],
    FORBID_ATTR: ["id", "name"],
  });
}


export function sheetToPreviewHtml(sheet, xlsx) {
  if (!sheet || !xlsx?.utils || !sheet["!ref"]) {
    return "";
  }

  try {
    const range = xlsx.utils.decode_range(sheet["!ref"]);
    const rows = range.e.r - range.s.r + 1;
    const cols = range.e.c - range.s.c + 1;
    const cellCount = rows * cols;
    let previewSheet = sheet;

    if (cellCount > MAX_SHEET_PREVIEW_CELLS) {
      previewSheet = {
        ...sheet,
        "!ref": xlsx.utils.encode_range({
          s: range.s,
          e: {
            r: range.s.r + Math.min(rows, 150) - 1,
            c: range.s.c + Math.min(cols, 40) - 1,
          },
        }),
      };
    }

    return sanitizePreviewHtml(
      xlsx.utils.sheet_to_html(previewSheet, { header: "", footer: "" })
    );
  } catch {
    return "";
  }
}

export async function parseDocumentPreview({ blob, mimeType, size, filename }) {
  const next = {
    mimeType,
    docHtml: "",
    textLines: [],
    sheetNames: [],
    size: size || 0,
    workbook: null,
    xlsx: null,
  };
  const canParsePreview = (size || 0) <= MAX_PREVIEW_PARSE_BYTES;

  if (isWordFile(filename, mimeType) && canParsePreview) {
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await blob.arrayBuffer();
      const rendered = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const imageBuffer = await image.read("base64");
            return { src: `data:${image.contentType};base64,${imageBuffer}` };
          }),
        }
      );
      next.docHtml = sanitizePreviewHtml(rendered.value);
    } catch {
      next.docHtml = "";
    }
  }

  if (isSpreadsheetFile(filename, mimeType) && canParsePreview) {
    try {
      if (await blobLooksLikeHtml(blob)) {
        const html = await blob.text();
        next.docHtml = sanitizePreviewHtml(extractHtmlTable(html));
      } else {
        const XLSX = await import("xlsx");
        const arrayBuffer = await blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
          type: "array",
          cellDates: true,
        });
        next.workbook = workbook;
        next.xlsx = XLSX;
        next.sheetNames = workbook.SheetNames || [];
      }
    } catch {
      next.workbook = null;
      next.xlsx = null;
      next.sheetNames = [];
      next.docHtml = "";
    }
  }

  return next;
}
