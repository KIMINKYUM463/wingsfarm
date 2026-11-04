'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useImageUpload } from '@/features/detail-page/hooks/useImageUpload';
import type { ImageType } from '@/features/detail-page/types';
import { errorMessage } from '@/shared/lib/errorMessage';
import { draftApi, type DraftDto } from './api';

export const draftKey = (id: string) => ['draft', id] as const;
export const DRAFTS_KEY = ['drafts'] as const;

/** 저장소 경로 → 화면에 띄울 URL */
export const storageUrl = (path: string) => `/api/lever/storage/${path.split('/').map(encodeURIComponent).join('/')}`;

const RUNNING = ['composing', 'planning', 'generating'];

/** 초안 조회 — 기획·생성 중에는 1.5초마다 다시 불러온다 (진행 상황 n/N 표시) */
export function useDraft(id: string | null) {
  return useQuery({
    queryKey: draftKey(id ?? ''),
    queryFn: () => draftApi.get(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => (RUNNING.includes(query.state.data?.status ?? '') ? 1500 : false),
  });
}

export { errorMessage };

/** 서버 응답으로 초안 캐시를 갱신하는 mutation */
export function useDraftMutation<TArgs>(fn: (args: TArgs) => Promise<DraftDto>, onDone?: (draft: DraftDto) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (draft) => {
      queryClient.setQueryData(draftKey(draft.id), draft);
      void queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
      onDone?.(draft);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

/**
 * 값이 바뀌면 delay 뒤에 저장 (타이핑하는 대로 자동 저장)
 * - 저장 중 상태와 마지막 저장 시각을 돌려준다
 * - 화면을 떠날 때 저장되지 않은 값이 있으면 바로 저장한다
 */
export function useAutosave<T>(value: T | null, save: (value: T) => Promise<unknown>, delay = 800) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const latest = useRef(value);
  const lastSaved = useRef<string | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(async () => {
    const current = latest.current;
    if (current === null) return;
    const serialized = JSON.stringify(current);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    setSaving(true);
    try {
      await saveRef.current(current);
      setSavedAt(new Date());
    } catch (err) {
      lastSaved.current = null;
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    latest.current = value;
    if (value === null) return;
    if (lastSaved.current === null) {
      lastSaved.current = JSON.stringify(value);
      return;
    }
    const timer = setTimeout(() => void flush(), delay);
    return () => clearTimeout(timer);
  }, [value, delay, flush]);

  useEffect(() => () => void flush(), [flush]);

  /** 서버에서 새 값을 받아 로컬을 갈아끼울 때 (그 값은 다시 저장하지 않음) */
  const markSaved = useCallback((next: T) => {
    lastSaved.current = JSON.stringify(next);
  }, []);

  return { saving, savedAt, flush, markSaved };
}

/** 이미지 여러 장 업로드 → 저장소 경로 목록 */
export function useUploadPaths(type: ImageType = 'product') {
  const upload = useImageUpload(type);
  const uploadFiles = async (files: File[]) => {
    const images = files.filter((f) => /^image\/(png|jpe?g|webp|gif)$/.test(f.type));
    if (images.length < files.length) toast.error('PNG·JPG·WEBP·GIF 이미지만 올릴 수 있어요.');
    if (!images.length) return [];
    try {
      const result = await upload.mutateAsync(images);
      result.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      return result.map((r) => r.uploadedPath);
    } catch (err) {
      toast.error(errorMessage(err));
      return [];
    }
  };
  return { uploadFiles, uploading: upload.isPending };
}
