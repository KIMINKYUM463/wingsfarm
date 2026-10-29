'use client';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { draftApi } from '../api';
import { Modal } from './ui';

/** 기획안 "작성 가이드" — 상품 정보를 채운 프롬프트를 복사해 GPT·Claude에서 기획안을 받아 온다 */
export function PlanGuideModal({ open, onClose, draftId }: { open: boolean; onClose: () => void; draftId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['draft-plan-guide', draftId],
    queryFn: () => draftApi.planGuide(draftId),
    enabled: open,
    staleTime: 0,
  });

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.prompt);
    toast.success('프롬프트를 복사했어요.');
  };

  return (
    <Modal open={open} onClose={onClose} title="기획안 작성 가이드">
      <ol className="mb-3 flex flex-col gap-1 text-sm text-gray-700">
        <li>1. 아래 프롬프트를 복사해 GPT나 Claude에 붙여 넣고, 상품 사진도 함께 올려 주세요.</li>
        <li>2. 받은 기획안을 복사해 기획안 칸에 붙여 넣으면 그 흐름대로 초안을 만들어요.</li>
      </ol>
      <pre className="max-h-[50vh] overflow-auto rounded-lg bg-gray-50 p-3 text-xs leading-5 whitespace-pre-wrap text-gray-700">
        {isLoading ? '프롬프트를 만드는 중…' : data?.prompt}
      </pre>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-primary text-sm" disabled={!data} onClick={() => void copy()}>
          프롬프트 복사
        </button>
      </div>
    </Modal>
  );
}
