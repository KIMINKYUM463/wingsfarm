"use client";

import { useRef, useState } from "react";
import { Button, Notice, TextArea } from "@/components/ui";
import { readTableFile } from "@/lib/file";
import { errorMessage } from "@/lib/http";
import { parseDelimited } from "@/lib/table";

export interface LoadedTable {
  name: string;
  rows: string[][];
}

/** 엑셀·CSV 파일(여러 개 가능) 또는 엑셀에서 복사한 표 붙여넣기 */
export function TableLoader({ onLoad, multiple, hint }: { onLoad: (tables: LoadedTable[]) => void; multiple?: boolean; hint?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const loadFiles = async (files: File[]) => {
    setError("");
    try {
      const tables = await Promise.all(files.map(async (file) => ({ name: file.name, rows: await readTableFile(file) })));
      const empty = tables.find((t) => t.rows.length < 2);
      if (empty) throw new Error(`${empty.name}: 머리글과 주문 줄을 찾지 못했어요.`);
      onLoad(tables);
    } catch (err) {
      setError(errorMessage(err, "파일을 읽지 못했어요."));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const loadPaste = () => {
    const rows = parseDelimited(paste);
    if (rows.length < 2) return setError("머리글 줄을 포함해 두 줄 이상 붙여넣어 주세요.");
    setError("");
    onLoad([{ name: "붙여넣은 표", rows }]);
    setPaste("");
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = [...e.dataTransfer.files];
          if (files.length) void loadFiles(multiple ? files : files.slice(0, 1));
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-emerald-500 bg-emerald-50" : "border-stone-300"}`}
      >
        <p className="text-sm text-stone-600">엑셀(.xlsx)·CSV 파일을 끌어다 놓거나</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          파일 선택{multiple && " (여러 개 가능)"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple={multiple}
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          onChange={(e) => e.target.files?.length && void loadFiles([...e.target.files])}
        />
        {hint && <p className="text-xs text-stone-400">{hint}</p>}
      </div>
      <details className="rounded-xl border border-stone-200 px-3 py-2">
        <summary className="cursor-pointer text-sm text-stone-600">엑셀에서 표를 복사해 붙여넣기</summary>
        <TextArea className="mt-2 font-mono text-xs" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="머리글 줄부터 Ctrl+C → 여기에 Ctrl+V" />
        <Button className="mt-2" variant="secondary" disabled={!paste.trim()} onClick={loadPaste}>
          표 불러오기
        </Button>
      </details>
      {error && <Notice tone="loss">{error}</Notice>}
    </div>
  );
}
