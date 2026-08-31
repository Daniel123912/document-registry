const OUTGOING_NUMBER_PLACEHOLDER = "{{outgoingNumber}}";
const OUTGOING_DATE_PLACEHOLDER = "{{outgoingDate}}";

const OUTGOING_REQUISITES_HTML_PATTERN =
  /Исх\.\s*№\s*\d+\s*от\s*\d{2}\.\d{2}\.\d{4}/gi;

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

function applyOutgoingRequisites(html, outgoingNumber, outgoingDate) {
  if (!html || !outgoingNumber || !outgoingDate) {
    return html || "";
  }

  const line = buildOutgoingRequisitesLine(outgoingNumber, outgoingDate);
  const formattedDate = formatOutgoingDate(outgoingDate);

  let result = html
    .split(OUTGOING_NUMBER_PLACEHOLDER).join(String(outgoingNumber))
    .split(OUTGOING_DATE_PLACEHOLDER).join(formattedDate);

  result = result.replace(OUTGOING_REQUISITES_HTML_PATTERN, line);

  return result;
}

module.exports = {
  OUTGOING_NUMBER_PLACEHOLDER,
  OUTGOING_DATE_PLACEHOLDER,
  serializeCalendarDate,
  formatOutgoingDate,
  buildOutgoingRequisitesLine,
  applyOutgoingRequisites,
};
