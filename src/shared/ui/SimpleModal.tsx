'use client';

import clsx from 'clsx';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** 가운데 뜨는 모달 (바깥 클릭·Esc로 닫힘) — 초안 화면과 에디터가 함께 사용 */
export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  // 헤더처럼 z-index가 낮은 부모 안에서 열려도 화면 맨 위에 뜨도록 body로 내보낸다
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className={clsx('flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="text-base font-semibold text-gray-900">{title}</div>
          <button type="button" aria-label="닫기" onClick={onClose} className="btn-icon text-gray-400">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
