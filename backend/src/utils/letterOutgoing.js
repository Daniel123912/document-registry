const OUTGOING_NUMBER_PLACEHOLDER = "{{outgoingNumber}}";
const OUTGOING_DATE_PLACEHOLDER = "{{outgoingDate}}";

const OUTGOING_NUMBER_PLACEHOLDER_PATTERN = /\{\{\s*outgoingNumber\s*\}\}/gi;
const OUTGOING_DATE_PLACEHOLDER_PATTERN = /\{\{\s*outgoingDate\s*\}\}/gi;

// Допускает HTML-теги между частями строки (после импорта из DOCX/PDF).
const OUTGOING_REQUISITES_HTML_PATTERN =
  /Исх\.(?:\s|&nbsp;|<[^>]+>)*№(?:\s|&nbsp;|<[^>]+>)*\d+(?:\s|&nbsp;|<[^>]+>)*от(?:\s|&nbsp;|<[^>]+>)*\d{2}\.\d{2}\.\d{4}/gi;

function serializeCalendarDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOutgoingDate(value) {
  const isoDate = serializeCalendarDate(value);
  if (!isoDate) {
    return value ? String(value) : "";
  }

  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function buildOutgoingRequisitesLine(outgoingNumber, outgoingDate) {
  return `Исх. № ${outgoingNumber} от ${formatOutgoingDate(outgoingDate)}`;
}

function hasOutgoingRequisitesMarkers(html) {
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

function normalizeOutgoingRequisitesInTemplate(html) {
  if (!html) {
    return html || "";
  }

  OUTGOING_REQUISITES_HTML_PATTERN.lastIndex = 0;
  return html.replace(
    OUTGOING_REQUISITES_HTML_PATTERN,
    `Исх. № ${OUTGOING_NUMBER_PLACEHOLDER} от ${OUTGOING_DATE_PLACEHOLDER}`
  );
}

function applyOutgoingRequisites(html, outgoingNumber, outgoingDate) {
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

module.exports = {
  OUTGOING_NUMBER_PLACEHOLDER,
  OUTGOING_DATE_PLACEHOLDER,
  serializeCalendarDate,
  formatOutgoingDate,
  buildOutgoingRequisitesLine,
  hasOutgoingRequisitesMarkers,
  normalizeOutgoingRequisitesInTemplate,
  applyOutgoingRequisites,
};
