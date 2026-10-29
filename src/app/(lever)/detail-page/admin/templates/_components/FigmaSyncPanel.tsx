'use client';

import { useEffect, useState } from 'react';
import { getFigmaStatus, syncFigmaTemplates, type FigmaStatus, type SyncFigmaResponse } from '../utils/api';

interface FigmaSyncPanelProps {
  /** 동기화가 끝나면 템플릿 목록을 다시 불러온다 */
  onSynced: () => void;
}

/**
 * Figma 템플릿 불러오기
 *
 * Figma 파일 구성: 페이지 = part1, 섹션(Section) = part2, 섹션 안의 프레임 = 템플릿
 * 레이어 규칙: `_image` = 상품 사진 자리, 숨김 텍스트 `prompt` = 문구 작성 가이드
 */
export default function FigmaSyncPanel({ onSynced }: FigmaSyncPanelProps) {
  const [status, setStatus] = useState<FigmaStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [hideBuiltin, setHideBuiltin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncFigmaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFigmaStatus()
      .then((s) => {
        setStatus(s);
        setFileKey(s.fileKey);
        setOpen(!s.hasToken || !s.fileKey);
      })
      .catch(() => setOpen(true));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const response = await syncFigmaTemplates({
        token: token.trim() || undefined,
        fileKey: fileKey.trim() || undefined,
        hideBuiltin,
      });
      setResult(response);
      setToken('');
      setStatus((s) => ({ hasToken: true, fileKey: s?.fileKey || fileKey.trim() }));
      onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Figma 동기화 실패');
    } finally {
      setSyncing(false);
    }
  };

  const canSync = !syncing && (Boolean(token.trim()) || Boolean(status?.hasToken)) && Boolean(fileKey.trim());

  return (
    <div className="border-b bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-800">Figma 템플릿 불러오기</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${status?.hasToken && status.fileKey ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {status?.hasToken && status.fileKey ? `연결됨 · ${status.fileKey}` : '미연결'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            {open ? '설정 닫기' : '설정'}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={!canSync}
            className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
          >
            {syncing ? '불러오는 중… (수 분 걸릴 수 있음)' : 'Figma에서 동기화'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">개인 액세스 토큰 (Personal access token)</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={status?.hasToken ? '저장됨 — 바꿀 때만 입력' : 'figd_로 시작하는 토큰'}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
              autoComplete="off"
            />
            <span className="text-gray-400">Figma → Settings → Security → Personal access tokens (File content: Read)</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">파일 URL 또는 파일 키</span>
            <input
              value={fileKey}
              onChange={(e) => setFileKey(e.target.value)}
              placeholder="https://www.figma.com/design/XXXXXXXX/..."
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">페이지 = 대분류(part1), 섹션 = 구성(part2, 예: &quot;2-3 핵심 포인트&quot;), 섹션 안 프레임 = 템플릿</span>
          </label>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={hideBuiltin} onChange={(e) => setHideBuiltin(e.target.checked)} />
            <span>기본 제공 템플릿은 숨기고 Figma 템플릿만 사용</span>
          </label>
          <p className="text-gray-400 md:col-span-2">
            레이어 규칙: 이름에 <b>_image</b> 가 들어간 사각형 = 상품 사진(AI 이미지) 자리, 숨긴 텍스트 <b>prompt</b> = 문구 작성 가이드,
            이름에 <b>꺼주세요</b> 가 들어간 그룹 = 디자이너 가이드(에디터에서 숨김). 이름이 <b>_</b> 로 시작하는 페이지·섹션·프레임은 건너뜁니다.
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {result && (
        <div className="mt-2 text-xs text-green-700">
          {result.message}
          {!!result.errors?.length && (
            <details className="mt-1 text-orange-600">
              <summary>경고 {result.errors.length}건</summary>
              <ul className="ml-4 list-disc">
                {result.errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
