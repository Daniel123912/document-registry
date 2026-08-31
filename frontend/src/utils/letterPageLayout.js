import {
  buildLetterPageTurnSnippet,
  LETTER_FOOTER_IMAGE,
  LETTER_HEADER_IMAGE,
  LETTER_PAGE_GAP_PX,
  LETTER_PAGE_HEIGHT_MM,
  LETTER_PAGE_WIDTH_MM,
  splitHtmlAtPageTurns,
} from "./bakorLetterTemplate";

const LETTER_PAGE_TURN_SELECTOR = ".letter-page-turn";
const LETTER_DOCUMENT_SELECTOR = ".letter-document";
const PAGE_OVERFLOW_TOLERANCE_PX = 4;
const MAX_AUTO_PAGE_BREAK_PASSES = 12;

let measureRoot = null;
let cachedLetterPageWidthPx = 0;

function getFallbackLetterPageWidthPx() {
  if (cachedLetterPageWidthPx > 0) {
    return cachedLetterPageWidthPx;
  }

  if (typeof document === "undefined") {
    return 0;
  }

  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-10000px;top:0;width:210mm;height:0;visibility:hidden;";
  document.body.appendChild(probe);
  cachedLetterPageWidthPx = probe.offsetWidth;
  probe.remove();
  return cachedLetterPageWidthPx;
}

