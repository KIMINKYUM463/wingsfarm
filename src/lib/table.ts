/** 붙여넣은 표(엑셀 복사 = 탭 구분)·CSV 파일을 2차원 문자열 배열로 */

/** 따옴표("...") 안의 구분자·줄바꿈을 지키는 CSV/TSV 파서 */
export function parseDelimited(text: string, delimiter?: "," | "\t"): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const sep = delimiter ?? (source.split("\n", 1)[0].includes("\t") ? "\t" : ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/** 2차원 배열 → 탭 구분 글 (엑셀·구글시트·카톡에 붙여넣기용, 칸 안의 탭·줄바꿈은 공백으로) */
export const toTsv = (rows: string[][]) => rows.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");

/** 2차원 배열 → CSV (엑셀에서 한글이 깨지지 않도록 BOM 포함) */
export function toCsv(rows: string[][]) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
}
