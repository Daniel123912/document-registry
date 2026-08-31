export const LAYOUT_KIND_BAKOR = "bakor_letter";

export const OUTGOING_NUMBER_PLACEHOLDER = "{{outgoingNumber}}";
export const OUTGOING_DATE_PLACEHOLDER = "{{outgoingDate}}";

export const OUTGOING_REQUISITES_SNIPPET =
  `<p><strong>Исх. № ${OUTGOING_NUMBER_PLACEHOLDER} от ${OUTGOING_DATE_PLACEHOLDER}</strong></p>`;

const OUTGOING_NUMBER_PLACEHOLDER_PATTERN = /\{\{\s*outgoingNumber\s*\}\}/gi;
const OUTGOING_DATE_PLACEHOLDER_PATTERN = /\{\{\s*outgoingDate\s*\}\}/gi;

const OUTGOING_REQUISITES_HTML_PATTERN =
  /Исх\.(?:\s|&nbsp;|<[^>]+>)*№(?:\s|&nbsp;|<[^>]+>)*\d+(?:\s|&nbsp;|<[^>]+>)*от(?:\s|&nbsp;|<[^>]+>)*\d{2}\.\d{2}\.\d{4}/gi;

export const LETTER_PAGE_HEIGHT_MM = 297;
export const LETTER_PAGE_WIDTH_MM = 210;
export const LETTER_PAGE_GAP_PX = 24;

export const LETTER_HEADER_IMAGE = "/letter/header-photo.png";
export const LETTER_FOOTER_IMAGE = "/letter/footer-signature-block.png";

const IMPORT_PAGE_BREAK_CLASS = "import-page-break";
const PDF_IMPORTED_PAGE_PATTERN =
  /<p style="margin:0 0 16px;"><img[\s\S]*?alt="Страница \d+"[\s\S]*?\/><\/p>/gi;
const IMPORT_PAGE_BREAK_HTML_PATTERN = new RegExp(
  `<div class="${IMPORT_PAGE_BREAK_CLASS}"[^>]*>\\s*</div>`,
  "gi"
);

export function buildLetterPageTurnSnippet({ auto = false } = {}) {
  const autoAttr = auto ? ' data-auto-page-break="true"' : ' data-manual-page-break="true"';

  return `<div class="letter-page-turn"${autoAttr} contenteditable="false" aria-hidden="true" title="Разрыв страницы"><div class="letter-page-turn__footer-space"></div><div class="letter-page-turn__gap"></div><div class="letter-page-turn__header-space"></div></div>`;
}

export function insertLetterPageTurnsForImportedPdf(html) {
  PDF_IMPORTED_PAGE_PATTERN.lastIndex = 0;
  const pages = String(html || "").match(PDF_IMPORTED_PAGE_PATTERN);

  if (!pages || pages.length < 2) {
    return html || "";
  }

  const turn = buildLetterPageTurnSnippet();
  return pages.join(`\n${turn}\n`);
}

export function replaceImportedDocxPageBreaks(html) {
  IMPORT_PAGE_BREAK_HTML_PATTERN.lastIndex = 0;

  if (!IMPORT_PAGE_BREAK_HTML_PATTERN.test(String(html || ""))) {
    return html || "";
  }

  IMPORT_PAGE_BREAK_HTML_PATTERN.lastIndex = 0;
  const turn = buildLetterPageTurnSnippet();
  return String(html || "").replace(IMPORT_PAGE_BREAK_HTML_PATTERN, turn);
}

export function applyBakorLetterPagesFromImport(html, { pageCount, source } = {}) {
  if (!html || !pageCount || pageCount < 2) {
    return html || "";
  }

  if (source === "pdf") {
    return insertLetterPageTurnsForImportedPdf(html);
  }

  if (source === "docx") {
    const withBreaks = replaceImportedDocxPageBreaks(html);
    return withBreaks !== html ? withBreaks : html;
  }

  return html;
}

