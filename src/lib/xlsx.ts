/**
 * 의존성 없이 쓰는 최소 xlsx 읽기·쓰기 (jszip 사용, 브라우저 전용).
 * - 읽기: 첫 번째 시트의 셀 값을 문자열 2차원 배열로
 * - 쓰기: 모든 셀을 문자열로 저장 (전화번호·우편번호 앞자리 0 보존)
 * 수식·서식·병합은 다루지 않는다.
 */
import JSZip from "jszip";

export type Sheet = string[][];

/** 암호가 걸린 xlsx·옛 .xls는 OLE(CFB) 컨테이너라 zip으로 열 수 없다 */
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0];

export class XlsxError extends Error {}

const parseXml = (text: string) => new DOMParser().parseFromString(text, "application/xml");

/** "AB12" → 27 (0부터) */
function columnIndex(ref: string) {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const textOf = (node: Element) => [...node.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("");

export async function readXlsx(data: ArrayBuffer): Promise<Sheet> {
  const head = new Uint8Array(data.slice(0, 4));
  if (OLE_SIGNATURE.every((b, i) => head[i] === b)) {
    throw new XlsxError("암호가 걸린 엑셀이거나 옛 형식(.xls)이라 열 수 없어요. 엑셀에서 열어 암호 없이 .xlsx로 다시 저장하거나, 표를 복사해 붙여넣어 주세요.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new XlsxError("엑셀(.xlsx) 파일이 아니거나 손상됐어요.");
  }
  const read = (path: string) => zip.file(path)?.async("string");

  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new XlsxError("엑셀 시트를 찾지 못했어요.");

  const firstSheet = parseXml(workbook).getElementsByTagName("sheet")[0];
  const relId = firstSheet?.getAttribute("r:id") ?? firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const target = [...parseXml(rels).getElementsByTagName("Relationship")].find((r) => r.getAttribute("Id") === relId)?.getAttribute("Target");
  if (!target) throw new XlsxError("엑셀 시트를 찾지 못했어요.");
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;

  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...parseXml(sharedXml).getElementsByTagName("si")].map(textOf) : [];

  const sheetXml = await read(sheetPath);
  if (!sheetXml) throw new XlsxError("엑셀 시트를 찾지 못했어요.");

  const rows: Sheet = [];
  for (const row of parseXml(sheetXml).getElementsByTagName("row")) {
    const rowIndex = Number(row.getAttribute("r") ?? rows.length + 1) - 1;
    const cells: string[] = [];
    for (const c of row.getElementsByTagName("c")) {
      const ref = c.getAttribute("r");
      const col = ref ? columnIndex(ref) : cells.length;
      const type = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      cells[col] = type === "s" ? (shared[Number(v)] ?? "") : type === "inlineStr" ? textOf(c) : v;
    }
    rows[rowIndex] = Array.from(cells, (x) => x ?? "");
  }
  return Array.from(rows, (r) => r ?? []);
}

const escapeXml = (s: string) =>
  s
    // XML 1.0에서 허용되지 않는 제어문자 제거
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const columnName = (index: number) => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

export async function writeXlsx(rows: Sheet, sheetName = "Sheet1"): Promise<Blob> {
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => (value === "" ? "" : `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`))
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
