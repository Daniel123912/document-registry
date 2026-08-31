import { buildLetterPrintDocument, isBakorLetterLayout } from "./bakorLetterTemplate";

function sanitizeFilename(name) {
  const cleaned = String(name || "письмо")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "_")
    .slice(0, 80);
  return cleaned || "письмо";
}

function absolutizeAssetUrls(html) {
  const origin = window.location.origin;
  return html.replace(/\bsrc="(\/[^"]+)"/g, `src="${origin}$1"`);
}

function buildExportDocument(contentHtml, layoutKind) {
  const html = absolutizeAssetUrls(contentHtml);

  if (isBakorLetterLayout(layoutKind)) {
    return buildLetterPrintDocument(html);
  }

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Письмо</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.6;
        padding: 40px;
        color: #1f2933;
      }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadLetterAsWord(contentHtml, { subject, layoutKind } = {}) {
  const documentHtml = buildExportDocument(contentHtml, layoutKind);
  const blob = new Blob(["\ufeff", documentHtml], {
    type: "application/msword;charset=utf-8",
  });
  triggerDownload(blob, `${sanitizeFilename(subject)}.doc`);
}

export function downloadLetterAsPdf(contentHtml, { layoutKind } = {}) {
  const documentHtml = buildExportDocument(contentHtml, layoutKind);
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error("Браузер заблокировал окно печати.");
  }

  printWindow.document.write(documentHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
