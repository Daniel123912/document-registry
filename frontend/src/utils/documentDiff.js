const MAX_LCS_CELLS = 250000;
const CONTEXT_LINES = 3;

function lcsOps(left, right) {
  const n = left.length;
  const m = right.length;
  if (!n && !m) {
    return [];
  }
  if (n * m > MAX_LCS_CELLS) {
    if (n === m && left.every((item, index) => item === right[index])) {
      return left.map((value) => ({ type: "eq", value }));
    }
    return [
      ...left.map((value) => ({ type: "del", value })),
      ...right.map((value) => ({ type: "add", value })),
    ];
  }

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      ops.push({ type: "eq", value: left[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", value: left[i] });
      i += 1;
    } else {
      ops.push({ type: "add", value: right[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "del", value: left[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", value: right[j] });
    j += 1;
  }
  return ops;
}

function pairChanges(ops) {
  const paired = [];
  let index = 0;
  while (index < ops.length) {
    const current = ops[index];
    if (current.type === "del" && ops[index + 1]?.type === "add") {
      paired.push({
        type: "chg",
        oldValue: current.value,
        newValue: ops[index + 1].value,
      });
      index += 2;
    } else {
      paired.push(current);
      index += 1;
    }
  }
  return paired;
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function htmlToLines(html) {
  const decoded = decodeEntities(
    String(html || "")
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|table|ul|ol)>/gi, "\n")
      .replace(/<td[^>]*>/gi, "\t")
      .replace(/<[^>]+>/g, "")
  );
  const lines = decoded
    .split("\n")
    .map((line) => line.replace(/\t+/g, " | ").replace(/[ \t]+$/g, ""));

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  return lines;
}

function tokenizeLine(line) {
  return String(line)
    .split(/(\s+)/)
    .filter((part) => part.length);
}

function wordParts(oldLine, newLine) {
  const ops = lcsOps(tokenizeLine(oldLine), tokenizeLine(newLine));
  const left = [];
  const right = [];
  for (const op of ops) {
    if (op.type === "eq") {
      left.push({ type: "eq", text: op.value });
      right.push({ type: "eq", text: op.value });
    } else if (op.type === "del") {
      left.push({ type: "del", text: op.value });
    } else {
      right.push({ type: "add", text: op.value });
    }
  }
  return { left, right };
}

export function buildLineDiff(oldLines, newLines) {
  const paired = pairChanges(lcsOps(oldLines, newLines));
  const rows = [];
  let oldNo = 1;
  let newNo = 1;
  let added = 0;
  let removed = 0;

  for (const op of paired) {
    if (op.type === "eq") {
      rows.push({
        kind: "eq",
        left: { type: "eq", text: op.value, lineNo: oldNo },
        right: { type: "eq", text: op.value, lineNo: newNo },
      });
      oldNo += 1;
      newNo += 1;
    } else if (op.type === "del") {
      rows.push({
        kind: "del",
        left: { type: "del", text: op.value, lineNo: oldNo },
        right: { type: "empty" },
      });
      oldNo += 1;
      removed += 1;
    } else if (op.type === "add") {
      rows.push({
        kind: "add",
        left: { type: "empty" },
        right: { type: "add", text: op.value, lineNo: newNo },
      });
      newNo += 1;
      added += 1;
    } else {
      const parts = wordParts(op.oldValue, op.newValue);
      rows.push({
        kind: "chg",
        left: { type: "del", text: op.oldValue, lineNo: oldNo, parts: parts.left },
        right: { type: "add", text: op.newValue, lineNo: newNo, parts: parts.right },
      });
      oldNo += 1;
      newNo += 1;
      added += 1;
      removed += 1;
    }
  }

  return { rows, added, removed };
}

export function collapseUnchanged(rows, context = CONTEXT_LINES) {
  const out = [];
  let index = 0;
  while (index < rows.length) {
    if (rows[index].kind !== "eq") {
      out.push(rows[index]);
      index += 1;
      continue;
    }
    let end = index;
    while (end < rows.length && rows[end].kind === "eq") {
      end += 1;
    }
    const run = end - index;
    if (run > context * 2 + 2) {
      out.push(...rows.slice(index, index + context));
      out.push({
        kind: "collapse",
        count: run - context * 2,
        hidden: rows.slice(index + context, end - context),
        key: `${index}-${end}`,
      });
      out.push(...rows.slice(end - context, end));
    } else {
      out.push(...rows.slice(index, end));
    }
    index = end;
  }
  return out;
}

export function sheetToLines(sheet, xlsx, maxRows = 150, maxCols = 40) {
  if (!sheet || !xlsx?.utils || !sheet["!ref"]) {
    return [];
  }
  const range = xlsx.utils.decode_range(sheet["!ref"]);
  const lastRow = Math.min(range.e.r, range.s.r + maxRows - 1);
  const lastCol = Math.min(range.e.c, range.s.c + maxCols - 1);
  const lines = [];

  for (let row = range.s.r; row <= lastRow; row += 1) {
    const cells = [];
    for (let col = range.s.c; col <= lastCol; col += 1) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: col })];
      if (!cell) {
        cells.push("");
        continue;
      }
      if (cell.w != null && String(cell.w).trim()) {
        cells.push(String(cell.w));
      } else if (cell.v == null) {
        cells.push("");
      } else {
        cells.push(String(cell.v));
      }
    }
    while (cells.length && !cells[cells.length - 1].trim()) {
      cells.pop();
    }
    lines.push(cells.join(" | "));
  }

  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  return lines;
}

export function previousVersionNo(versions, currentVersionNo) {
  const list = Array.isArray(versions) ? versions : [];
  const numbers = list.map((version) => version.versionNo);
  const older = numbers.filter((versionNo) => versionNo < currentVersionNo);
  if (older.length) {
    return Math.max(...older);
  }
  const other = numbers.filter((versionNo) => versionNo !== currentVersionNo);
  if (other.length) {
    return Math.min(...other);
  }
  return null;
}