export const LETTER_PAGE_CSS = `
.letter-page {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  box-sizing: border-box;
  background: #fff;
  color: #0f1115;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.15;
  overflow: visible;
  box-shadow:
    0 1px 2px rgba(43, 58, 74, 0.08),
    0 12px 32px rgba(43, 58, 74, 0.12);
}

.letter-page + .letter-page {
  margin-top: 24px;
}

.letter-page__header-img,
.letter-page__footer-img {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  user-select: none;
  display: block;
}

.letter-page__table {
  width: 100%;
  border-collapse: collapse;
}

.letter-page__table .letter-page__header-cell,
.letter-page__table .letter-page__footer-cell {
  padding: 0;
  vertical-align: top;
  line-height: 0;
}

.letter-page__table .letter-page__header-cell {
  height: 1.77in;
}

.letter-page__table .letter-page__header-img,
.letter-page__table .letter-page__footer-img {
  position: static !important;
  left: auto !important;
  top: auto !important;
  bottom: auto !important;
  margin: 0;
}

.letter-page__header-img {
  width: 8.33in;
  height: 1.77in;
  left: calc(3cm - 1.21in);
  top: 0;
}

.letter-page__footer-img {
  width: 4.12in;
  height: 1.24in;
  left: calc(3cm - 1.03in);
  top: calc(297mm - 2cm - 1.24in + 0.07in);
  bottom: auto;
}

.letter-page__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  padding: 1.77in 1.5cm calc(2cm + 1.24in + 0.5cm) 3cm;
  color: #0f1115;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.15;
}

.letter-page__content--continuation {
  padding-top: 0;
}

.letter-page__content p {
  margin: 0 0 0.35em;
}

.letter-page__content .letter-requisites {
  text-align: right;
  margin: 0 0 1.2em;
}

.letter-page__content .letter-requisites p {
  margin: 0;
}

.letter-page__content .letter-greeting {
  text-align: center;
  font-weight: 700;
  margin: 0 0 1em;
}

.letter-page__content .letter-section-title {
  font-weight: 700;
  margin: 1em 0 0.35em;
}

.letter-page__content .letter-body-justify {
  text-align: justify;
  margin: 0 0 0.8em;
}

.letter-page__content .letter-subsection {
  margin: 0.35em 0;
  text-align: justify;
}

.letter-page__content ul {
  margin: 0.2em 0 0.8em;
  padding-left: 1.4em;
}

.letter-page__content li {
  margin: 0.15em 0;
  text-align: justify;
}

.letter-page__content a {
  color: #0563c1;
  text-decoration: underline;
}

.letter-page__content .letter-signoff {
  margin-top: 1.2em;
}

/* Разрыв страницы: отступ под подвал, зазор между листами, отступ под шапку */
.letter-page__content .letter-page-turn {
  display: block;
  margin: 0 -1.5cm 0 -3cm;
  break-before: page;
  page-break-before: always;
  pointer-events: none;
  user-select: none;
  outline: none;
  border: none;
}

.letter-page-turn__footer-space {
  min-height: 0;
}

.letter-page-turn__gap {
  height: 24px;
  background: transparent;
}

.letter-page-turn__label {
  display: none;
}

.letter-page-turn__header-space {
  height: 1.77in;
}

@media print {
  @page {
    size: 210mm 297mm;
    margin: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    width: 210mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .letter-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0;
    box-shadow: none;
    overflow: visible;
    break-after: page;
    page-break-after: always;
  }

  .letter-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .letter-page + .letter-page {
    margin-top: 0;
  }

  .letter-page__header-cell,
  .letter-page__header-cell img,
  .letter-page__footer-cell,
  .letter-page__footer-cell img {
    margin: 0;
    padding: 0;
  }

  .letter-page__table .letter-page__header-cell {
    height: 1.77in !important;
  }

  .letter-page__content-cell > :first-child {
    margin-top: 0;
  }

  .letter-page__header-img,
  .letter-page__footer-img {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .letter-page__table .letter-page__header-img,
  .letter-page__table .letter-page__footer-img {
    position: static !important;
    display: block !important;
    left: auto !important;
    top: auto !important;
    bottom: auto !important;
  }

  .letter-page__content .letter-page-turn {
    break-before: page;
    page-break-before: always;
  }

  .letter-page-turn__gap {
    background: transparent;
  }

  .letter-page__content img,
  .letter-page__header-img,
  .letter-page__footer-img {
    max-width: none;
  }
}
`.trim();

