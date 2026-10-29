'use client';

import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PRODUCT_CATEGORIES } from '@/shared/constants/productCategories';
import { ROUTES } from '@/shared/constants/routes';
import { formatCost, HERO_VIDEO_USD, MEDIA_COST } from '@/shared/lib/draftMedia';
import { DRAFT_LIMITS, type DraftInput, type HeroMotion } from '@/shared/types/draft';
import { draftApi, type DraftDto } from '../api';
import { useAutosave, useDraftMutation } from '../hooks';
import { PlanGuideModal } from './PlanGuideModal';
import { ChoiceCard, Field, ImageUploader, inputClass, SaveStatus, Toggle } from './ui';

const RECOMMENDED_SHOTS = ['전체 모습·옵션', '착용·사용 모습', '변형된 모습(펼침·조립 등)', '강조할 포인트'];

interface DraftFormProps {
  initialDraft: DraftDto | null;
  initialInput: DraftInput;
}

/**
 * 상세페이지 입력 폼 (후커블 입력 폼과 같은 항목)
 * - 필수: 상품명·사진 1장 이상·카테고리·주요 특징·길이 (나머지는 선택)
 * - 타이핑하는 대로 자동 저장 → "작성 중인 초안"으로 남는다
 * - 근거 자료(후기·인증·판매 실적·산지 정보)를 넣어야 그 섹션을 만들 수 있다
 */
