/** 브라우저 전용 파일 유틸 (다운로드·텍스트 읽기) */
import { parseDelimited } from "./table";
import { readXlsx } from "./xlsx";

/** 주문·송장 표 파일 열기: .xlsx는 첫 시트, 그 밖(csv·tsv·txt)은 글자 표로 */
export async function readTableFile(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) return readXlsx(await file.arrayBuffer());
  if (/\.xls$/i.test(file.name)) throw new Error("옛 엑셀(.xls) 파일이에요. 엑셀에서 열어 '다른 이름으로 저장 → Excel 통합 문서(.xlsx)'로 바꾼 뒤 올려 주세요.");
  return parseDelimited(await readTextFile(file));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // 클릭 직후 해제하면 일부 브라우저에서 다운로드가 취소돼 한 틱 뒤에 정리
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 국내 쇼핑몰 CSV는 UTF-8과 EUC-KR(CP949)이 섞여 있다.
 * UTF-8로 엄격하게 읽어 보고 깨지면 EUC-KR로 다시 읽는다.
 */
export async function readTextFile(file: Blob) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

/** 엑셀 등에서 숫자로 변환되며 붙은 쉼표·원 표기를 걷어내고 숫자로 */
export function toNumber(value: string | number | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? "").replace(/[,원\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