export const DEFAULT_BAKOR_LETTER_HTML = `
<div class="letter-requisites">
  <p><strong>Кому:</strong> ООО РЦ «Автодилер»</p>
  <p><strong>От:</strong> ООО «Компания Бакор»</p>
  <p><strong>Адрес:</strong> 115522, г. Москва, вн.тер.г. муниципальный округ<br>
  Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II,<br>
  этаж 1, ком. 2, офис Б5Р</p>
  <p><strong>E-mail:</strong> <a href="mailto:vv@bakor.ru">vv@bakor.ru</a></p>
  <p><strong>Исх. № {{outgoingNumber}} от {{outgoingDate}}</strong></p>
</div>

<p class="letter-greeting">Уважаемый Сергей Александрович!</p>

<p class="letter-body-justify">Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, связанного с претензией по топливному баку, проведён анализ представленных материалов и технической документации.</p>

<p class="letter-section-title">1. Запрошенные для объективной оценки документы</p>
<p class="letter-body-justify">Для проведения объективной оценки и подготовки заключения производителя были запрошены следующие документы:</p>
<ul>
  <li>документ, подтверждающий приобретение изделия (чек, накладная, договор);</li>
  <li>фотоматериалы сварных швов и мест возможного протечения;</li>
  <li>фотографии условий установки и крепления бака на транспортном средстве;</li>
  <li>сведения о пробеге, наработке и условиях эксплуатации транспортного средства.</li>
</ul>

<p class="letter-section-title">2. Фактически представленные материалы</p>
<p class="letter-body-justify">По состоянию на дату рассмотрения обращения представлены следующие материалы:</p>
<ul>
  <li>фотографии общего вида изделия;</li>
  <li>копия сопроводительного документа;</li>
  <li>письмо с описанием обстоятельств возникновения претензии.</li>
</ul>
<p class="letter-body-justify">Представленный комплект материалов не содержит полного перечня сведений, необходимых для проведения объективной экспертизы.</p>

${buildLetterPageTurnSnippet()}

<p class="letter-section-title">3. Анализ и заключение производителя</p>
<p class="letter-subsection">3.1. По результатам анализа представленных фотоматериалов сообщаем, что заявленное протечение топливного бака на предоставленных изображениях не подтверждается. Характер имеющихся следов указывает на воздействие эксплуатационных факторов, а не на производственный дефект.</p>
<p class="letter-subsection">3.2. На основании визуального осмотра представленных материалов установлено, что повреждение носит механический характер и не может быть отнесено к скрытым производственным дефектам изделия.</p>
<p class="letter-subsection">3.3. В связи с этим проведение полноценной технической экспертизы в отсутствие изделия и полного комплекта документов невозможно по следующим причинам:</p>
<ul>
  <li>отсутствуют фотоматериалы, подтверждающие факт протечения в момент эксплуатации;</li>
  <li>не представлены сведения об условиях монтажа, крепления и эксплуатации бака;</li>
  <li>отсутствует акт дефектации и заключение сервисной организации.</li>
</ul>

<p class="letter-section-title">4. Решение</p>
<p class="letter-body-justify">На основании изложенного, рассматриваемое обращение не может быть отнесено к гарантийному случаю. Окончательное решение по существу претензии может быть принято только после предоставления недостающих документов и проведения полной технической оценки изделия.</p>

<p class="letter-signoff">С уважением, ООО «Компания БАКОР»</p>
`.trim();

