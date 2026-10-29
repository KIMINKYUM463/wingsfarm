'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { useState } from 'react';
import { DRAFT_LIMITS, type DraftCut, type DraftItem, type DraftLine, type DraftSection } from '@/shared/types/draft';
import type { PreviewNode } from '../api';
import { editedLine, lineEvidence } from '../evidence';
import { storageUrl, useUploadPaths } from '../hooks';
import SectionPreview from './SectionPreview';
import { inputClass } from './ui';

interface SectionCardProps {
  index: number;
  section: DraftSection;
  typeName: string;
  preview: PreviewNode | undefined;
  /** 서버 사실 검사 결과 (자동 저장 후 갱신) */
  warnings: string[];
  photos: string[];
  onChange: (section: DraftSection) => void;
  onDelete: () => void;
}

const VISIBLE_ITEMS = 3;

/** 기획 초안의 섹션 카드 한 장 */
export default function SectionCard({ index, section, typeName, preview, warnings, photos, onChange, onDelete }: SectionCardProps) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: section.id });
  const [editing, setEditing] = useState<DraftSection | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const { uploadFiles, uploading } = useUploadPaths('reference');

  const cutImage = (cutId: string) => {
    const cut = section.cuts.find((c) => c.id === cutId);
    const photo = cut?.source === 'own' ? photos[cut.photoIndexes[0] ?? 0] : null;
    return photo ? storageUrl(photo) : null;
  };

  const updateCut = (cutId: string, patch: Partial<DraftCut>) =>
    onChange({ ...section, cuts: section.cuts.map((c) => (c.id === cutId ? { ...c, ...patch } : c)) });

  const attachReference = async (files: File[]) => {
    const [path] = await uploadFiles(files.slice(0, 1));
    if (path) onChange({ ...section, referenceImagePath: path });
  };

  const items = expanded ? section.items : section.items.slice(0, VISIBLE_ITEMS);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      id={`section-${section.id}`}
      className={clsx('flex scroll-mt-40 gap-4 rounded-2xl border bg-white p-4', isDragging ? 'z-10 border-(--color-point) shadow-lg' : 'border-gray-100')}
    >
      <button
        type="button"
        aria-label="드래그해서 순서 바꾸기"
        className="flex w-5 shrink-0 cursor-grab items-start justify-center pt-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <div className="flex w-[200px] shrink-0 flex-col gap-2">
        <div className="max-h-[320px] overflow-hidden rounded-md">
          {preview ? <SectionPreview frame={preview} cutImage={cutImage} /> : <div className="h-40 rounded-md bg-gray-50" />}
        </div>
        {section.referenceImagePath ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={storageUrl(section.referenceImagePath)} alt="섹션 레퍼런스" className="h-10 w-10 rounded object-cover" />
            <span className="flex-1">이 섹션 레퍼런스</span>
            <button type="button" className="text-gray-400" onClick={() => onChange({ ...section, referenceImagePath: null })}>
              ✕
            </button>
          </div>
        ) : (
          <label
            className="cursor-pointer rounded-lg border border-dashed border-gray-200 px-2 py-1.5 text-center text-xs text-gray-500 hover:border-gray-400"
            onPaste={(e) => void attachReference([...e.clipboardData.files])}
            tabIndex={0}
          >
            {uploading ? '올리는 중…' : '+ 레퍼런스 첨부 (클릭·붙여넣기)'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void attachReference([...(e.target.files ?? [])])} />
          </label>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex items-start gap-2">
          <span className="shrink-0 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
            {String(index + 1).padStart(2, '0')} {typeName}
          </span>
          <div className="min-w-0 flex-1 text-base font-semibold whitespace-pre-line text-gray-900">{section.title.text}</div>
          <div className="flex shrink-0 gap-1">
            <button type="button" className="btn-icon text-xs font-medium text-gray-500" onClick={() => setShowEvidence((v) => !v)}>
              근거
            </button>
            <button type="button" className="btn-icon text-xs font-medium text-gray-500" onClick={() => setEditing(structuredClone(section))}>
              내용 수정
            </button>
            <button
              type="button"
              className="btn-icon text-xs font-medium text-red-400"
              onClick={() => window.confirm(`"${typeName}" 섹션을 삭제할까요?`) && onDelete()}
            >
              삭제
            </button>
          </div>
        </header>

        {editing ? (
          <SectionEditor
            value={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={() => {
              onChange(editing);
              setEditing(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-1.5 text-sm text-gray-700">
            {section.label && <Line line={section.label} show={showEvidence} className="text-xs font-semibold text-(--color-point)" />}
            {showEvidence && <Line line={section.title} show className="font-semibold" />}
            {section.subtitle && <Line line={section.subtitle} show={showEvidence} className="text-gray-500" />}
            {items.map((item, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="text-gray-300">•</span>
                <div className="min-w-0 flex-1">
                  {item.title && <Line line={item.title} show={showEvidence} className="font-semibold text-gray-800" />}
                  <Line line={item.text} show={showEvidence} />
                </div>
              </div>
            ))}
            {section.items.length > VISIBLE_ITEMS && (
              <button type="button" className="self-start text-xs font-medium text-gray-400" onClick={() => setExpanded((v) => !v)}>
                {expanded ? '접기' : `더보기 (${section.items.length - VISIBLE_ITEMS})`}
              </button>
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <b>사실 확인 필요</b>
            {warnings.map((w) => (
              <div key={w}>· {w}</div>
            ))}
          </div>
        )}

        {section.cuts.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-50 pt-3">
            {section.cuts.map((cut, i) => (
              <CutRow key={cut.id} index={i} cut={cut} photos={photos} onChange={(patch) => updateCut(cut.id, patch)} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Line({ line, show, className }: { line: DraftLine; show: boolean; className?: string }) {
  const tags = lineEvidence(line);
  return (
    <div className={clsx('whitespace-pre-line', className)}>
      {line.text}
      {show &&
        tags.map((tag) => (
          <span key={tag} className={clsx('ml-1 inline-block rounded px-1 align-middle text-[10px] font-medium', tag === '근거 없음' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500')}>
            {tag}
          </span>
        ))}
    </div>
  );
}

/** 카드 안에서 문구 직접 고치기 (✓ 저장 / ✕ 취소) */
function SectionEditor({ value, onChange, onSave, onCancel }: { value: DraftSection; onChange: (v: DraftSection) => void; onSave: () => void; onCancel: () => void }) {
  const setLine = (line: DraftLine | null, text: string): DraftLine | null => (!text.trim() ? null : line && line.text === text ? line : editedLine(text));
  const setItem = (i: number, patch: Partial<DraftItem>) => onChange({ ...value, items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
      <input className={inputClass} placeholder="라벨 (선택)" value={value.label?.text ?? ''} onChange={(e) => onChange({ ...value, label: setLine(value.label, e.target.value) })} />
      <textarea
        className={clsx(inputClass, 'min-h-14 font-semibold')}
        maxLength={DRAFT_LIMITS.sectionTitle}
        placeholder="메인 문구"
        value={value.title.text}
        onChange={(e) => onChange({ ...value, title: setLine(value.title, e.target.value) ?? { text: '', evidence: [] } })}
      />
      <textarea className={clsx(inputClass, 'min-h-14')} placeholder="설명 문구 (선택)" value={value.subtitle?.text ?? ''} onChange={(e) => onChange({ ...value, subtitle: setLine(value.subtitle, e.target.value) })} />
      {value.items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <input className={inputClass} placeholder="항목 제목 (선택)" value={item.title?.text ?? ''} onChange={(e) => setItem(i, { title: setLine(item.title, e.target.value) })} />
            <textarea className={clsx(inputClass, 'min-h-12')} placeholder="항목 내용" value={item.text.text} onChange={(e) => setItem(i, { text: setLine(item.text, e.target.value) ?? { text: '', evidence: [] } })} />
          </div>
          <button type="button" aria-label="항목 삭제" className="btn-icon self-start text-gray-400" onClick={() => onChange({ ...value, items: value.items.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" className="text-xs font-semibold text-(--color-point)" onClick={() => onChange({ ...value, items: [...value.items, { title: null, text: editedLine('') }] })}>
          + 항목 추가
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn-outline h-8 px-3 text-xs" onClick={onCancel}>
            ✕ 취소
          </button>
          <button type="button" className="btn-primary h-8 px-3 text-xs" disabled={!value.title.text.trim()} onClick={onSave}>
            ✓ 적용
          </button>
        </div>
      </div>
    </div>
  );
}

/** 사진 컷 한 줄: 장면 이름 · 참고 사진 · AI 생성/내 사진 토글 · 컷 수정 */
function CutRow({ index, cut, photos, onChange }: { index: number; cut: DraftCut; photos: string[]; onChange: (patch: Partial<DraftCut>) => void }) {
  const [editing, setEditing] = useState(false);
  const togglePhoto = (i: number) => {
    const next = cut.photoIndexes.includes(i) ? cut.photoIndexes.filter((p) => p !== i) : [...cut.photoIndexes, i].slice(-3);
    onChange({ photoIndexes: next.length ? next : [i] });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gray-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400">컷 {index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{cut.scene}</span>
        <div className="flex gap-1">
          {cut.photoIndexes.map((i) =>
            photos[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={storageUrl(photos[i])} alt={`참고 사진 ${i + 1}`} className="h-7 w-7 rounded object-cover" />
            ) : null,
          )}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
          {(['ai', 'own'] as const).map((source) => (
            <button
              key={source}
              type="button"
              disabled={source === 'own' && !photos.length}
              onClick={() => onChange({ source })}
              className={clsx('px-2 py-1 font-medium', cut.source === source ? 'bg-gray-900 text-white' : 'bg-white text-gray-500')}
            >
              {source === 'ai' ? '✦ AI 생성' : '내 사진'}
            </button>
          ))}
        </div>
        <button type="button" className="text-xs font-medium text-gray-500" onClick={() => setEditing((v) => !v)}>
          {editing ? '닫기' : '컷 수정'}
        </button>
      </div>
      {!editing && cut.plan && <div className="line-clamp-2 text-xs text-gray-500">{cut.plan}</div>}
      {editing && (
        <div className="flex flex-col gap-2">
          <input className={inputClass} value={cut.scene} maxLength={60} placeholder="장면 이름" onChange={(e) => onChange({ scene: e.target.value })} />
          <textarea className={clsx(inputClass, 'min-h-16')} value={cut.plan} maxLength={500} placeholder="배경·구도·조명을 적어 주세요" onChange={(e) => onChange({ plan: e.target.value })} />
          <div className="text-xs text-gray-500">
            {cut.source === 'own' ? '첫 번째로 고른 사진을 그대로 넣어요.' : 'AI가 고른 사진(최대 3장)을 참고해 연출해요.'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {photos.map((p, i) => (
              <button key={p} type="button" onClick={() => togglePhoto(i)} className={clsx('relative h-12 w-12 overflow-hidden rounded-md border-2', cut.photoIndexes.includes(i) ? 'border-(--color-point)' : 'border-transparent')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={storageUrl(p)} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" />
                {cut.photoIndexes.includes(i) && (
                  <span className="absolute top-0 left-0 rounded-br bg-(--color-point) px-1 text-[10px] text-white">{cut.photoIndexes.indexOf(i) + 1}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
