import { Fragment, useCallback, useMemo, useState } from "react";
import { TYPE_OPTIONS } from "../constants";
import { flattenFoldersForSelect, folderPathLabels } from "../utils/folders";

function buildReportSections(reportRows, folders) {
  const sections = [];

  for (const option of TYPE_OPTIONS) {
    const typeRows = reportRows.filter((row) => row.type === option.value);
    if (!typeRows.length) {
      continue;
    }

    const byFolderKey = new Map();
    for (const row of typeRows) {
      const key = row.folderId == null ? "root" : String(row.folderId);
      if (!byFolderKey.has(key)) {
        byFolderKey.set(key, []);
      }
      byFolderKey.get(key).push(row);
    }

    for (const rows of byFolderKey.values()) {
      rows.sort((left, right) => (left.title || "").localeCompare(right.title || "", "ru"));
    }

    const subgroups = [];
    const rootRows = byFolderKey.get("root");
    if (rootRows?.length) {
      subgroups.push({ key: "root", label: null, rows: rootRows });
    }

    const flatFolders = flattenFoldersForSelect(folders, option.value);
    const seenFolderKeys = new Set(rootRows?.length ? ["root"] : []);

    for (const folder of flatFolders) {
      const key = String(folder.id);
      const rows = byFolderKey.get(key);
      if (!rows?.length) {
        continue;
      }
      seenFolderKeys.add(key);
      subgroups.push({
        key,
        label: folderPathLabels(folders, folder.id).join(" / "),
        rows,
      });
    }

    for (const [key, rows] of byFolderKey) {
      if (seenFolderKeys.has(key)) {
        continue;
      }
      subgroups.push({ key: `orphan-${key}`, label: `Папка #${key}`, rows });
    }

    sections.push({
      typeValue: option.value,
      typeLabel: option.label,
      subgroups,
      rowCount: typeRows.length,
    });
  }

  return sections;
}

function ackPercent(row) {
  if (!row.assignedCount) {
    return 0;
  }
  return Math.round((row.acknowledgedCount / row.assignedCount) * 100);
}

function reportStatus(row) {
  if (!row.assignedCount) {
    return { label: "Не назначен", tone: "neutral" };
  }
  if (row.pendingCount === 0) {
    return { label: "Все ознакомились", tone: "ok" };
  }
  return { label: `Ожидают ${row.pendingCount}`, tone: "warn" };
}

function progressBarClass(row) {
  const percent = ackPercent(row);
  if (!row.assignedCount) {
    return "empty";
  }
  if (percent >= 100) {
    return "complete";
  }
  if (percent > 0) {
    return "partial";
  }
  return "none";
}

function ReportStatusBadge({ row }) {
  const status = reportStatus(row);
  if (status.tone === "neutral") {
    return <span className="report-status-neutral">{status.label}</span>;
  }
  return <span className={`status ${status.tone}`}>{status.label}</span>;
}

function ReportGroupToggle({ open, onClick, label, count, nested = false }) {
  return (
    <button
      type="button"
      className={nested ? "report-group-toggle nested" : "report-group-toggle"}
      onClick={onClick}
      aria-expanded={open}
    >
      <span className={open ? "chevron open" : "chevron"} aria-hidden="true" />
      <span className="report-group-label">{label}</span>
      {count != null ? <span className="report-group-count">{count}</span> : null}
    </button>
  );
}