export function formatOutgoingDate(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function buildOutgoingRequisitesLine(outgoingNumber, outgoingDate) {
  return `Исх. № ${outgoingNumber} от ${formatOutgoingDate(outgoingDate)}`;
}

export function hasOutgoingRequisitesMarkers(html) {
  if (!html) {
    return false;
  }

  OUTGOING_NUMBER_PLACEHOLDER_PATTERN.lastIndex = 0;
  OUTGOING_DATE_PLACEHOLDER_PATTERN.lastIndex = 0;
  OUTGOING_REQUISITES_HTML_PATTERN.lastIndex = 0;

  return (
    OUTGOING_NUMBER_PLACEHOLDER_PATTERN.test(html) ||
    OUTGOING_DATE_PLACEHOLDER_PATTERN.test(html) ||
    OUTGOING_REQUISITES_HTML_PATTERN.test(html)
  );
}

export function normalizeOutgoingRequisitesInTemplate(html) {
  if (!html) {
    return html || "";
  }

  OUTGOING_REQUISITES_HTML_PATTERN.lastIndex = 0;
  return html.replace(
    OUTGOING_REQUISITES_HTML_PATTERN,
    `Исх. № ${OUTGOING_NUMBER_PLACEHOLDER} от ${OUTGOING_DATE_PLACEHOLDER}`
  );
}

export function applyOutgoingRequisites(html, outgoingNumber, outgoingDate) {
  if (!html || !outgoingNumber || !outgoingDate) {
    return html || "";
  }

  const line = buildOutgoingRequisitesLine(outgoingNumber, outgoingDate);
  const formattedDate = formatOutgoingDate(outgoingDate);

  let result = html
    .replace(OUTGOING_NUMBER_PLACEHOLDER_PATTERN, String(outgoingNumber))
    .replace(OUTGOING_DATE_PLACEHOLDER_PATTERN, formattedDate);

  OUTGOING_REQUISITES_HTML_PATTERN.lastIndex = 0;
  result = result.replace(OUTGOING_REQUISITES_HTML_PATTERN, line);

  return result;
}

export function isBakorLetterLayout(layoutKind) {
  return layoutKind === LAYOUT_KIND_BAKOR;
}

function stripHtmlFragment(fragment) {
  return String(fragment || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractLetterRecipientFromHtml(html) {
  if (!html) {
    return "";
  }

  const patterns = [
    /<strong>\s*Кому:\s*<\/strong>\s*([\s\S]*?)<\/p>/i,
    /<b>\s*Кому:\s*<\/b>\s*([\s\S]*?)<\/p>/i,
    /Кому:\s*<\/(?:strong|b)>\s*([\s\S]*?)<\/p>/i,
    /Кому:\s*([^<\n\r]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = stripHtmlFragment(match[1]);
      if (value) {
        return value;
      }
    }
  }

  return "";
}

export function resolveLetterSubject({ layoutKind, htmlBody, subject }) {
  if (!isBakorLetterLayout(layoutKind)) {
    return String(subject || "").trim();
  }

  return extractLetterRecipientFromHtml(htmlBody) || String(subject || "").trim();
}

export function splitHtmlAtPageTurns(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");

  const parts = [];
  let buffer = document.createElement("div");

  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("letter-page-turn")) {
      if (buffer.childNodes.length > 0) {
        parts.push(buffer.innerHTML.trim());
        buffer = document.createElement("div");
      }
      continue;
    }

    buffer.appendChild(node.cloneNode(true));
  }

  if (buffer.childNodes.length > 0) {
    parts.push(buffer.innerHTML.trim());
  }

  return parts.filter(Boolean);
}

const LETTER_HEADER_IMG_STYLE =
  "display:block;position:static;width:8.33in;height:1.77in;max-width:none;border:0;margin:0;padding:0;";
const LETTER_FOOTER_IMG_STYLE =
  "display:block;position:static;width:4.12in;height:1.24in;max-width:none;border:0;margin:0;padding:0;";

function stripPageTurnArtifacts(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  container
    .querySelectorAll(".letter-page-turn, .letter-page-turn__footer-space, .letter-page-turn__gap, .letter-page-turn__header-space")
    .forEach((node) => node.remove());
  return container.innerHTML.trim();
}

function buildLetterPageShell(
  contentHtml,
  { headerSrc, footerSrc, isLastPage = true } = {}
) {
  const header = headerSrc || LETTER_HEADER_IMAGE;
  const footer = footerSrc || LETTER_FOOTER_IMAGE;
  const pageBreakStyle = isLastPage ?
    ""
  : "page-break-after:always;mso-page-break-after:always;";
  const safeContentHtml = stripPageTurnArtifacts(contentHtml);

  return `<div class="letter-page" style="${pageBreakStyle}">
  <table class="letter-page__table" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:210mm;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td class="letter-page__header-cell" style="height:1.77in;padding:0 0 0 calc(3cm - 1.21in);vertical-align:top;line-height:0;font-size:0;">
        <img class="letter-page__header-img" src="${header}" alt="" aria-hidden="true" width="599" height="127" style="${LETTER_HEADER_IMG_STYLE}" />
      </td>
    </tr>
    <tr>
      <td class="letter-page__content-cell" style="padding:0 1.5cm 0.5cm 3cm;vertical-align:top;font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.15;color:#0f1115;">
        ${safeContentHtml}
      </td>
    </tr>
    <tr>
      <td class="letter-page__footer-cell" style="height:1.5in;padding:0 1.5cm 0.5cm 3cm;vertical-align:bottom;line-height:0;">
        <img class="letter-page__footer-img" src="${footer}" alt="" aria-hidden="true" width="296" height="89" style="${LETTER_FOOTER_IMG_STYLE}" />
      </td>
    </tr>
  </table>
</div>`;
}

export function wrapLetterPagesHtml(pages, { headerSrc, footerSrc } = {}) {
  const safePages = (pages || []).map((part) => String(part || "").trim()).filter(Boolean);

  if (safePages.length <= 1) {
    return buildLetterPageShell(safePages[0] || "", { headerSrc, footerSrc });
  }

  return safePages
    .map((pageHtml, index) =>
      buildLetterPageShell(pageHtml, {
        headerSrc,
        footerSrc,
        isLastPage: index === safePages.length - 1,
      })
    )
    .join("\n");
}

export function wrapLetterBodyHtml(contentHtml, { headerSrc, footerSrc } = {}) {
  return wrapLetterPagesHtml(splitHtmlAtPageTurns(contentHtml), { headerSrc, footerSrc });
}

export function buildLetterPrintDocument(contentHtml, { headerSrc, footerSrc } = {}) {
  const body = wrapLetterBodyHtml(contentHtml, { headerSrc, footerSrc });
  return buildLetterPrintShell(body);
}

export function buildLetterPrintShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Печать письма</title>
    <style>${LETTER_PAGE_CSS}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}
