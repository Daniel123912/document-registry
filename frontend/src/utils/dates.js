export function toIsoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString("ru-RU");
}

export function toIsoDateValue(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntilTrashPurge(deletedAt, retentionDays = 30) {
  if (!deletedAt) {
    return retentionDays;
  }
  const deleted = new Date(deletedAt);
  if (Number.isNaN(deleted.getTime())) {
    return retentionDays;
  }
  const purgeDate = new Date(deleted);
  purgeDate.setDate(purgeDate.getDate() + retentionDays);
  const daysLeft = Math.ceil((purgeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(daysLeft) ? Math.max(0, daysLeft) : retentionDays;
}