export default function ReportTable({ listTitle, reportRows, folders }) {
  const sections = useMemo(
    () => buildReportSections(reportRows, folders),
    [folders, reportRows]
  );

  const [collapsedTypes, setCollapsedTypes] = useState(() => new Set());
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());

  const folderKeys = useMemo(
    () =>
      sections.flatMap((section) =>
        section.subgroups
          .filter((subgroup) => subgroup.label)
          .map((subgroup) => `${section.typeValue}:${subgroup.key}`)
      ),
    [sections]
  );

  const toggleType = useCallback((typeValue) => {
    setCollapsedTypes((current) => {
      const next = new Set(current);
      if (next.has(typeValue)) {
        next.delete(typeValue);
      } else {
        next.add(typeValue);
      }
      return next;
    });
  }, []);

  const toggleFolder = useCallback((typeValue, subgroupKey) => {
    const id = `${typeValue}:${subgroupKey}`;
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedTypes(new Set());
    setCollapsedFolders(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedTypes(new Set(sections.map((section) => section.typeValue)));
    setCollapsedFolders(new Set(folderKeys));
  }, [folderKeys, sections]);

  const hasRows = sections.some((section) =>
    section.subgroups.some((subgroup) => subgroup.rows.length > 0)
  );

  const summary = useMemo(() => {
    let documents = 0;
    let pendingTotal = 0;
    let completeDocuments = 0;

    for (const row of reportRows) {
      documents += 1;
      pendingTotal += row.pendingCount;
      if (row.assignedCount > 0 && row.pendingCount === 0) {
        completeDocuments += 1;
      }
    }

    return { documents, pendingTotal, completeDocuments };
  }, [reportRows]);

  return (
    <section className="list-card report-page">
      <h2 className="list-title">{listTitle}</h2>
      <p className="list-hint">
        Опубликованные документы и ознакомление сотрудников с актуальной версией. Группировка по типу и
        папке.
      </p>
      {hasRows ? (
        <>
          <div className="report-summary">
            <div className="report-summary-item">
              <span className="report-summary-value">{summary.documents}</span>
              <span className="report-summary-label">документов</span>
            </div>
            <div className="report-summary-item ok">
              <span className="report-summary-value">{summary.completeDocuments}</span>
              <span className="report-summary-label">полностью ознакомлены</span>
            </div>
            <div className="report-summary-item warn">
              <span className="report-summary-value">{summary.pendingTotal}</span>
              <span className="report-summary-label">ожидают ознакомления</span>
            </div>
          </div>
          <div className="report-table-toolbar">
            <button type="button" className="btn primary" onClick={expandAll}>
              Развернуть все
            </button>
            <button type="button" className="btn cancel" onClick={collapseAll}>
              Свернуть все
            </button>
          </div>
          <table className="doc-table report-table">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Версия</th>
                <th>Ознакомление</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const typeOpen = !collapsedTypes.has(section.typeValue);

                return (
                  <Fragment key={`section-${section.typeValue}`}>
                    <tr className="report-section-type">
                      <td colSpan={4}>
                        <ReportGroupToggle
                          open={typeOpen}
                          onClick={() => toggleType(section.typeValue)}
                          label={section.typeLabel}
                          count={section.rowCount}
                        />
                      </td>
                    </tr>
                    {typeOpen
                      ? section.subgroups.map((subgroup) => {
                          const folderId = `${section.typeValue}:${subgroup.key}`;
                          const folderOpen =
                            !subgroup.label || !collapsedFolders.has(folderId);

                          return (
                            <Fragment key={`${section.typeValue}-sub-${subgroup.key}`}>
                              {subgroup.label ? (
                                <tr className="report-section-folder">
                                  <td colSpan={4}>
                                    <ReportGroupToggle
                                      open={folderOpen}
                                      nested
                                      onClick={() =>
                                        toggleFolder(section.typeValue, subgroup.key)
                                      }
                                      label={subgroup.label}
                                      count={subgroup.rows.length}
                                    />
                                  </td>
                                </tr>
                              ) : null}
                              {folderOpen
                                ? subgroup.rows.map((row) => (
                                    <tr
                                      key={row.id}
                                      className={
                                        subgroup.label
                                          ? "report-data-row nested"
                                          : "report-data-row"
                                      }
                                    >
                                      <td>
                                        <div className="doc-name">{row.title}</div>
                                      </td>
                                      <td className="report-version-cell">v{row.activeVersionNo}</td>
                                      <td className="report-ack-cell">
                                        {row.assignedCount ? (
                                          <>
                                            <div className="ack-progress report-ack-progress">
                                              <div
                                                className={`ack-progress-bar ${progressBarClass(row)}`}
                                                style={{ width: `${ackPercent(row)}%` }}
                                              />
                                            </div>
                                            <div className="report-ack-meta">
                                              <span className="report-ack-counts">
                                                {row.acknowledgedCount} из {row.assignedCount}
                                              </span>
                                              {row.pendingCount > 0 ? (
                                                <span className="report-ack-pending">
                                                  · ожидают {row.pendingCount}
                                                </span>
                                              ) : null}
                                            </div>
                                          </>
                                        ) : (
                                          <span className="muted">Никто не назначен</span>
                                        )}
                                      </td>
                                      <td>
                                        <ReportStatusBadge row={row} />
                                      </td>
                                    </tr>
                                  ))
                                : null}
                            </Fragment>
                          );
                        })
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <div className="empty">Отчетов пока нет</div>
      )}
    </section>
  );
}
