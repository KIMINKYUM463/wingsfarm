'use client';

import { useCopyModel } from '@/features/auth/hooks/useCopyModel';
import { COPY_MODELS, type CopyModelInfo } from '@/shared/constants/copyModels';

const CopyModelPicker = ({ initialData }: { initialData: CopyModelInfo }) => {
  const { info, select, isPending, justSaved } = useCopyModel(initialData);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 className="h2-bold">판매 문구 AI</h2>
        <p className="title-1 text-gray-500">상세페이지 초안·템플릿 문구·AI로 수정에 쓰는 모델이에요. 사진·이미지 생성은 그대로 Gemini를 써요.</p>
      </div>

      <div role="radiogroup" aria-label="판매 문구 AI" className="flex flex-col gap-2">
        {COPY_MODELS.map((m) => {
          const active = info.model === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              onClick={() => !active && select(m.id)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition disabled:opacity-60 ${
                active ? 'border-(--color-success) bg-green-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`size-4 shrink-0 rounded-full border-2 ${active ? 'border-(--color-success) bg-(--color-success)' : 'border-gray-300'}`} />
              <span className="flex flex-col">
                <span className="p font-semibold text-gray-900">{m.label}</span>
                <span className="description text-gray-500">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {info.model === 'gpt' && !info.openaiReady && (
        <p className="description text-[#F2860A]">OpenAI 키가 없어 지금은 Gemini가 대신 써요. .env.local에 OPENAI_API_KEY를 넣고 서버를 다시 켜 주세요.</p>
      )}
      {justSaved && <p className="description text-(--color-success)">저장되었습니다. 다음 문구부터 적용돼요.</p>}
    </div>
  );
};

export default CopyModelPicker;
