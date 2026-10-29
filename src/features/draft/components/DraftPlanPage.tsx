'use client';

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import ProjectsHeader from '@/shared/ui/Header/ProjectsHeader';
import { Tour, useTour, type TourStep } from '@/shared/ui/Tour';
import { ROUTES } from '@/shared/constants/routes';
import { formatCost } from '@/shared/lib/draftMedia';
import type { CutSource, DraftPlan, DraftProgress, HeroMotion, PalettePreset } from '@/shared/types/draft';
import { draftApi, type DraftDto } from '../api';
import { draftKey, errorMessage, useAutosave, useDraft, useDraftMutation } from '../hooks';
import { AddSectionModal } from './AddSectionModal';
import { PalettePanel } from '@/shared/ui/PalettePanel';
import { designStyleOption } from '@/shared/lib/designStyles';
import { DesignStylePanel } from './DesignStylePanel';
import { DraftBackdrop, ProgressDialog, ProgressStep, useElapsed, type StepState } from './ProgressDialog';
import SectionCard from './SectionCard';
import { Modal, SaveStatus } from './ui';

const MOTION_LABELS: Record<Exclude<HeroMotion, 'off'>, string> = { pan: '줌·이동', video: 'AI 영상' };

/** /detail-page/drafts/[id] — 기획 중 진행 표시 → 섹션 카드 편집 → 생성 진행 */
export default function DraftPlanPage({ id }: { id: string }) {
  const { data: draft, isLoading, isError } = useDraft(id);

  let body;
  if (isLoading) body = <Centered>불러오는 중…</Centered>;
  else if (isError || !draft) body = <Centered>초안을 찾을 수 없어요.</Centered>;
  else if (draft.status === 'planning' || (draft.status === 'plan_failed' && !draft.plan)) body = <PlanProgress draft={draft} />;
  else if (draft.status === 'generating' || draft.status === 'completed') body = <GenerateProgress draft={draft} />;
  else if (draft.plan) body = <PlanEditor key={draft.id} draft={draft} initialPlan={draft.plan} />;
  else body = <Centered>아직 기획 초안이 없어요. <Link className="text-(--color-point) underline" href={ROUTES.DRAFT_CREATE_FROM({ draft: id })}>입력 화면으로</Link></Centered>;

  return (
    <>
      <ProjectsHeader />
      <div className="flex-1 bg-gray-50">{body}</div>
    </>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => <div className="py-24 text-center text-sm text-gray-500">{children}</div>;

// ===== 기획 중 =====

const PLAN_STEPS: { step: DraftProgress['step']; label: (d: DraftDto) => string }[] = [
  { step: 'photos', label: (d) => `사진 ${d.input.productImagePaths.length}장을 살펴봤어요` },
  { step: 'colors', label: () => '상품에 어울리는 색을 골랐어요' },
  { step: 'facts', label: () => '상품 정보를 정리했어요' },
  { step: 'matching', label: () => '사진과 상품 정보를 맞춰 봤어요' },
  { step: 'copy', label: () => '전환율을 높이는 카피를 쓰고 있어요' },
];

function PlanProgress({ draft }: { draft: DraftDto }) {
  const elapsed = useElapsed();
  const retry = useDraftMutation(() => draftApi.plan(draft.id));
  const progress = draft.progress;
  const activeIndex = progress?.step === 'done' ? PLAN_STEPS.length : PLAN_STEPS.findIndex((s) => s.step === progress?.step);
  const copyFraction = progress?.step === 'copy' && progress.total ? progress.current / progress.total : 0.3;
  const percent = activeIndex < 0 ? 0 : (Math.min(activeIndex + copyFraction, PLAN_STEPS.length) / PLAN_STEPS.length) * 100;
  const backdrop = <DraftBackdrop sectionNames={progress?.outline.map((s) => s.name) ?? []} />;

  if (draft.status === 'plan_failed') {
    return (
      <>
        {backdrop}
        <ProgressDialog failed title="기획 초안을 만들지 못했어요" percent={null}>
          <p className="text-sm leading-6 text-gray-500">{draft.errorMessage}</p>
          <div className="flex justify-end gap-2">
            <Link className="btn-outline flex items-center text-sm" href={ROUTES.DRAFT_CREATE_FROM({ draft: draft.id })}>
              입력 수정하기
            </Link>
            <button type="button" className="btn-primary text-sm" disabled={retry.isPending} onClick={() => retry.mutate(undefined)}>
              다시 시도
            </button>
          </div>
        </ProgressDialog>
      </>
    );
  }

  return (
    <>
      {backdrop}
      <ProgressDialog
        title="기획 초안 만드는 중"
        meta={`최대 2분 · ${elapsed}`}
        percent={percent}
        footer="초안까지는 무료예요. 다 되면 섹션마다 문구·사진 계획을 고칠 수 있어요."
      >
        <ul className="flex flex-col gap-2.5">
          <ProgressStep state="done" label={`사진 ${draft.input.productImagePaths.length}장을 올렸어요`} />
          {PLAN_STEPS.map((s, i) => {
            const state: StepState = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
            const counter = s.step === 'copy' && state === 'active' && progress?.total ? ` ${progress.current}/${progress.total}` : '';
            return <ProgressStep key={s.step} state={state} label={(state === 'active' && progress?.message ? progress.message : s.label(draft)) + counter} />;
          })}
        </ul>
      </ProgressDialog>
    </>
  );
}

// ===== 섹션 카드 편집 =====

const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="cards"]', title: '여기가 기획 초안이에요', body: '문구는 "내용 수정"으로 고치고, 왼쪽 손잡이를 끌어 순서를 바꾸고, 필요 없는 섹션은 삭제하세요.' },
  { selector: '[data-tour="back"]', title: '입력으로 돌아가도 괜찮아요', body: '입력한 내용은 그대로 남아 있어요. 고친 뒤 "초안 다시 만들기"를 누르면 새로 기획해요.' },
  { selector: '[data-tour="style"]', title: '디자인 스타일 고르기', body: '모던·내추럴·프리미엄·발랄 중에서 고르면 모든 섹션의 글꼴·바탕·카드 모양이 한 번에 바뀌어요.' },
  { selector: '[data-tour="add"]', title: '빠진 구성은 섹션 추가로', body: '카테고리에 맞는 섹션을 원하는 위치에 넣을 수 있어요. 근거 자료가 필요한 섹션은 자료를 입력하면 열려요.' },
  { selector: '[data-tour="make"]', title: '준비되면 상세페이지 생성', body: '예상 길이와 AI 사진 수를 확인하고 "이대로 만들기"를 누르세요. 내 사진 컷은 그대로 쓰여요.' },
];

