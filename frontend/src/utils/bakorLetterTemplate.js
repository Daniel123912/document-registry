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
export const LETTER_PAGE_GAP_PX = 24;

export const LETTER_HEADER_IMAGE = "/letter/header-photo.png";
export const LETTER_FOOTER_IMAGE = "/letter/footer-signature-block.png";

export const LETTER_PAGE_CSS = `
.letter-page {
  position: relative;
  width: 210mm;
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

.letter-page__header-img,
.letter-page__footer-img,
.letter-page-turn__footer,
.letter-page-turn__header {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  user-select: none;
  display: block;
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
  bottom: calc(2cm - 0.07in);
  top: auto;
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

/* Разрыв страницы: подвал стр.1 + зазор + шапка стр.2 */
.letter-page__content .letter-page-turn {
  display: block;
  position: relative;
  height: calc(24px + 1.77in);
  margin: calc(1.5em + 1.24in) -1.5cm 0 -3cm;
  border-top: 24px solid #e8edf3;
  break-before: page;
  page-break-before: always;
}

.letter-page-turn__footer {
  width: 4.12in;
  height: 1.24in;
  left: calc(3cm - 1.03in);
  top: calc(-1.24in - 1.5em);
}

.letter-page-turn__header {
  width: 8.33in;
  height: 1.77in;
  left: calc(3cm - 1.21in);
  top: 24px;
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
    margin: 0 auto;
    box-shadow: none;
    overflow: visible;
  }

  .letter-page__header-img,
  .letter-page__footer-img,
  .letter-page-turn__footer,
  .letter-page-turn__header {
    position: absolute;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .letter-page__content .letter-page-turn {
    border-top-color: transparent;
    break-before: page;
    page-break-before: always;
  }

  .letter-page__content img,
  .letter-page__header-img,
  .letter-page__footer-img,
  .letter-page-turn__footer,
  .letter-page-turn__header {
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

<div class="letter-page-turn" contenteditable="false">
  <img class="letter-page-turn__footer" src="/letter/footer-signature-block.png" alt="" />
  <img class="letter-page-turn__header" src="/letter/header-photo.png" alt="" />
</div>

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

export function wrapLetterBodyHtml(contentHtml, { headerSrc, footerSrc } = {}) {
  const header = headerSrc || LETTER_HEADER_IMAGE;
  const footer = footerSrc || LETTER_FOOTER_IMAGE;

  return `<div class="letter-page">
  <img class="letter-page__header-img" src="${header}" alt="" aria-hidden="true" />
  <img class="letter-page__footer-img" src="${footer}" alt="" aria-hidden="true" />
  <div class="letter-page__content">${contentHtml}</div>
</div>`;
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
