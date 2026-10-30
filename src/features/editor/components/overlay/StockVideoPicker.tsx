'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { searchHeroStock } from '@/features/editor/api';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { queryKeys } from '@/shared/constants/queryKeys';
import { errorMessage } from '@/shared/lib/errorMessage';

const PEXELS_URL = 'https://www.pexels.com';

const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * 무료 영상(Pexels) 검색 → 하나 고르면 서버가 가운데 5초를 사진 자리 크기로 잘라 움직이는 컷으로 만든다
 * 검색어 기본값은 상품명. 검색은 버튼을 눌렀을 때만 한다(시간당 200회 한도).
 */
export function StockVideoPicker({ projectId, disabled, onPick }: { projectId: string; disabled: boolean; onPick: (videoId: number) => void }) {
  const productName = useCanvasDataStore((state) => state.productName);
  const [input, setInput] = useState(productName ?? '');
  const [query, setQuery] = useState<string | null>(null);

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
      {search.isSuccess && !videos.length && (
        <p className="text-xs text-gray-500">&apos;{search.data.query}&apos; 영상이 없어요. 영어(예: melon)나 더 넓은 말(예: 과일, 농장)로 찾아 보세요.</p>
      )}

      {videos.length > 0 && (
        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
          {videos.map((video) => (
            <button
              key={video.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(video.id)}
              title={`${video.author} · 눌러서 맨 위 컷으로 쓰기`}
              className="group relative aspect-video overflow-hidden rounded-lg bg-gray-100 disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.thumbnail} alt={`${video.author}의 영상`} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
              <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] text-white">{formatSeconds(video.duration)}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs leading-5 text-gray-500">
        고른 영상의 가운데 5초를 맨 위 사진 자리 크기로 잘라 써요. 실제 상품이 아닌 분위기 영상이니 상품과 어울리는지 확인해 주세요. 영상 제공{' '}
        <a href={PEXELS_URL} target="_blank" rel="noreferrer" className="underline">
          Pexels
        </a>
      </p>
    </div>
  );
}