export default function DraftForm({ initialDraft, initialInput }: DraftFormProps) {
  const router = useRouter();
  const [draftId, setDraftId] = useState(initialDraft?.id ?? null);
  const [input, setInput] = useState<DraftInput>(initialInput);
  const [guideOpen, setGuideOpen] = useState(false);
  const [showMore, setShowMore] = useState(Boolean(initialDraft));
  /** 처음 저장(초안 생성)은 한 번만 — 자동 저장과 버튼이 동시에 눌려도 초안이 둘 생기지 않게 */
  const creating = useRef<Promise<string> | null>(null);

  const createOnce = (value: DraftInput) => {
    creating.current ??= draftApi.create(value).then((created) => {
      setDraftId(created.id);
      window.history.replaceState(null, '', ROUTES.DRAFT_CREATE_FROM({ draft: created.id }));
      return created.id;
    });
    return creating.current;
  };

  const save = async (value: DraftInput) => {
    const id = draftId ?? (await createOnce(value));
    return draftApi.patch(id, { input: value });
  };
  const touched = draftId !== null || input.productName.trim() !== '' || input.productImagePaths.length > 0;
  const { saving, savedAt, flush, markSaved } = useAutosave(touched ? input : null, save);

  const update = <K extends keyof DraftInput>(key: K, value: DraftInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));
  const updateAgri = (patch: Partial<DraftInput['agri']>) => setInput((prev) => ({ ...prev, agri: { ...prev.agri, ...patch } }));

  const ensureSaved = async () => {
    await flush();
    const id = draftId ?? (await createOnce(input));
    await draftApi.patch(id, { input });
    markSaved(input);
    return id;
  };

  const autofill = useDraftMutation(
    async () => draftApi.autofill(await ensureSaved()),
    (draft) => {
      markSaved(draft.input);
      setInput(draft.input);
      setShowMore(true);
      toast.success('사진과 상품명으로 내용을 채웠어요. 확인하고 고쳐 주세요.');
    },
  );

  const plan = useDraftMutation(
    async () => draftApi.plan(await ensureSaved()),
    (draft) => router.push(ROUTES.DRAFT(draft.id)),
  );

  const missing = [
    !input.productName.trim() && '상품명',
    !input.productImagePaths.length && '상품 사진',
    !input.categoryId && '카테고리',
    !input.features.trim() && '제품 주요 특징',
  ].filter(Boolean);

  const reuseSources = useQuery({
    queryKey: ['draft-reuse-sources', input.categoryId],
    queryFn: () => draftApi.reuseSources(input.categoryId || undefined),
    enabled: input.startMode === 'reuse',
  });

  const readTextFile = async (file: File | undefined, onText: (text: string) => void) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('2MB 이하 파일만 올릴 수 있어요.');
    if (!/\.(txt|csv|md|tsv)$/i.test(file.name)) return toast.error('txt·csv·md 파일만 읽을 수 있어요. 엑셀은 CSV로 저장해 올려주세요.');
    onText(await file.text());
  };

  const isAgri = input.categoryId === 'agri';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8 pb-36">
      <div>
        <div className="text-2xl font-bold text-gray-900">상세페이지 만들기</div>
        <div className="mt-1 text-sm text-gray-500">상품명과 사진만 있으면 시작할 수 있어요. 초안(기획)까지는 무료로 만들고 마음껏 고칠 수 있어요.</div>
      </div>

      <Field label="시작 방식">
        <div className="flex gap-2">
          <ChoiceCard selected={input.startMode === 'new'} onClick={() => update('startMode', 'new')} title="새로 만들기" description="상품에 맞는 구성을 AI가 새로 기획해요" />
          <ChoiceCard
            selected={input.startMode === 'reuse'}
            onClick={() => update('startMode', 'reuse')}
            title="기존 페이지 활용하기"
            description="완성한 페이지의 구성·색은 그대로, 내용만 새 상품으로 바꿔요"
          />
        </div>
        {input.startMode === 'reuse' && (
          <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
            {reuseSources.isLoading && <span className="text-xs text-gray-400">불러오는 중…</span>}
            {reuseSources.data?.projects.length === 0 && (
              <span className="text-xs text-gray-500">
                {input.categoryId ? '이 카테고리에서 ' : ''}초안으로 완성한 페이지가 아직 없어요. 먼저 새로 만들어 보세요.
              </span>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {reuseSources.data?.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setInput((prev) => ({ ...prev, reuseSourceProjectId: p.id, categoryId: p.categoryId }))}
                  className={clsx(
                    'flex flex-col gap-1 rounded-lg border bg-white p-2 text-left font-normal',
                    input.reuseSourceProjectId === p.id ? 'border-(--color-point)' : 'border-gray-100',
                  )}
                >
                  <span className="truncate text-sm font-semibold">{p.title}</span>
                  <span className="text-xs text-gray-500">섹션 {p.sectionCount}개</span>
                  <span className="flex gap-1">
                    {Object.values(p.palette).map((c) => (
                      <span key={c} className="h-3 w-3 rounded-full border border-gray-100" style={{ background: c }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>

      <Field label="상품명" required count={input.productName.length} max={DRAFT_LIMITS.productName}>
        <input
          className={inputClass}
          value={input.productName}
          maxLength={DRAFT_LIMITS.productName}
          placeholder="예) 가을 제철 영덕 활 꽃게 2kg"
          onChange={(e) => update('productName', e.target.value)}
        />
      </Field>

      <Field
        label="상품 이미지"
        required
        count={input.productImagePaths.length}
        max={DRAFT_LIMITS.productImages}
        hint={
          <div className="flex flex-col gap-1.5">
            <span>이런 사진이 있으면 더 좋아요. 옵션별로 생김새가 다르면 각각 올려 주세요.</span>
            <div className="flex flex-wrap gap-1.5">
              {RECOMMENDED_SHOTS.map((shot, i) => (
                <span key={shot} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                  {i + 1}. {shot}
                </span>
              ))}
            </div>
          </div>
        }
      >
        <ImageUploader paths={input.productImagePaths} onChange={(v) => update('productImagePaths', v)} max={DRAFT_LIMITS.productImages} />
      </Field>

      <ImageModeField input={input} update={update} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#AFDCFF] bg-[#F7FBFF] p-4">
        <div className="flex-1 text-sm text-gray-700">
          <b>AI로 내용 채우기</b> — 상품명과 사진을 보고 카테고리·주요 특징·옵션·등장 모델을 채워 드려요. (비어 있는 칸만)
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={!input.productName.trim() || !input.productImagePaths.length || autofill.isPending}
          onClick={() => autofill.mutate(undefined)}
        >
          {autofill.isPending ? '채우는 중…' : '✦ AI로 내용 채우기'}
        </button>
        <button type="button" className="btn-outline text-sm font-medium" onClick={() => setShowMore(true)}>
          직접 입력할게요
        </button>
      </div>

      {showMore && (
        <>
          <Field label="카테고리" required>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PRODUCT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update('categoryId', c.id)}
                  className={clsx(
                    'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium',
                    input.categoryId === c.id ? 'border-(--color-point) bg-[#F3F9FE] text-gray-900' : 'border-gray-100 text-gray-600 hover:border-gray-300',
                  )}
                >
                  <span className="text-xl">{c.emoji}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="제품 주요 특징" required count={input.features.length} max={DRAFT_LIMITS.features} hint="한 줄에 하나씩 적어 주세요. 여기 적은 사실만 페이지 문구의 근거가 돼요.">
            <textarea
              className={clsx(inputClass, 'min-h-36 resize-y leading-6')}
              value={input.features}
              maxLength={DRAFT_LIMITS.features}
              placeholder={'1. 살이 꽉 찬 수꽃게만 골라 보내요\n2. 영덕 앞바다에서 잡아요\n3. 1kg에 3~4마리'}
              onChange={(e) => update('features', e.target.value)}
            />
          </Field>

          <Field
            label="옵션(종류)"
            count={input.options.length}
            max={DRAFT_LIMITS.options}
            action={
              input.options.length < DRAFT_LIMITS.options && (
                <button type="button" className="text-xs font-semibold text-(--color-point)" onClick={() => update('options', [...input.options, { name: '', spec: '' }])}>
                  + 옵션 추가
                </button>
              )
            }
          >
            {input.options.map((option, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="옵션 이름 (예: 중 사이즈)"
                  value={option.name}
                  onChange={(e) => update('options', input.options.map((o, j) => (j === i ? { ...o, name: e.target.value } : o)))}
                />
                <input
                  className={inputClass}
                  placeholder="용량·크기 (예: 2kg, 5~7마리)"
                  value={option.spec}
                  onChange={(e) => update('options', input.options.map((o, j) => (j === i ? { ...o, spec: e.target.value } : o)))}
                />
                <button type="button" aria-label="옵션 삭제" className="btn-icon px-2 text-gray-400" onClick={() => update('options', input.options.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
          </Field>

          <Field label="등장 모델" hint="사람·동물 연출이 상품 매력을 높일 때 추천해요. 비워 두면 모델 없이 만들어요.">
            <Toggle checked={input.model.enabled} onChange={(enabled) => update('model', { ...input.model, enabled })} label="모델을 등장시킬게요" />
            {input.model.enabled && (
              <div className="flex flex-col gap-2">
                <input
                  className={inputClass}
                  maxLength={DRAFT_LIMITS.modelDescription}
                  placeholder="원하는 모델 (예: 30대 한국인 주부, 밝은 표정)"
                  value={input.model.description}
                  onChange={(e) => update('model', { ...input.model, description: e.target.value })}
                />
                <ImageUploader compact paths={input.model.imagePaths} onChange={(imagePaths) => update('model', { ...input.model, imagePaths })} max={3} />
              </div>
            )}
          </Field>

          <Field label="상세페이지 길이" required>
            <div className="flex gap-2">
              <ChoiceCard selected={input.length === 'short'} onClick={() => update('length', 'short')} title="짧은 구성" description="12~15개 섹션 · 약 2~3만px" />
              <ChoiceCard selected={input.length === 'long'} onClick={() => update('length', 'long')} title="긴 구성" description="20~25개 섹션 · 약 4~5만px" />
            </div>
          </Field>

          {isAgri && (
            <Group title="🍊 농수산물 정보" description="입력한 내용이 있을 때만 산지·제철·선별·농부·산지직송 섹션을 만들어요.">
              <Field label="산지·원산지">
                <input className={inputClass} placeholder="예) 경북 영덕 강구항" value={input.agri.origin} onChange={(e) => updateAgri({ origin: e.target.value })} />
              </Field>
              <Field label="수확 시기·제철">
                <input className={inputClass} placeholder="예) 9~11월 가을 금어기 해제 후" value={input.agri.harvest} onChange={(e) => updateAgri({ harvest: e.target.value })} />
              </Field>
              <Field label="선별 기준">
                <textarea className={clsx(inputClass, 'min-h-20')} placeholder="예) 한 마리 300g 이상, 다리 빠짐 없는 것만" value={input.agri.selection} onChange={(e) => updateAgri({ selection: e.target.value })} />
              </Field>
              <Field label="생산자(농가) 이야기">
                <textarea className={clsx(inputClass, 'min-h-20')} placeholder="예) 3대째 꽃게잡이를 하는 김선장" value={input.agri.producerStory} onChange={(e) => updateAgri({ producerStory: e.target.value })} />
              </Field>
              <Toggle checked={input.agri.directShipping} onChange={(directShipping) => updateAgri({ directShipping })} label="산지에서 직접 발송해요 (산지직송)" />
            </Group>
          )}

          <Group title="근거 자료" description="후기·인증·판매 실적은 실제 자료가 있을 때만 페이지에 넣어요. 자료가 없으면 해당 섹션은 잠겨요.">
            <Field
              label="고객 리뷰"
              hint="실제 후기를 붙여 넣거나 txt·csv 파일, 리뷰 스크린샷 1장을 올려 주세요. 문장을 바꾸지 않고 인용해요."
              action={
                <label className="cursor-pointer text-xs font-semibold text-(--color-point)">
                  파일 불러오기
                  <input type="file" accept=".txt,.csv,.tsv,.md" className="hidden" onChange={(e) => void readTextFile(e.target.files?.[0], (t) => update('reviewsText', t.slice(0, DRAFT_LIMITS.reviewsText)))} />
                </label>
              }
            >
              <textarea className={clsx(inputClass, 'min-h-24')} placeholder="한 줄에 후기 하나씩" value={input.reviewsText} onChange={(e) => update('reviewsText', e.target.value)} />
              <ImageUploader compact type="reference" paths={input.reviewImagePaths} onChange={(v) => update('reviewImagePaths', v)} max={1} />
            </Field>
            <Field
              label="인증"
              action={
                <button type="button" className="text-xs font-semibold text-(--color-point)" onClick={() => update('certifications', [...input.certifications, { name: '', number: '' }])}>
                  + 인증 추가
                </button>
              }
              hint="인증명과 인증번호를 함께 적어 주세요. 번호가 페이지에 그대로 표시돼요."
            >
              {input.certifications.map((cert, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputClass} placeholder="인증명 (예: GAP 인증)" value={cert.name} onChange={(e) => update('certifications', input.certifications.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))} />
                  <input className={inputClass} placeholder="인증번호" value={cert.number} onChange={(e) => update('certifications', input.certifications.map((c, j) => (j === i ? { ...c, number: e.target.value } : c)))} />
                  <button type="button" aria-label="인증 삭제" className="btn-icon px-2 text-gray-400" onClick={() => update('certifications', input.certifications.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              ))}
            </Field>
            <Field label="판매 실적·순위">
              <input className={inputClass} placeholder="예) 2025년 누적 판매 1만 박스 (스마트스토어 기준)" value={input.salesRecord} onChange={(e) => update('salesRecord', e.target.value)} />
            </Field>
            <Field label="이벤트·혜택">
              <input className={inputClass} placeholder="예) 2박스 이상 주문 시 10% 할인" value={input.promotion} onChange={(e) => update('promotion', e.target.value)} />
            </Field>
            <Field label="시설·제조 공정">
              <textarea className={clsx(inputClass, 'min-h-20')} placeholder="예) 수조에서 해감 후 급랭, 무첨가" value={input.facility} onChange={(e) => update('facility', e.target.value)} />
            </Field>
          </Group>

          <Group title="판매 정보" description="FAQ·배송·고객센터 섹션에 그대로 들어가요. 비워 두면 [입력 필요]로 표시돼요.">
            <Field label="브랜드·판매자명">
              <input className={inputClass} placeholder="예) 영덕바다상회" value={input.brandName} onChange={(e) => update('brandName', e.target.value)} />
            </Field>
            <Field label="배송 정보">
              <input className={inputClass} placeholder="예) 오후 2시 이전 주문 당일 출고, CJ대한통운" value={input.shipping} onChange={(e) => update('shipping', e.target.value)} />
            </Field>
            <Field label="고객센터">
              <input className={inputClass} placeholder="예) 010-0000-0000 / 평일 9시~18시" value={input.contact} onChange={(e) => update('contact', e.target.value)} />
            </Field>
          </Group>

          <Field
            label="기획안"
            count={input.plan.length}
            max={DRAFT_LIMITS.plan}
            hint="미리 써 둔 기획안이 있으면 그 흐름을 우선해요."
            action={
              <>
                <label className="cursor-pointer text-xs font-semibold text-gray-500">
                  파일 첨부
                  <input type="file" accept=".txt,.md" className="hidden" onChange={(e) => void readTextFile(e.target.files?.[0], (t) => update('plan', t.slice(0, DRAFT_LIMITS.plan)))} />
                </label>
                <button type="button" className="text-xs font-semibold text-(--color-point)" onClick={() => void ensureSaved().then(() => setGuideOpen(true))}>
                  작성 가이드
                </button>
              </>
            }
          >
            <textarea className={clsx(inputClass, 'min-h-28')} maxLength={DRAFT_LIMITS.plan} value={input.plan} onChange={(e) => update('plan', e.target.value)} placeholder="GPT·Claude로 만든 기획안을 붙여 넣어도 돼요" />
          </Field>

          <Field
            label="레퍼런스"
            count={input.referenceImagePaths.length}
            max={DRAFT_LIMITS.referenceImages}
            hint="색감과 분위기는 페이지 전체에, 레이아웃은 어울리는 섹션에 반영해요."
          >
            <div className="flex gap-2">
              <ChoiceCard selected={input.referenceMode === 'reference'} onClick={() => update('referenceMode', 'reference')} title="참고 이미지" description="색감·분위기만 참고해요" />
              <ChoiceCard selected={input.referenceMode === 'my_product'} onClick={() => update('referenceMode', 'my_product')} title="내 제품 버전" description="레퍼런스 구도를 내 상품으로 다시 연출해요" />
            </div>
            <ImageUploader type="reference" paths={input.referenceImagePaths} onChange={(v) => update('referenceImagePaths', v)} max={DRAFT_LIMITS.referenceImages} />
          </Field>
        </>
      )}

      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
            <SaveStatus saving={saving} savedAt={savedAt} />
            {missing.length > 0 && <span className="text-xs text-gray-500">남은 필수 항목: {missing.join(', ')}</span>}
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 px-4 sm:px-6"
            disabled={missing.length > 0 || plan.isPending || (input.startMode === 'reuse' && !input.reuseSourceProjectId)}
            onClick={() => {
              if (!showMore) setShowMore(true);
              plan.mutate(undefined);
            }}
          >
            {plan.isPending ? '시작하는 중…' : '✦ 상세페이지 초안 만들기'}
          </button>
        </div>
      </div>

      {draftId && <PlanGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} draftId={draftId} />}
    </div>
  );
}

const MOTION_OPTIONS: { value: HeroMotion; title: string; description: string }[] = [
  { value: 'pan', title: '천천히 줌·이동', description: '맨 위 사진이 살아 움직이듯 · 무료' },
  { value: 'video', title: '✦ AI 영상', description: `과즙·김·물방울까지 움직여요 · ${MEDIA_COST.heroVideoSeconds}초 ${formatCost(HERO_VIDEO_USD)}` },
  { value: 'off', title: '움직이지 않게', description: '정지 사진으로 둬요' },
];

/** 사진 연출: AI로 장면 사진 만들기 / 사진 자리 비워두기 + 맨 위 움직이는 컷 */
function ImageModeField({ input, update }: { input: DraftInput; update: <K extends keyof DraftInput>(key: K, value: DraftInput[K]) => void }) {
  const photoCount = input.productImagePaths.length;
  return (
    <Field label="사진 연출" required hint="기획 초안에서 컷마다 AI 생성 · 내 사진 · 비워두기를 다시 고를 수 있어요.">
      <div className="flex gap-2">
        <ChoiceCard
          selected={input.imageMode === 'ai'}
          onClick={() => update('imageMode', 'ai')}
          title="✦ AI로 연출 사진 만들기"
          description={`올린 사진${photoCount ? ` ${photoCount}장` : ''}을 참고해 섹션마다 다른 장면(산지·수확·단면·플레이팅 등)으로 만들어요 · 장당 ${formatCost(MEDIA_COST.aiImageUsd)}`}
        />
        <ChoiceCard
          selected={input.imageMode === 'blank'}
          onClick={() => update('imageMode', 'blank')}
          title="사진 자리 비워두기"
          description="AI 사진 없이 빈 자리로 두고, 에디터에서 직접 사진을 넣어요 · 이미지 비용 없음"
        />
      </div>
      {input.imageMode === 'ai' && (
        <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
          <div className="text-[13px] font-semibold text-gray-800">
            맨 위 움직이는 컷 <span className="font-normal text-gray-500">— 스마트스토어·쿠팡에 GIF로 올려 첫 화면에서 눈길을 끌어요</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {MOTION_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                selected={input.heroMotion === option.value}
                onClick={() => update('heroMotion', option.value)}
                title={option.title}
                description={option.description}
              />
            ))}
          </div>
        </div>
      )}
    </Field>
  );
}

function Group({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-gray-100 p-5">
      <div>
        <div className="text-base font-semibold text-gray-900">{title}</div>
        <div className="mt-0.5 text-xs text-gray-500">{description}</div>
      </div>
      {children}
    </div>
  );
}