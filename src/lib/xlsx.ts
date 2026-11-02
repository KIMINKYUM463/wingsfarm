/**
 * 의존성 없이 쓰는 최소 xlsx 읽기 (jszip 사용, 브라우저 전용).
 * 첫 번째 시트의 셀 값을 문자열 2차원 배열로 읽는다. 수식·서식·병합은 다루지 않는다.
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
