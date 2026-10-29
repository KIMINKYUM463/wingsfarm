'use client';

import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import Button from '@/shared/ui/Button/Button';
import { useImageDownload } from '@/features/editor/hooks/useImageDownload';
import {
  CANVAS_WIDTH,
  estimateBytes,
  formatBytes,
  FORMATS,
  parsePageRange,
  PLATFORMS,
  QUALITIES,
  WIDTH_RANGE,
  type DownloadBundle,
  type DownloadFormat,
  type DownloadQuality,
  type PlatformId,
} from '@/features/editor/lib/download-options';

/** 버튼 여러 개 중 하나 고르기 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-gray-50 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
          className={clsx(
            'flex-1 rounded-md py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40',
            value === option.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="p-bold">{title}</p>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * 다운로드 — 판매처별 크기 · 형식(JPG/PNG/WEBP/HTML) · 품질 · 페이지 선택 · 한 장/ZIP
 * 페이지 수·크기·예상 용량을 미리 보여준다. 다운로드는 무료·무제한
 */
const DownloadPopover = () => {
  const { download, isDownloading, frames } = useImageDownload();
  const [platform, setPlatform] = useState<PlatformId>('smartstore');
  const [customWidth, setCustomWidth] = useState(String(CANVAS_WIDTH));
  const [format, setFormat] = useState<DownloadFormat>('jpg');
  const [quality, setQuality] = useState<DownloadQuality>('standard');
  const [pageMode, setPageMode] = useState<'all' | 'some'>('all');
  const [pageRange, setPageRange] = useState('');
  const [bundle, setBundle] = useState<DownloadBundle>('single');

  const isCustom = platform === 'custom';
  const presetWidth = PLATFORMS.find((p) => p.id === platform)?.width;
  const parsedWidth = Number(customWidth);
  const width = presetWidth ?? (Number.isInteger(parsedWidth) ? parsedWidth : NaN);
  const widthValid = width >= WIDTH_RANGE[0] && width <= WIDTH_RANGE[1];
  const effectiveFormat = format === 'html' && !isCustom ? 'jpg' : format;

  const allPages = frames.map((_, i) => i);
  const pageIndexes = pageMode === 'all' ? allPages : parsePageRange(pageRange, frames.length);
  const heights = (pageIndexes ?? []).map((i) => frames[i]?.height ?? 0);
  const scale = widthValid ? width / CANVAS_WIDTH : 0;
  const totalHeight = Math.round(heights.reduce((sum, h) => sum + h, 0) * scale);
  const canDownload = widthValid && Boolean(pageIndexes?.length) && !isDownloading;

  const choosePlatform = (id: PlatformId) => {
    setPlatform(id);
    if (id !== 'custom' && format === 'html') setFormat('jpg');
  };

  return (
    <div className="flex max-h-[calc(100vh-var(--header-h)-2rem)] w-100 flex-col rounded-xl">
      <div className="flex flex-col gap-6 overflow-y-auto p-6">
        <h2 className="title-1-bold">다운로드</h2>

        <Group title="등록 플랫폼">
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePlatform(p.id)}
                className={clsx(
                  'flex flex-col items-start rounded-lg border px-3 py-2 text-left',
                  platform === p.id ? 'border-(--color-point) ring-1 ring-(--color-point)' : 'border-gray-100 hover:border-gray-300',
                )}
              >
                <span className="text-sm font-semibold text-gray-900">{p.label}</span>
                <span className="text-xs text-gray-400">
                  {p.width ? `가로 ${p.width}px · ` : ''}
                  {p.note}
                </span>
              </button>
            ))}
          </div>
          {isCustom && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              가로
              <input
                type="number"
                inputMode="numeric"
                min={WIDTH_RANGE[0]}
                max={WIDTH_RANGE[1]}
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className={clsx(
                  'h-9 w-24 rounded-lg border px-2 text-right',
                  widthValid ? 'border-gray-200' : 'border-red-400',
                )}
              />
              px
              {!widthValid && <span className="text-xs text-red-500">{WIDTH_RANGE.join('~')}px 사이로 입력해주세요</span>}
            </label>
          )}
        </Group>

        <Group title="파일 형식" hint={FORMATS.find((f) => f.id === effectiveFormat)?.description}>
          <Segmented
            options={FORMATS.map((f) => ({ id: f.id, label: f.label, disabled: f.id === 'html' && !isCustom }))}
            value={effectiveFormat}
            onChange={setFormat}
          />
        </Group>

        <Group title="품질" hint={effectiveFormat === 'png' ? 'PNG는 무손실이라 품질 설정이 적용되지 않아요.' : undefined}>
          <Segmented
            options={QUALITIES.map((q) => ({ id: q.id, label: q.label, disabled: effectiveFormat === 'png' }))}
            value={quality}
            onChange={setQuality}
          />
        </Group>

        <Group title="페이지">
          <Segmented
            options={[
              { id: 'all' as const, label: `전체 ${frames.length}페이지` },
              { id: 'some' as const, label: '일부 선택' },
            ]}
            value={pageMode}
            onChange={setPageMode}
          />
          {pageMode === 'some' && (
            <input
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder={`예) 1-3, 5  (1~${frames.length})`}
              className={clsx(
                'h-9 rounded-lg border px-3 text-sm',
                pageRange && !pageIndexes ? 'border-red-400' : 'border-gray-200',
              )}
            />
          )}
        </Group>

        {effectiveFormat !== 'html' && (
          <Group title="묶음">
            <Segmented
              options={[
                { id: 'single' as const, label: '한 장의 이미지' },
                { id: 'zip' as const, label: '페이지별 ZIP' },
              ]}
              value={bundle}
              onChange={setBundle}
            />
          </Group>
        )}
      </div>

      <div className="border-t border-gray-100 p-6 pt-4">
        <dl className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs">
          <div>
            <dt className="text-gray-400">페이지</dt>
            <dd className="font-semibold text-gray-900">{pageIndexes?.length ?? 0}개</dd>
          </div>
          <div>
            <dt className="text-gray-400">크기</dt>
            <dd className="font-semibold text-gray-900">{widthValid ? `${width} × ${totalHeight.toLocaleString()}` : '-'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">예상 용량</dt>
            <dd className="font-semibold text-gray-900">
              {canDownload ? `약 ${formatBytes(estimateBytes(effectiveFormat, quality, width, heights, CANVAS_WIDTH))}` : '-'}
            </dd>
          </div>
        </dl>
        <Button
          className="btn-primary w-full"
          onClick={() =>
            pageIndexes &&
            download({ format: effectiveFormat, width, quality, pageIndexes, bundle: effectiveFormat === 'html' ? 'zip' : bundle })
          }
          isLoading={isDownloading}
          disabled={!canDownload}
        >
          <span className="p-bold">다운로드</span>
        </Button>
        <p className="mt-2 text-center text-xs text-gray-400">다운로드는 무료 · 무제한이에요</p>
      </div>
    </div>
  );
};

export default DownloadPopover;
