import { useEffect, useMemo, useRef, useState } from "react";
import { collapseUnchanged } from "../utils/documentDiff";

function LineText({ side }) {
  if (!side || side.type === "empty") {
    return <span className="cursor-diff-empty">&nbsp;</span>;
  }
  if (Array.isArray(side.parts) && side.parts.length) {
    return (
      <>
        {side.parts.map((part, index) =>
          part.type === "eq" ? (
            <span key={index}>{part.text}</span>
          ) : (
            <span key={index} className={`cursor-diff-token is-${part.type}`}>
              {part.text}
            </span>
          )
        )}
      </>
    );
  }
  return <span>{side.text || "\u00a0"}</span>;
}

function Gutter({ side, marker }) {
  return (
    <div className={`cursor-diff-gutter is-${side?.type || "empty"}`}>
      <span className="cursor-diff-line-no">{side?.lineNo || ""}</span>
      <span className="cursor-diff-marker">{marker}</span>
    </div>
  );
}

export default function DiffViewer({
  rows,
  added = 0,
  removed = 0,
  leftLabel,
  rightLabel,
  filename,
}) {
  const [mode, setMode] = useState("split");
  const [expanded, setExpanded] = useState(() => new Set());
  const [changeIndex, setChangeIndex] = useState(0);
  const bodyRef = useRef(null);

  useEffect(() => {
    setExpanded(new Set());
    setChangeIndex(0);
  }, [rows]);

  const visibleRows = useMemo(() => {
    const collapsed = collapseUnchanged(rows);
    const out = [];
    collapsed.forEach((row) => {
      if (row.kind === "collapse") {
        if (expanded.has(row.key)) {
          out.push(...row.hidden);
        }
        out.push(row);
        return;
      }
      out.push(row);
    });
    return out;
  }, [rows, expanded]);

  const changeKeys = useMemo(
    () =>
      visibleRows
        .map((row, index) => (row.kind === "eq" || row.kind === "collapse" ? -1 : index))
        .filter((index) => index >= 0),
    [visibleRows]
  );

  function scrollToChange(index) {
    const parent = bodyRef.current;
    if (!parent || !changeKeys.length) {
      return;
    }
    const current = Math.min(index, changeKeys.length - 1);
    const node = parent.querySelector(`[data-diff-row="${changeKeys[current]}"]`);
    if (!node) {
      return;
    }
    const parentRect = parent.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    parent.scrollTop += nodeRect.top - parentRect.top - parent.clientHeight / 2 + nodeRect.height / 2;
  }

  function goToChange(delta) {
    if (!changeKeys.length) {
      return;
    }
    setChangeIndex((current) => {
      let next = current + delta;
      if (next < 0) {
        next = changeKeys.length - 1;
      } else if (next >= changeKeys.length) {
        next = 0;
      }
      requestAnimationFrame(() => scrollToChange(next));
      return next;
    });
  }

  function toggleCollapse(key) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className={`cursor-diff is-${mode}`}>
      <header className="cursor-diff-bar">
        <div className="cursor-diff-file">
          <strong>{filename}</strong>
          <span>
            {leftLabel} → {rightLabel}
          </span>
        </div>
        <div className="cursor-diff-stats">
          <span className="is-add">+{added}</span>
          <span className="is-del">-{removed}</span>
        </div>
        <div className="cursor-diff-modes">
          <button
            type="button"
            className={mode === "split" ? "active" : ""}
            onClick={() => setMode("split")}
          >
            Рядом
          </button>
          <button
            type="button"
            className={mode === "unified" ? "active" : ""}
            onClick={() => setMode("unified")}
          >
            Строки
          </button>
        </div>
        <div className="cursor-diff-nav">
          <button type="button" onClick={() => goToChange(-1)} disabled={!changeKeys.length}>
            ↑
          </button>
          <span>
            {changeKeys.length ? `${Math.min(changeIndex, changeKeys.length - 1) + 1}/${changeKeys.length}` : "0/0"}
          </span>
          <button type="button" onClick={() => goToChange(1)} disabled={!changeKeys.length}>
            ↓
          </button>
        </div>
      </header>

      <div className="cursor-diff-body" ref={bodyRef}>
        {mode === "split" ? (
          <div className="cursor-diff-split-head">
            <div>{leftLabel}</div>
            <div>{rightLabel}</div>
          </div>
        ) : null}

        {visibleRows.length === 0 ? (
          <div className="cursor-diff-same">Содержимое совпадает</div>
        ) : (
          visibleRows.map((row, index) => {
            if (row.kind === "collapse") {
              return (
                <button
                  key={row.key}
                  type="button"
                  className="cursor-diff-collapse"
                  onClick={() => toggleCollapse(row.key)}
                >
                  {expanded.has(row.key)
                    ? "Свернуть неизменённые строки"
                    : `${row.count} неизменённых строк`}
                </button>
              );
            }

            const isChange = row.kind !== "eq";
            const isCurrent = isChange && changeKeys[Math.min(changeIndex, changeKeys.length - 1)] === index;
            if (mode === "unified") {
              if (row.kind === "eq") {
                return (
                  <div
                    key={`u-${index}`}
                    className="cursor-diff-row is-eq"
                    data-diff-row={index}
                  >
                    <Gutter side={row.left} marker=" " />
                    <Gutter side={row.right} marker=" " />
                    <div className="cursor-diff-code">
                      <LineText side={row.right} />
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={`u-${index}`}
                  className={isCurrent ? "is-current" : ""}
                  data-diff-row={index}
                >
                  {row.left?.type && row.left.type !== "empty" ? (
                    <div className="cursor-diff-row is-del">
                      <Gutter side={row.left} marker="-" />
                      <div className="cursor-diff-gutter is-empty" />
                      <div className="cursor-diff-code">
                        <LineText side={row.left} />
                      </div>
                    </div>
                  ) : null}
                  {row.right?.type && row.right.type !== "empty" ? (
                    <div className="cursor-diff-row is-add">
                      <div className="cursor-diff-gutter is-empty" />
                      <Gutter side={row.right} marker="+" />
                      <div className="cursor-diff-code">
                        <LineText side={row.right} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <div
                key={`s-${index}`}
                className={`cursor-diff-split-row${isChange ? " is-change" : ""}${isCurrent ? " is-current" : ""}`}
                data-diff-row={index}
              >
                <div className={`cursor-diff-pane is-${row.left?.type || "empty"}`}>
                  <Gutter
                    side={row.left}
                    marker={row.left?.type === "del" ? "-" : " "}
                  />
                  <div className="cursor-diff-code">
                    <LineText side={row.left} />
                  </div>
                </div>
                <div className={`cursor-diff-pane is-${row.right?.type || "empty"}`}>
                  <Gutter
                    side={row.right}
                    marker={row.right?.type === "add" ? "+" : " "}
                  />
                  <div className="cursor-diff-code">
                    <LineText side={row.right} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