function parseLengthPx(value, referencePx) {
  const raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }

  if (raw.endsWith("px")) {
    return parseFloat(raw);
  }

  if (raw.endsWith("mm")) {
    return (parseFloat(raw) / LETTER_PAGE_WIDTH_MM) * referencePx;
  }

  if (raw.endsWith("cm")) {
    return ((parseFloat(raw) * 10) / LETTER_PAGE_WIDTH_MM) * referencePx;
  }

  if (raw.endsWith("in")) {
    return parseFloat(raw) * referencePx * (25.4 / LETTER_PAGE_WIDTH_MM);
  }

  if (raw.endsWith("em")) {
    return parseFloat(raw) * 16;
  }

  const numeric = parseFloat(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getLetterPageHeightPx(referenceElement) {
  const widthPx = referenceElement?.offsetWidth || getFallbackLetterPageWidthPx();
  if (!widthPx) {
    return 0;
  }

  return widthPx * (LETTER_PAGE_HEIGHT_MM / LETTER_PAGE_WIDTH_MM);
}

export function stripAutoPageBreaks(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  container
    .querySelectorAll('.letter-page-turn[data-auto-page-break="true"]')
    .forEach((node) => node.remove());
  return container.innerHTML;
}

function getPageTopOffset(pageIndex, pageHeightPx) {
  return pageIndex * pageHeightPx + Math.max(0, pageIndex) * LETTER_PAGE_GAP_PX;
}

function getPageBottomOffset(pageIndex, pageHeightPx) {
  return getPageTopOffset(pageIndex, pageHeightPx) + pageHeightPx;
}

function getLetterHeaderSpacePx(editable) {
  return parseLengthPx("1.77in", editable?.offsetWidth || 0);
}

function getPageTurnBlockHeightPx(editable) {
  const footerSpace = parseLengthPx("1.5em", editable.offsetWidth) + parseLengthPx("1.24in", editable.offsetWidth);
  const headerSpace = getLetterHeaderSpacePx(editable);
  return footerSpace + LETTER_PAGE_GAP_PX + headerSpace;
}

function getContentHeightBefore(editable, target) {
  if (!target || !editable?.contains(target)) {
    return parseFloat(getComputedStyle(editable).paddingTop) || 0;
  }

  const editableRect = editable.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return targetRect.top - editableRect.top + editable.scrollTop;
}

function getBlockHeight(node) {
  const style = getComputedStyle(node);
  return (
    node.offsetHeight +
    (parseFloat(style.marginTop) || 0) +
    (parseFloat(style.marginBottom) || 0)
  );
}

function countPageTurnsBefore(editable, target) {
  let count = 0;

  for (let node = editable.firstElementChild; node && node !== target; node = node.nextElementSibling) {
    if (node.matches?.(LETTER_PAGE_TURN_SELECTOR)) {
      count += 1;
    }
  }

  return count;
}

function createPageTurnElement({ auto = false } = {}) {
  const template = document.createElement("template");
  template.innerHTML = buildLetterPageTurnSnippet({ auto }).trim();
  return template.content.firstElementChild;
}

function findOverflowBreakTarget(editable, pageHeightPx) {
  const turnBlockHeight = getPageTurnBlockHeightPx(editable);

  for (const child of editable.children) {
    if (child.matches(LETTER_PAGE_TURN_SELECTOR)) {
      continue;
    }

    const turnsBefore = countPageTurnsBefore(editable, child);
    const pageBoundary = getPageBottomOffset(turnsBefore, pageHeightPx);
    const contentTop = getContentHeightBefore(editable, child);
    const contentBottom = contentTop + getBlockHeight(child);

    if (contentBottom + turnBlockHeight > pageBoundary + PAGE_OVERFLOW_TOLERANCE_PX) {
      return child;
    }
  }

  return null;
}

function getMeasureEditable(referenceEditable) {
  if (!measureRoot) {
    measureRoot = document.createElement("div");
    measureRoot.className = "email-doc-editor__canvas email-doc-editor__canvas--letter";
    measureRoot.style.cssText =
      "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;z-index:-1;";
    measureRoot.innerHTML =
      '<div class="letter-document"><div class="letter-document__editor"><div class="letter-page__content"><div class="ck ck-editor"><div class="ck-editor__editable measure-editable"></div></div></div></div></div>';
    document.body.appendChild(measureRoot);
  }

  const documentRoot = measureRoot.querySelector(".letter-document");
  const editable = measureRoot.querySelector(".measure-editable");
  const widthPx = referenceEditable?.offsetWidth || documentRoot?.offsetWidth || 0;

  documentRoot.style.width = widthPx > 0 ? `${widthPx}px` : "210mm";

  return editable;
}

function serializeLetterPageNodes(nodes) {
  const wrap = document.createElement("div");
  nodes.forEach((node) => wrap.appendChild(node.cloneNode(true)));
  return wrap.innerHTML.trim();
}

function extractPagesFromEditable(editable) {
  if (!editable) {
    return [];
  }

  const pages = [];
  let buffer = [];

  for (const child of editable.children) {
    if (child.matches?.(LETTER_PAGE_TURN_SELECTOR)) {
      if (buffer.length > 0) {
        pages.push(serializeLetterPageNodes(buffer));
        buffer = [];
      }
      continue;
    }

    buffer.push(child);
  }

  if (buffer.length > 0) {
    pages.push(serializeLetterPageNodes(buffer));
  }

  return pages.filter(Boolean);
}

export function paginateLetterHtml(html, referenceEditable) {
  const editable = getMeasureEditable(referenceEditable);
  const finalHtml = computeHtmlWithAutoPageBreaks(html, referenceEditable);

  if (editable) {
    editable.innerHTML = finalHtml;
    const pageHeightPx = getLetterPageHeightPx(editable || referenceEditable);
    if (pageHeightPx) {
      layoutTurnMargins(editable, pageHeightPx);
    }
  }

  const pages = extractPagesFromEditable(editable);
  if (pages.length > 1) {
    return pages;
  }

  if (finalHtml.includes("letter-page-turn")) {
    const splitPages = splitHtmlAtPageTurns(finalHtml);
    if (splitPages.length > 1) {
      return splitPages;
    }
  }

  const fallback = stripAutoPageBreaks(finalHtml).trim();
  return fallback ? [fallback] : [];
}

export function computeHtmlWithAutoPageBreaks(html, referenceEditable) {
  const editable = getMeasureEditable(referenceEditable);
  const pageHeightPx = getLetterPageHeightPx(editable || referenceEditable);

  if (!editable || !pageHeightPx) {
    return stripAutoPageBreaks(html);
  }

  let workingHtml = stripAutoPageBreaks(html);

  for (let pass = 0; pass < MAX_AUTO_PAGE_BREAK_PASSES; pass += 1) {
    editable.innerHTML = workingHtml;
    layoutTurnMargins(editable, pageHeightPx);

    const turns = editable.querySelectorAll(LETTER_PAGE_TURN_SELECTOR);
    const allowedHeight =
      getPageBottomOffset(turns.length, pageHeightPx) + PAGE_OVERFLOW_TOLERANCE_PX;

    if (editable.scrollHeight <= allowedHeight) {
      break;
    }

    const target = findOverflowBreakTarget(editable, pageHeightPx);
    if (!target) {
      break;
    }

    editable.insertBefore(createPageTurnElement({ auto: true }), target);
    workingHtml = editable.innerHTML;
  }

  return workingHtml;
}

function layoutTurnMargins(editable, pageHeightPx) {
  if (!editable || !pageHeightPx) {
    return;
  }

  const turns = editable.querySelectorAll(LETTER_PAGE_TURN_SELECTOR);
  const headerSpacePx = getLetterHeaderSpacePx(editable);
  const gapPx = LETTER_PAGE_GAP_PX;
  const minTurnHeight = gapPx + headerSpacePx;

  for (let pass = 0; pass < 2; pass += 1) {
    turns.forEach((turn) => {
      turn.style.marginTop = "0";

      const footerEl = turn.querySelector(".letter-page-turn__footer-space");
      if (footerEl) {
        footerEl.style.height = "";
      }

      const beforeHeight = getContentHeightBefore(editable, turn);
      let pageIndex = countPageTurnsBefore(editable, turn);
      let nextPageTop = getPageTopOffset(pageIndex + 1, pageHeightPx);
      let contentAfterStart = nextPageTop + headerSpacePx;

      while (beforeHeight + minTurnHeight > contentAfterStart + PAGE_OVERFLOW_TOLERANCE_PX && pageIndex < 24) {
        pageIndex += 1;
        nextPageTop = getPageTopOffset(pageIndex + 1, pageHeightPx);
        contentAfterStart = nextPageTop + headerSpacePx;
      }

      const totalTurnHeight = Math.max(minTurnHeight, contentAfterStart - beforeHeight);
      const footerHeight = Math.max(0, totalTurnHeight - gapPx - headerSpacePx);

      if (footerEl) {
        footerEl.style.height = `${footerHeight}px`;
      }
    });
  }

  const pageCount = Math.max(1, turns.length + 1);
  const documentRoot = editable.closest(LETTER_DOCUMENT_SELECTOR);
  syncLetterPageSheets(documentRoot, pageCount);

  editable.style.minHeight = `${getPageBottomOffset(pageCount - 1, pageHeightPx)}px`;
}

export function syncLetterPageSheets(documentRoot, pageCount, { headerSrc, footerSrc } = {}) {
  const stack = documentRoot?.querySelector?.(".letter-document__stack");
  if (!stack) {
    return;
  }

  const header =
    headerSrc || documentRoot?.dataset?.letterHeader || LETTER_HEADER_IMAGE;
  const footer =
    footerSrc || documentRoot?.dataset?.letterFooter || LETTER_FOOTER_IMAGE;
  const safeCount = Math.max(1, pageCount);

  stack.replaceChildren();

  for (let index = 0; index < safeCount; index += 1) {
    const page = document.createElement("div");
    page.className = "letter-page letter-page--sheet";

    const headerImg = document.createElement("img");
    headerImg.className = "letter-page__header-img";
    headerImg.src = header;
    headerImg.alt = "";
    headerImg.draggable = false;

    const footerImg = document.createElement("img");
    footerImg.className = "letter-page__footer-img";
    footerImg.src = footer;
    footerImg.alt = "";
    footerImg.draggable = false;

    page.append(headerImg, footerImg);
    stack.appendChild(page);
  }
}

export function layoutLetterPageTurns(root, { autoPageBreaks = false } = {}) {
  const documentRoot =
    root?.closest?.(LETTER_DOCUMENT_SELECTOR) || root?.querySelector?.(LETTER_DOCUMENT_SELECTOR);
  const editable =
    root?.matches?.(".ck-editor__editable") ?
      root
    : root?.querySelector?.(".ck-editor__editable") ||
      documentRoot?.querySelector?.(".ck-editor__editable");

  if (!documentRoot || !editable) {
    return;
  }

  const pageHeightPx = getLetterPageHeightPx(editable);
  if (!pageHeightPx) {
    return;
  }

  if (autoPageBreaks) {
    editable.innerHTML = computeHtmlWithAutoPageBreaks(editable.innerHTML, editable);
  }

  layoutTurnMargins(editable, pageHeightPx);
}

export function insertLetterPageBreak(editorRef) {
  const editor = editorRef?.current;
  if (!editor) {
    return null;
  }

  const snippet = buildLetterPageTurnSnippet();
  const viewFragment = editor.data.processor.toView(snippet);
  const modelFragment = editor.data.toModel(viewFragment);

  editor.model.change(() => {
    const selection = editor.model.document.selection;
    const position = selection.getFirstPosition();
    editor.model.insertContent(modelFragment, position);
  });

  const editable = editor.ui.getEditableElement();
  const documentRoot = editable?.closest?.(LETTER_DOCUMENT_SELECTOR);
  if (documentRoot) {
    layoutLetterPageTurns(documentRoot, { autoPageBreaks: false });
  }

  return editor.getData();
}

function syncAutoPageBreaksInEditor(editor) {
  const editable = editor.ui.getEditableElement();
  if (!editable) {
    return false;
  }

  const currentHtml = editor.getData();
  const nextHtml = computeHtmlWithAutoPageBreaks(currentHtml, editable);

  if (nextHtml === currentHtml) {
    return false;
  }

  editor.setData(nextHtml);
  return true;
}

export function scheduleLetterPageLayout(root) {
  if (!root) {
    return () => {};
  }

  let frameId = 0;

  const run = () => {
    frameId = 0;
    layoutLetterPageTurns(root, { autoPageBreaks: false });
  };

  const schedule = () => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(run);
  };

  schedule();
  return schedule;
}

