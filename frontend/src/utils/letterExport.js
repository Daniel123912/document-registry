import {
  buildLetterPrintDocument,
  buildLetterPrintShell,
  isBakorLetterLayout,
  LETTER_FOOTER_IMAGE,
  LETTER_HEADER_IMAGE,
} from "./bakorLetterTemplate";

const LETTER_ASSET_PATHS = [LETTER_HEADER_IMAGE, LETTER_FOOTER_IMAGE];

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

function imageElementToDataUrl(image) {
  if (!image?.naturalWidth) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrl(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить изображение: ${path}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Не удалось прочитать изображение: ${path}`));
    reader.readAsDataURL(blob);
  });
}

function collectImageReplacements(sourceRoot) {
  const replacements = new Map();

  function addReplacement(source, dataUrl) {
    if (!source || !dataUrl || replacements.has(source)) {
      return;
    }

    replacements.set(source, dataUrl);
  }

  if (sourceRoot) {
    sourceRoot.querySelectorAll("img").forEach((image) => {
      const dataUrl = imageElementToDataUrl(image);
      if (!dataUrl) {
        return;
      }

      addReplacement(image.src, dataUrl);

      const rawSrc = image.getAttribute("src");
      if (rawSrc) {
        addReplacement(rawSrc, dataUrl);
        if (rawSrc.startsWith("/")) {
          addReplacement(`${window.location.origin}${rawSrc}`, dataUrl);
        }
      }
    });
  }

  return replacements;
}

async function addFallbackAssetReplacements(replacements) {
  for (const assetPath of LETTER_ASSET_PATHS) {
    const absolutePath = `${window.location.origin}${assetPath}`;
    if (replacements.has(assetPath) || replacements.has(absolutePath)) {
      continue;
    }

    try {
      const dataUrl = await fetchImageAsDataUrl(assetPath);
      replacements.set(assetPath, dataUrl);
      replacements.set(absolutePath, dataUrl);
    } catch {
      // Ignore missing optional assets.
    }
  }
}

function applyImageReplacements(html, replacements) {
  let result = html;

  for (const [source, dataUrl] of replacements) {
    result = result.split(source).join(dataUrl);
  }

  return result;
}

async function inlineImages(html, sourceRoot) {
  const replacements = collectImageReplacements(sourceRoot);
  await addFallbackAssetReplacements(replacements);
  return applyImageReplacements(absolutizeAssetUrls(html), replacements);
}

function normalizeLetterPreviewClone(letterPageElement) {
  const clone = letterPageElement.cloneNode(true);
  const contentWrapper = clone.querySelector(".letter-page__content");
  const editable =
    letterPageElement.querySelector(".ck-editor__editable") ||
    clone.querySelector(".ck-editor__editable");

  if (contentWrapper && editable) {
    contentWrapper.innerHTML = editable.innerHTML;
  }

  clone.querySelectorAll(".ck, .ck-editor, .ck-toolbar, .ck-editor__top").forEach((node) => {
    node.remove();
  });

  return clone;
}

async function buildBakorExportDocument(contentHtml, liveLetterPage) {
  if (liveLetterPage) {
    const clone = normalizeLetterPreviewClone(liveLetterPage);
    const shell = buildLetterPrintShell(clone.outerHTML);
    return inlineImages(shell, liveLetterPage);
  }

  return inlineImages(buildLetterPrintDocument(contentHtml), null);
}

async function buildExportDocument(contentHtml, layoutKind, liveLetterPage) {
  if (isBakorLetterLayout(layoutKind)) {
    return buildBakorExportDocument(contentHtml, liveLetterPage);
  }

  const html = absolutizeAssetUrls(contentHtml);
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
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #d5dde6; padding: 8px 10px; }
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

function waitForDocumentImages(doc) {
  const images = Array.from(doc.images || []);

  return Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        })
    )
  );
}

function waitForDocumentFonts(doc) {
  if (!doc.fonts?.ready) {
    return Promise.resolve();
  }

  return doc.fonts.ready.catch(() => undefined);
}

function waitForFrameLoad(frame) {
  return new Promise((resolve) => {
    if (frame.contentDocument?.readyState === "complete") {
      resolve();
      return;
    }

    frame.addEventListener("load", resolve, { once: true });
  });
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function waitForPrintDialog(frameWindow) {
  return new Promise((resolve) => {
    let settled = false;

    function finish() {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    }

    frameWindow.addEventListener("afterprint", finish, { once: true });
    window.setTimeout(finish, 120000);
  });
}

async function printHtmlDocument(documentHtml, { title } = {}) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(frame);

  try {
    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    if (!frameWindow || !frameDocument) {
      throw new Error("Не удалось подготовить печать письма.");
    }

    frameDocument.open();
    frameDocument.write(documentHtml);
    frameDocument.close();
    frameDocument.title = title || "Письмо";

    await waitForFrameLoad(frame);
    await waitForDocumentFonts(frameDocument);
    await waitForDocumentImages(frameDocument);
    await waitForNextFrame();

    frameWindow.focus();
    frameWindow.print();
    await waitForPrintDialog(frameWindow);
  } finally {
    frame.remove();
  }
}

export function findLiveLetterPreview() {
  return document.querySelector(".email-doc-editor__canvas--letter .letter-page");
}

export async function downloadLetterAsWord(
  contentHtml,
  { subject, layoutKind, liveLetterPage } = {}
) {
  const documentHtml = await buildExportDocument(
    contentHtml,
    layoutKind,
    liveLetterPage || findLiveLetterPreview()
  );
  const blob = new Blob(["\ufeff", documentHtml], {
    type: "application/msword;charset=utf-8",
  });
  triggerDownload(blob, `${sanitizeFilename(subject)}.doc`);
}

export async function downloadLetterAsPdf(
  contentHtml,
  { subject, layoutKind, liveLetterPage } = {}
) {
  const documentHtml = await buildExportDocument(
    contentHtml,
    layoutKind,
    liveLetterPage || findLiveLetterPreview()
  );
  await printHtmlDocument(documentHtml, { title: sanitizeFilename(subject) });
}

export async function printLetter(contentHtml, { subject, layoutKind, liveLetterPage } = {}) {
  const documentHtml = await buildExportDocument(
    contentHtml,
    layoutKind,
    liveLetterPage || findLiveLetterPreview()
  );
  await printHtmlDocument(documentHtml, { title: sanitizeFilename(subject) });
}