function PlanEditor({ draft, initialPlan }: { draft: DraftDto; initialPlan: DraftPlan }) {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState(initialPlan);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const tour = useTour('draft-plan', true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { saving, savedAt, flush, markSaved } = useAutosave(plan, async (value) => {
    const saved = await draftApi.patch(draft.id, { plan: value });
    queryClient.setQueryData(draftKey(draft.id), saved);
  });

  const acceptServerPlan = (next: DraftDto) => {
    if (!next.plan) return;
    markSaved(next.plan);
    setPlan(next.plan);
  };

  const addSection = useDraftMutation(
    async (typeId: string) => {
      await flush();
      return draftApi.addSection(draft.id, typeId, addAt ?? plan.sections.length);
    },
    (next) => {
      acceptServerPlan(next);
      setAddAt(null);
      toast.success('섹션을 추가했어요.');
    },
  );
  const replan = useDraftMutation(async () => {
    await flush();
    return draftApi.plan(draft.id);
  });
  const generate = useDraftMutation(async () => {
    await flush();
    return draftApi.generate(draft.id);
  });

  const palettes = useQuery({ queryKey: ['palettes', draft.input.categoryId], queryFn: () => draftApi.palettes(draft.input.categoryId), enabled: paletteOpen });
  const [shuffled, setShuffled] = useState<PalettePreset[] | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const shuffle = async () => {
    setShuffling(true);
    try {
      setShuffled((await draftApi.shufflePalettes(draft.id)).presets);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setShuffling(false);
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = plan.sections.findIndex((s) => s.id === active.id);
    const to = plan.sections.findIndex((s) => s.id === over.id);
    setPlan({ ...plan, sections: arrayMove(plan.sections, from, to) });
  };

  const typeName = (typeId: string) => draft.sectionTypes.find((t) => t.id === typeId)?.name ?? typeId;
  const serverSections = new Map(draft.plan?.sections.map((s) => [s.id, s]));
  const warningCount = plan.sections.reduce((n, s) => n + (serverSections.get(s.id)?.warnings.length ?? 0), 0);
  const estimate = draft.estimate;
  const coverage = plan.analysis?.coverageNotes ?? [];
  const setAllCutSources = (source: CutSource) =>
    setPlan({ ...plan, sections: plan.sections.map((s) => ({ ...s, cuts: s.cuts.map((c) => ({ ...c, source })) })) });

  return (
    <div className="animate-overlay-in pb-28">
      <div className="sticky top-(--header-h) z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="flex-1">
            <div className="text-base font-semibold text-gray-900">기획 초안이 준비됐어요</div>
            <div className="text-xs text-gray-500">필요한 부분을 수정해 보세요 · {draft.input.productName}</div>
          </div>
          {draft.status === 'generate_failed' && <span className="rounded bg-red-50 px-2 py-1 text-xs text-red-500">생성 실패: {draft.errorMessage}</span>}
          <Link data-tour="back" className="btn-outline flex items-center text-sm font-medium" href={ROUTES.DRAFT_CREATE_FROM({ draft: draft.id })}>
            ← 입력 수정
          </Link>
          <button
            type="button"
            className="btn-outline text-sm font-medium"
            disabled={replan.isPending}
            onClick={() => window.confirm('지금 섹션 카드를 버리고 초안을 다시 만들까요?') && replan.mutate(undefined)}
          >
            초안 다시 만들기
          </button>
          <button type="button" className="btn-outline flex items-center gap-1.5 text-sm font-medium" onClick={() => setPaletteOpen(true)}>
            <span className="flex h-4 overflow-hidden rounded">
              {(['main', 'point', 'bgDark', 'bgLight'] as const).map((r) => (
                <span key={r} className="w-2" style={{ background: plan.palette[r] }} />
              ))}
            </span>
            색 바꾸기
          </button>
          <button type="button" data-tour="style" className="btn-outline text-sm font-medium" onClick={() => setStyleOpen(true)}>
            디자인 · {designStyleOption(plan.designStyle).name}
          </button>
          <button type="button" className="btn-icon text-sm text-gray-400" aria-label="안내 다시 보기" onClick={tour.start}>
            ?
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="sticky top-[calc(var(--header-h)+5rem)] hidden h-fit w-52 shrink-0 lg:block">
          <div className="mb-2 text-xs font-semibold text-gray-400">섹션 목차 · {plan.sections.length}개</div>
          <ol className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
            {plan.sections.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full truncate rounded-md px-2 py-1 text-left text-sm font-normal text-gray-600 hover:bg-white"
                  onClick={() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {String(i + 1).padStart(2, '0')} {typeName(s.typeId)}
                  {(serverSections.get(s.id)?.warnings.length ?? 0) > 0 && <span className="ml-1 text-amber-500">!</span>}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="flex min-w-0 flex-1 animate-rise-in flex-col gap-2 motion-reduce:animate-none" data-tour="cards">
          {coverage.length > 0 && (
            <div className="mb-2 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-gray-600">
              <b className="text-gray-800">사진 점검</b>
              {coverage.map((note) => (
                <div key={note}>· {note}</div>
              ))}
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={plan.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {plan.sections.map((section, i) => (
                <Fragment key={section.id}>
                  <InsertButton onClick={() => setAddAt(i)} />
                  <SectionCard
                    index={i}
                    section={section}
                    typeName={typeName(section.typeId)}
                    preview={draft.previews[section.id]}
                    warnings={serverSections.get(section.id)?.warnings ?? []}
                    photos={draft.input.productImagePaths}
                    onChange={(next) => setPlan({ ...plan, sections: plan.sections.map((s) => (s.id === next.id ? next : s)) })}
                    onDelete={() => setPlan({ ...plan, sections: plan.sections.filter((s) => s.id !== section.id) })}
                  />
                </Fragment>
              ))}
            </SortableContext>
          </DndContext>
          <button
            type="button"
            data-tour="add"
            className="mt-2 rounded-2xl border border-dashed border-gray-300 py-4 text-sm font-semibold text-gray-500 hover:border-(--color-point) hover:text-(--color-point)"
            onClick={() => setAddAt(plan.sections.length)}
          >
            + 섹션 추가
          </button>
        </main>
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-gray-900">
              총 섹션 {estimate.sectionCount}개 · 약 {estimate.heightPx.toLocaleString()}px
            </span>
            <span className="text-xs text-gray-500" title="AI 사진·AI 영상은 등록한 Gemini API 키 사용량으로 청구돼요. 내 사진·빈 자리·줌 이동 컷과 카피는 추가 비용이 없어요.">
              ✦ AI 사진 {estimate.aiCutCount}장 · 내 사진 {estimate.ownCutCount}장
              {estimate.blankCutCount > 0 && ` · 빈 자리 ${estimate.blankCutCount}곳`}
              {estimate.heroMotion !== 'off' && ` · 움직이는 컷 ${MOTION_LABELS[estimate.heroMotion]}`} · 예상 {formatCost(estimate.costUsd)}
              {warningCount > 0 && <span className="ml-2 text-amber-600">사실 확인 필요 {warningCount}건</span>}
            </span>
            <span className="mt-0.5 flex gap-2 text-xs">
              <span className="text-gray-400">사진 컷 한꺼번에</span>
              <button type="button" className="font-semibold text-(--color-point)" onClick={() => setAllCutSources('ai')}>
                모두 AI 생성
              </button>
              <button type="button" className="font-semibold text-gray-600" onClick={() => setAllCutSources('blank')}>
                모두 비워두기
              </button>
            </span>
          </div>
          <SaveStatus saving={saving} savedAt={savedAt} />
          <button
            type="button"
            data-tour="make"
            className="btn-primary px-6"
            disabled={!plan.sections.length || generate.isPending}
            onClick={() => {
              if (warningCount && !window.confirm(`근거를 확인해야 하는 문구가 ${warningCount}건 있어요. 그대로 만들까요?`)) return;
              if (estimate.heroMotion === 'video' && !window.confirm(`AI 영상이 포함돼 ${formatCost(estimate.costUsd)} 정도가 Gemini 키로 청구돼요. 만들까요?`)) return;
              generate.mutate(undefined);
            }}
          >
            {generate.isPending ? '시작하는 중…' : '✦ 이대로 만들기'}
          </button>
        </div>
      </div>

      <AddSectionModal
        open={addAt !== null}
        onClose={() => !addSection.isPending && setAddAt(null)}
        types={draft.sectionTypes}
        usedTypeIds={new Set(plan.sections.map((s) => s.typeId))}
        onAdd={(typeId) => addSection.mutate(typeId)}
        pending={addSection.isPending}
      />
      <Modal open={paletteOpen} onClose={() => setPaletteOpen(false)} title="색 바꾸기" width="max-w-lg">
        <PalettePanel
          palette={plan.palette}
          reason={plan.paletteReason}
          presets={shuffled ?? palettes.data?.presets}
          onShuffle={() => void shuffle()}
          shuffling={shuffling}
          onChange={(palette) => setPlan({ ...plan, palette })}
        />
      </Modal>
      <Modal open={styleOpen} onClose={() => setStyleOpen(false)} title="디자인 스타일" width="max-w-xl">
        <DesignStylePanel
          value={designStyleOption(plan.designStyle).id}
          palette={plan.palette}
          onChange={(designStyle) => setPlan({ ...plan, designStyle })}
          onApplyTone={(palette) => setPlan({ ...plan, palette })}
        />
      </Modal>
      <Tour steps={TOUR_STEPS} open={tour.open} onClose={tour.close} />
    </div>
  );
}

function InsertButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="group flex h-3 items-center justify-center">
      <button type="button" onClick={onClick} className="hidden rounded-full bg-white px-3 text-xs font-semibold text-(--color-point) shadow group-hover:block">
        ＋ 여기에 섹션 추가
      </button>
    </div>
  );
}

// ===== 생성 진행 =====

function GenerateProgress({ draft }: { draft: DraftDto }) {
  const router = useRouter();
  const progress = draft.generateProgress;
  const done = draft.status === 'completed' && draft.projectId;

  useEffect(() => {
    if (!done) return;
    toast.success(progress?.message && progress.message !== '완료' ? progress.message : '상세페이지가 완성됐어요!');
    router.replace(ROUTES.PROJECT(draft.projectId!));
  }, [done, draft.projectId, progress?.message, router]);

  const elapsed = useElapsed();
  const percent = done ? 100 : progress?.total ? (progress.current / progress.total) * 100 : 0;
  const sectionNames = draft.plan?.sections.map((s) => draft.sectionTypes.find((t) => t.id === s.typeId)?.name ?? '') ?? [];
  return (
    <>
      <DraftBackdrop sectionNames={sectionNames} />
      <ProgressDialog
        title={done ? '완성! 에디터로 이동해요' : '상세페이지 만드는 중'}
        meta={done ? undefined : elapsed}
        percent={percent}
        footer={
          <>
            이 화면을 나가도 서버에서 계속 만들어요.{' '}
            <Link className="underline" href={ROUTES.PROJECTS}>
              작업 내역
            </Link>
            에서 다시 열 수 있어요.
          </>
        }
      >
        <ul className="flex flex-col gap-2.5">
          <ProgressStep state="done" label={`섹션 ${sectionNames.length}개 기획 확정`} />
          <ProgressStep state={done ? 'done' : 'active'} label={done ? '사진·카피를 모두 넣었어요' : (progress?.message ?? '섹션 구성 대기 중')} />
          {draft.estimate.heroMotion !== 'off' && (
            <ProgressStep state="todo" label={`맨 위 움직이는 컷(${MOTION_LABELS[draft.estimate.heroMotion]})은 에디터에서 이어서 만들어요`} />
          )}
          <ProgressStep state={done ? 'active' : 'todo'} label="에디터 열기" />
        </ul>
      </ProgressDialog>
    </>
  );
}
