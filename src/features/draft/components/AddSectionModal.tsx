'use client';

import clsx from 'clsx';
import type { SectionTypeInfo } from '@/shared/types/draft';
import { Modal } from './ui';

const CUT_LABEL = { none: '사진 없음', one: '사진 1컷', perItem: '항목마다 사진' } as const;

/**
 * 섹션 추가 패널 — 카테고리의 섹션 종류 전체를 묶음별로 보여 준다.
 * 근거 자료가 없는 섹션(후기·인증·판매 실적·산지 등)은 잠겨 있고, 무엇을 입력하면 되는지 알려 준다.
 */
export function AddSectionModal({
  open,
  onClose,
  types,
  usedTypeIds,
  onAdd,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  types: SectionTypeInfo[];
  usedTypeIds: Set<string>;
  onAdd: (typeId: string) => void;
  pending: boolean;
}) {
  const groups = [...new Set(types.map((t) => t.group))];
  return (
    <Modal open={open} onClose={onClose} title="섹션 추가" width="max-w-3xl">
      {pending && <div className="mb-3 rounded-lg bg-[#F3F9FE] px-3 py-2 text-sm text-(--color-point)">AI가 섹션 문구를 쓰고 있어요…</div>}
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-2 text-xs font-semibold text-gray-400">{group}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {types
                .filter((t) => t.group === group)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={Boolean(t.lockedReason) || pending}
                    onClick={() => onAdd(t.id)}
                    className={clsx(
                      'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left font-normal',
                      t.lockedReason ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-70' : 'border-gray-100 hover:border-(--color-point)',
                    )}
                  >
                    <span className="flex w-full items-center gap-1.5 text-sm font-semibold text-gray-900">
                      {t.lockedReason && '🔒'} {t.name}
                      {usedTypeIds.has(t.id) && <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500">사용 중</span>}
                      <span className="ml-auto text-[10px] font-medium text-gray-400">{CUT_LABEL[t.cuts]}</span>
                    </span>
                    <span className="text-xs text-gray-500">{t.lockedReason ?? t.description}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
