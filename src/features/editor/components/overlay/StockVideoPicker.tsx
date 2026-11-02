'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { searchHeroStock } from '@/features/editor/api';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { queryKeys } from '@/shared/constants/queryKeys';
import { STOCK_SITES } from '@/shared/constants/stockSites';
import { errorMessage } from '@/shared/lib/errorMessage';
import { MAX_STOCK_PICKS, type StockVideo } from '@/shared/types/heroMotion';
import { showToast } from '@/utils/toast';

const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const SITE_LINKS = Object.values(STOCK_SITES);

const pickKey = (video: StockVideo) => `${video.source}-${video.id}`;

/**
 * 무료 영상(Pexels·Pixabay) 검색 → 최대 3개를 순서대로 고르면 AI가 좋은 장면만 골라 컷 편집한다
 * 검색어 기본값은 상품명. 검색은 버튼을 눌렀을 때만 한다(사이트별 요청 한도). 검색어를 바꿔도 고른 영상은 유지된다.
 */
export function StockVideoPicker({ projectId, disabled, onSubmit }: { projectId: string; disabled: boolean; onSubmit: (videos: StockVideo[]) => void }) {
  const productName = useCanvasDataStore((state) => state.productName);
  const [input, setInput] = useState(productName ?? '');
  const [query, setQuery] = useState<string | null>(null);
  const [picked, setPicked] = useState<StockVideo[]>([]);

  const toggle = (video: StockVideo) => {
    if (picked.some((v) => pickKey(v) === pickKey(video))) return setPicked(picked.filter((v) => pickKey(v) !== pickKey(video)));
    if (picked.length >= MAX_STOCK_PICKS) return showToast.error(`영상은 최대 ${MAX_STOCK_PICKS}개까지 고를 수 있어요.`);
    setPicked([...picked, video]);
  };

  const search = useQuery({
    queryKey: queryKeys.EDITOR.heroStock(projectId, query ?? ''),
    queryFn: () => searchHeroStock(projectId, query ?? ''),
    enabled: query !== null,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(input.trim());
  };

  const videos = search.data?.videos ?? [];

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예) 참외, melon, farm"
          className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
        />
        <button type="submit" className="btn-outline px-4 text-sm whitespace-nowrap" disabled={search.isFetching}>
          {search.isFetching ? '찾는 중…' : '무료 영상 찾기'}
        </button>
      </form>

      {search.isError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMessage(search.error)}</p>}
      {search.data?.notices.map((notice) => (
        <p key={notice} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {notice}
        </p>
      ))}
      {search.isSuccess && !videos.length && (
        <p className="text-xs text-gray-500">&apos;{search.data.query}&apos; 영상이 없어요. 영어(예: melon)나 더 넓은 말(예: 과일, 농장)로 찾아 보세요.</p>
      )}

      {videos.length > 0 && (
        <div className="grid max-h-[45vh] auto-rows-max grid-cols-2 gap-3 overflow-y-auto p-1">
          {videos.map((video) => {
            const order = picked.findIndex((v) => pickKey(v) === pickKey(video)) + 1;
            return (
              <button
                key={pickKey(video)}
                type="button"
                disabled={disabled}
                aria-pressed={order > 0}
                onClick={() => toggle(video)}
                title={`${video.author} · ${STOCK_SITES[video.source].label} · ${order ? '눌러서 빼기' : '눌러서 고르기'}`}
                className={clsx(
                  'group relative aspect-video overflow-hidden rounded-lg bg-gray-100 disabled:opacity-50',
                  order > 0 && 'ring-3 ring-(--color-point) ring-offset-1',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnail} alt={`${video.author}의 영상`} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{STOCK_SITES[video.source].label}</span>
                <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{formatSeconds(video.duration)}</span>
                {order > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-(--color-point) text-xs font-bold text-white shadow">{order}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button type="button" className="btn-primary text-sm" disabled={disabled || !picked.length} onClick={() => onSubmit(picked)}>
        {picked.length ? `✦ 고른 영상 ${picked.length}개로 AI 컷 편집하기` : `영상을 1~${MAX_STOCK_PICKS}개 골라 주세요`}
      </button>

      <p className="text-xs leading-5 text-gray-500">
        AI(Gemini)가 고른 영상의 장면을 보고 좋은 부분만 짧게 잘라 컷 편집해요(약 5~8초, Gemini 키로 아주 적은 비용). 다 되면 미리 보고 <b>적용</b>을 눌러야 맨 위에 들어가요. 실제 상품이 아닌 분위기 영상이니 상품과 어울리는지 확인해 주세요. 영상 제공{' '}
        {SITE_LINKS.map((site, i) => (
          <span key={site.url}>
            {i > 0 && ' · '}
            <a href={site.url} target="_blank" rel="noreferrer" className="underline">
              {site.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
