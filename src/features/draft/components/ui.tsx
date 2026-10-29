'use client';

import clsx from 'clsx';
import { useRef, useState, type ReactNode } from 'react';
import { storageUrl, useUploadPaths } from '../hooks';
import type { ImageType } from '@/features/detail-page/types';

/** 입력 항목 한 칸: 제목·필수 표시·글자 수·도움말 */
export function Field({
  label,
  required,
  hint,
  count,
  max,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  count?: number;
  max?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[15px] font-semibold text-gray-900">
          {label}
          {required ? <span className="text-(--color-point)">*</span> : <span className="text-xs font-medium text-gray-400">선택</span>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {max !== undefined && (
            <span className={clsx('text-xs', (count ?? 0) > max ? 'text-red-500' : 'text-gray-400')}>
              {(count ?? 0).toLocaleString()} / {max.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      {hint && <div className="text-[13px] leading-5 text-gray-500">{hint}</div>}
      {children}
    </section>
  );
}

export const inputClass =
  'w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-(--color-point) focus:bg-white';

/** 두 개 이상 중 하나를 고르는 카드 */
export function ChoiceCard({
  selected,
  onClick,
  title,
  description,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex flex-1 flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left font-normal transition-colors',
        selected ? 'border-(--color-point) bg-[#F3F9FE]' : 'border-gray-100 bg-white hover:border-gray-300',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="text-sm font-semibold text-gray-900">{title}</span>
      {description && <span className="text-xs leading-5 text-gray-500">{description}</span>}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <span
        className={clsx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-(--color-point)' : 'bg-gray-200')}
        onClick={() => onChange(!checked)}
      >
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-4.5' : 'left-0.5')} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** 이미지 여러 장 올리기 (클릭·끌어다 놓기·붙여넣기) + 썸네일 */
export function ImageUploader({
  paths,
  onChange,
  max,
  type = 'product',
  emptyText = '클릭하거나 사진을 끌어다 놓으세요',
  compact,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  max: number;
  type?: ImageType;
  emptyText?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, uploading } = useUploadPaths(type);
  const [dragging, setDragging] = useState(false);
  const remaining = max - paths.length;

  const add = async (files: File[]) => {
    if (remaining <= 0 || !files.length) return;
    const uploaded = await uploadFiles(files.slice(0, remaining));
    if (uploaded.length) onChange([...paths, ...uploaded]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {paths.map((path, i) => (
          <div key={path} className={clsx('group relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50', compact ? 'h-16 w-16' : 'h-24 w-24')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={storageUrl(path)} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" />
            <span className="absolute top-1 left-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">{i + 1}</span>
            <button
              type="button"
              aria-label="사진 삭제"
              onClick={() => onChange(paths.filter((p) => p !== path))}
              className="absolute top-1 right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
            >
              ✕
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void add([...e.dataTransfer.files]);
            }}
            onPaste={(e) => void add([...e.clipboardData.files])}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 text-center text-xs font-medium text-gray-400',
              compact ? 'h-16 min-w-16' : 'h-24 min-w-24',
              dragging ? 'border-(--color-point) bg-[#F3F9FE]' : 'border-gray-200 hover:border-gray-400',
            )}
          >
            {uploading ? '올리는 중…' : <><span className="text-lg leading-none">＋</span>{!compact && <span>{paths.length ? `${paths.length}/${max}` : emptyText}</span>}</>}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple={max > 1}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          void add([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** 간단한 모달 (ESC·바깥 클릭으로 닫힘) */
export { Modal } from '@/shared/ui/SimpleModal';

/** 저장 상태 표시 */
export function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: Date | null }) {
  if (saving) return <span className="text-xs text-gray-400">저장 중…</span>;
  if (!savedAt) return <span className="text-xs text-gray-400">입력하는 대로 자동 저장돼요</span>;
  return <span className="text-xs text-gray-400">자동 저장됨 · {savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>;
}