export function bindLetterPageLayout(editor, enabled, { autoPageBreaks = false } = {}) {
  if (!enabled || !editor) {
    return () => {};
  }

  const editable = editor.ui.getEditableElement();
  const documentRoot = editable?.closest(LETTER_DOCUMENT_SELECTOR);
  if (!documentRoot) {
    return () => {};
  }

  let applyingAutoBreaks = false;

  const schedule = () => {
    if (applyingAutoBreaks) {
      return;
    }

    requestAnimationFrame(() => {
      applyingAutoBreaks = true;
      try {
        if (autoPageBreaks) {
          syncAutoPageBreaksInEditor(editor);
        }
        layoutLetterPageTurns(documentRoot, { autoPageBreaks: false });
      } finally {
        applyingAutoBreaks = false;
      }
    });
  };

  const handleCtrlEnter = (keyEvtData, cancel) => {
    if (editor.isReadOnly) {
      return;
    }

    insertLetterPageBreak({ current: editor });
    cancel();
    schedule();
  };

  editor.model.document.on("change:data", schedule);
  editor.keystrokes.set("Ctrl+Enter", handleCtrlEnter);
  editor.keystrokes.set("Cmd+Enter", handleCtrlEnter);
  window.addEventListener("resize", schedule);
  schedule();

  return () => {
    editor.model.document.off("change:data", schedule);
    editor.keystrokes.set("Ctrl+Enter", null);
    editor.keystrokes.set("Cmd+Enter", null);
    window.removeEventListener("resize", schedule);
  };
}

export { splitHtmlAtPageTurns } from "./bakorLetterTemplate";