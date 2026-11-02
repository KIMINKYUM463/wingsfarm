'use client';

import clsx from 'clsx';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AiOrb } from '@/features/editor/components/panel/image/AiOrb';

export type StepState = 'done' | 'active' | 'todo';

const noopSubscribe = () => () => {};

/** 초 단위 경과 시간 "m:ss" */
export function useElapsed() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const s = Math.floor((now - start) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 기획·생성 진행 팝업. 뒤 화면을 흐리게 덮고 가운데에 뜬다.
 * 작업은 서버에서 계속되므로 닫기 버튼 없이, 끝나면 부모가 팝업 없는 전체 화면으로 바꾼다.
 */
export function ProgressDialog({
  title,
  meta,
  percent,
  failed,
  children,
  footer,
  onClose,
}: {
  title: ReactNode;
  meta?: ReactNode;
  /** 0~100, null이면 막대를 숨긴다 */
  percent: number | null;
  failed?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** 있으면 오른쪽 위에 닫기. 작업은 부모가 계속 돌린다 */
  onClose?: () => void;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10001] flex animate-overlay-in items-center justify-center bg-gray-900/30 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-live="polite">
      <div className="relative flex w-full max-w-md animate-dialog-in flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {onClose && (
          <button type="button" aria-label="닫기" onClick={onClose} className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-sm text-gray-700 shadow">
            ✕
          </button>
        )}
        {failed ? (
          <div className="flex h-28 items-center justify-center bg-red-50 text-4xl">⚠️</div>
        ) : (
          <AiOrb className="h-40 w-full" />
        )}
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            {meta && <span className="shrink-0 pt-1 text-xs text-gray-400 tabular-nums">{meta}</span>}
          </div>
          {children}
          {percent !== null && <ProgressBar percent={percent} />}
          {footer && <div className="text-xs leading-5 text-gray-400">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const value = Math.max(4, Math.min(100, percent));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full animate-bar-stripe rounded-full bg-(--color-point) transition-[width] duration-700 ease-out motion-reduce:animate-none"
          style={{
            width: `${value}%`,
            backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.25) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.25) 50%, rgba(255,255,255,.25) 75%, transparent 75%)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>
      <span className="w-9 text-right text-xs font-semibold text-gray-500 tabular-nums">{Math.round(percent)}%</span>
    </div>
  );
}

/** 진행 단계 한 줄: 끝난 단계는 체크가 튀어나오고, 진행 중 단계는 도는 링 + 메시지가 바뀔 때마다 올라오며 바뀐다 */
export function ProgressStep({ state, label }: { state: StepState; label: string }) {
  return (
    <li className={clsx('flex items-center gap-2.5 text-sm transition-colors duration-300', state === 'done' ? 'text-gray-700' : state === 'active' ? 'font-semibold text-(--color-point)' : 'text-gray-300')}>
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        {state === 'done' && <span className="flex size-5 animate-check-pop items-center justify-center rounded-full bg-(--color-point) text-[11px] text-white">✓</span>}
        {state === 'active' && <span className="size-4 animate-spin rounded-full border-2 border-(--color-point)/25 border-t-(--color-point)" />}
        {state === 'todo' && <span className="size-2 rounded-full bg-gray-200" />}
      </span>
      <span key={label} className={clsx(state === 'active' && 'animate-rise-in')}>
        {label}
      </span>
    </li>
  );
}

/** 팝업 뒤에 깔리는 초안 화면 뼈대 (목차 + 섹션 카드 자리) */
export function DraftBackdrop({ sectionNames }: { sectionNames: string[] }) {
  const rows = sectionNames.length ? sectionNames : Array.from({ length: 6 }, () => '');
  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6" aria-hidden>
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
        <ol className="flex flex-col gap-1.5">
          {rows.map((name, i) => (
            <li key={i} className="truncate px-2 py-1 text-sm text-gray-400">
              {name ? `${String(i + 1).padStart(2, '0')} ${name}` : <span className="block h-3 w-28 animate-pulse rounded bg-gray-200" />}
            </li>
          ))}
        </ol>
      </aside>
      <main className="flex flex-1 flex-col gap-3">
        {rows.map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 rounded-2xl bg-white p-5" style={{ animationDelay: `${i * 120}ms` }}>
            <div className="flex flex-1 flex-col gap-2.5">
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="h-5 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
            <div className="hidden h-28 w-40 rounded-xl bg-gray-100 sm:block" />
          </div>
        ))}
      </main>
    </div>
  );
}
