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

/** 머리글 비교용: 공백·기호를 빼고 소문자로 ("광고비(VAT포함)" → "광고비vat포함") */
export const normalizeHeader = (s: string) => s.replace(/[\s_\-()[\]/·.%]/g, "").toLowerCase();

/**
 * 머리글로 각 필드의 열을 찾는다.
 * 같은 열이 두 필드에 잡히지 않도록 "정확히 같은 이름"을 먼저 모두 배정한 뒤 "포함"으로 나머지를 채운다.
 */
export function matchColumns<F extends string>(headers: string[], fields: readonly { field: F; synonyms: string[] }[]) {
  const normalized = headers.map((h) => normalizeHeader(String(h ?? "")));
  const used = new Set<number>();
  const mapping: Partial<Record<F, number>> = {};
  const assign = (match: (header: string, synonym: string) => boolean) => {
    for (const { field, synonyms } of fields) {
      if (mapping[field] !== undefined) continue;
      for (const synonym of synonyms) {
        const index = normalized.findIndex((h, i) => !used.has(i) && h !== "" && match(h, normalizeHeader(synonym)));
        if (index >= 0) {
          mapping[field] = index;
          used.add(index);
          break;
        }
      }
    }
  };
  assign((h, s) => h === s);
  assign((h, s) => h.includes(s));
  return mapping;
}

/** 앞쪽 몇 줄 중 필드 이름이 가장 많이 잡히는 줄을 머리글로 본다 (제목·설명 줄이 있는 엑셀 대응) */
export function findHeaderRowBy(rows: string[][], score: (row: string[]) => number, scanRows = 5) {
  let best = 0;
  let bestScore = -1;
  rows.slice(0, scanRows).forEach((row, i) => {
    const s = score(row);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/** 2차원 배열 → CSV (엑셀에서 한글이 깨지지 않도록 BOM 포함) */
export function toCsv(rows: string[][]) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
}
