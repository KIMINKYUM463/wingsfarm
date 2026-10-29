/**
 * AI 이미지 생성 V2 Job Realtime 구독 훅 (폴링 폴백 포함)
 *
 * ## 특징
 * 1. **실시간 업데이트**: Broadcast 이벤트 (private channel)
 * 2. **폴링 폴백**: Realtime 실패 시 3초 간격 폴링
 * 3. **서버 채널 구조**: `image_generation_jobs_status_realtime:${userId}:${jobId}`
 * 4. **조기 반환 패턴**: 완료/실패 시 자동 구독 해제
 *
 * ## 서버 broadcast 형식
 * ```typescript
 * channel.send({
 *   type: 'broadcast',
 *   event: 'UPDATE',
 *   payload: { record: { job_id, asset_id, status, image_url, error_message } }
 * });
 * ```
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { getBrowserSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { getImageGenerationJob } from '@/features/detail-page/api';
import { showToast } from '@/utils/toast';
import type {
  ImageGenerationJobStatus,
  ImageGenerationJobRealtimeUpdate,
} from '@/shared/types/detail-page';

/** 완료된 이미지 정보 */
export interface CompletedImageInfo {
  jobId: string;
  assetId: string;
  imageUrl: string;
}

/** 훅 옵션 */
interface UseImageGenerationJobV2Options {
  /** 완료 콜백 */
  onComplete?: (info: CompletedImageInfo) => void;
  /** 상태 변경 콜백 */
  onStatusChange?: (status: ImageGenerationJobStatus) => void;
}

// 재구독 설정
const RESUBSCRIBE_DELAY_MS = 30000; // 30초 후 재구독
const POLLING_INTERVAL_MS = 3000; // 폴링 간격 3초 (API 명세 권장: 2-3초)

// 상태 진행도 (높을수록 진행됨)
const STATUS_PROGRESS: Record<ImageGenerationJobStatus, number> = {
  pending: 0,
  processing: 1,
  completed: 2,
  failed: 2, // 터미널 상태
};

// 완료 토스트를 이미 보여준 jobId 추적 (패널 전환 후 중복 토스트 방지)
const jobsWithCompletionToast = new Set<string>();

const getStatusProgress = (s: ImageGenerationJobStatus | null): number => {
  if (!s) return -1;
  return STATUS_PROGRESS[s] ?? -1;
};

/**
 * AI 이미지 생성 V2 Job Realtime 구독 훅
 *
 * @param projectId - 프로젝트 ID (폴링 API용)
 * @param jobId - 구독할 Job ID (null이면 구독 안 함)
 * @param options - 콜백 옵션
 */
export const useImageGenerationJobV2 = (
  projectId: string | null,
  jobId: string | null,
  options: UseImageGenerationJobV2Options = {},
) => {
  const { onComplete, onStatusChange } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const resubscribeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedResubscribeRef = useRef(false);
  const isResubscribingRef = useRef(false);
  const stagnationTimeRef = useRef<number>(Date.now());

  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<ImageGenerationJobStatus | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  // 상태 ref (Realtime 핸들러 stale closure 방지)
  const statusRef = useRef<ImageGenerationJobStatus | null>(null);
  statusRef.current = status;

  // 완료 상태 ref (콜백에서 stale closure 방지)
  const isCompletedRef = useRef(isCompleted);
  isCompletedRef.current = isCompleted;

  // 콜백 ref 안정화
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // 타이머 정리
  const clearResubscribeTimer = useCallback(() => {
    if (resubscribeTimerRef.current) {
      clearTimeout(resubscribeTimerRef.current);
      resubscribeTimerRef.current = null;
    }
  }, []);

  // 채널 정리
  const cleanupChannel = useCallback(() => {
    if (!channelRef.current) return;
    const supabase = getBrowserSupabaseClient();
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  // 구독 해제 (외부 호출용)
  const unsubscribe = useCallback(() => {
    clearResubscribeTimer();
    cleanupChannel();
    isCompletedRef.current = true;
    setIsCompleted(true);
  }, [clearResubscribeTimer, cleanupChannel]);

  // 완료 처리
  const handleJobComplete = useCallback(
    (info: CompletedImageInfo) => {
      if (isCompletedRef.current) return;
      isCompletedRef.current = true;
      setIsCompleted(true);
      // 이 jobId에 대해 토스트를 이미 보여줬으면 스킵 (패널 전환 후 중복 방지)
      if (!jobsWithCompletionToast.has(info.jobId)) {
        jobsWithCompletionToast.add(info.jobId);
        showToast.success('이미지가 생성되었어요!');
      }
      onCompleteRef.current?.(info);
      clearResubscribeTimer();
      cleanupChannel();
    },
    [clearResubscribeTimer, cleanupChannel],
  );

  // 실패 처리
  const handleJobError = useCallback(
    (errorMessage: string | null) => {
      if (isCompletedRef.current) return;
      isCompletedRef.current = true;
      setIsCompleted(true);
      // 에러 토스트 표시
      showToast.error(errorMessage || '이미지 생성에 실패했어요. 다시 시도해주세요.');
      clearResubscribeTimer();
      cleanupChannel();
    },
    [clearResubscribeTimer, cleanupChannel],
  );

  // 폴링 활성화 여부 계산
  // - 마운트 시 무조건 한 번 조회 (탭 전환 후 복귀 대응)
  // - Realtime 실패 시에만 반복 폴링
  const isPollingEnabled = !!projectId && !!jobId && !isCompleted;
  const shouldRefetch =
    isPollingEnabled && !isRealtimeConnected && status !== 'completed' && status !== 'failed';

  // 폴링 쿼리 (마운트 시 초기 조회 + Realtime 실패 시 폴백)
  const { data: pollingData } = useQuery({
    queryKey: ['imageGenerationJob', projectId, jobId],
    queryFn: () => getImageGenerationJob(projectId!, jobId!),
    enabled: isPollingEnabled,
    staleTime: 0,
    refetchOnMount: 'always', // 마운트 시 항상 조회 (탭 전환 후 복귀 대응)
    refetchOnWindowFocus: false,
    refetchInterval: shouldRefetch ? POLLING_INTERVAL_MS : false,
  });

  // 폴링 데이터 처리
  useEffect(() => {
    if (!pollingData || isCompletedRef.current) return;

    const { status: newStatus, jobId: polledJobId, assetId, imageUrl, errorMessage } = pollingData;

    // 상태 진행도 비교 - 더 진행된 상태만 적용
    const currentProgress = getStatusProgress(statusRef.current);
    const newProgress = getStatusProgress(newStatus);

    if (newProgress <= currentProgress) {
      return;
    }

    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
    stagnationTimeRef.current = Date.now();

    // 완료 처리
    if (newStatus === 'completed' && imageUrl) {
      handleJobComplete({ jobId: polledJobId, assetId, imageUrl });
      return;
    }

    // 실패 처리
    if (newStatus === 'failed') {
      handleJobError(errorMessage);
    }
  }, [pollingData, handleJobComplete, handleJobError]);

  // Broadcast 이벤트 핸들러 (statusRef 사용으로 stale closure 방지)
  const handleBroadcastUpdate = useCallback(
    (response: unknown) => {
      const update = response as ImageGenerationJobRealtimeUpdate;
      if (!update?.payload?.record?.status) return;

      const { status: newStatus, asset_id, image_url, error_message, job_id } = update.payload.record;

      // 상태 진행도 비교 - statusRef로 최신 상태 참조
      const currentProgress = getStatusProgress(statusRef.current);
      const newProgress = getStatusProgress(newStatus);

      if (newProgress <= currentProgress) {
        return;
      }

      // 상태 업데이트
      setStatus(newStatus);
      onStatusChangeRef.current?.(newStatus);
      stagnationTimeRef.current = Date.now();

      // 완료 처리
      if (newStatus === 'completed' && image_url) {
        handleJobComplete({ jobId: job_id, assetId: asset_id, imageUrl: image_url });
        return;
      }

      // 실패 처리
      if (newStatus === 'failed') {
        handleJobError(error_message);
      }
    },
    [handleJobComplete, handleJobError], // status 제거, statusRef 사용
  );

  // 상태 정체 감지 - 재구독 후 60초 무응답 시 폴링으로 전환
  useEffect(() => {
    if (!jobId || !status || status === 'completed' || status === 'failed') return;
    if (!isRealtimeConnected) return; // 이미 폴링 모드

    const STAGNATION_TIMEOUT_MS = 60000; // 60초

    const interval = setInterval(() => {
      if (isResubscribingRef.current) return;
      if (!hasAttemptedResubscribeRef.current) return;

      if (Date.now() - stagnationTimeRef.current > STAGNATION_TIMEOUT_MS) {
        clearResubscribeTimer();
        cleanupChannel();
        setIsRealtimeConnected(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [status, jobId, isRealtimeConnected, clearResubscribeTimer, cleanupChannel]);

  // Realtime 구독 (완료 상태면 구독 안 함)
  useEffect(() => {
    // 이미 완료된 상태면 구독 불필요
    if (!jobId || !user?.id || isCompleted) return;

    const supabase = getBrowserSupabaseClient();
    const channelName = `image_generation_jobs_status_realtime:${user.id}:${jobId}`;
    let isCancelled = false;

    // 상태 초기화 (첫 마운트에서만)
    if (!isCompletedRef.current) {
      setStatus('pending');
      setIsRealtimeConnected(true);
    }
    hasAttemptedResubscribeRef.current = false;
    isResubscribingRef.current = false;
    stagnationTimeRef.current = Date.now();

    // 폴링으로 전환
    const switchToPolling = () => {
      cleanupChannel();
      setIsRealtimeConnected(false);
    };

    // 재구독 콜백 처리
    let isResubscribeResultHandled = false;
    const handleResubscribeResult = (
      subscriptionStatus: string,
      err: Error | null | undefined,
      newChannel: RealtimeChannel,
    ) => {
      if (isResubscribeResultHandled) return;
      isResubscribeResultHandled = true;

      isResubscribingRef.current = false;
      stagnationTimeRef.current = Date.now();

      if (isCancelled) {
        supabase.removeChannel(newChannel);
        return;
      }

      if (subscriptionStatus === 'SUBSCRIBED') {
        channelRef.current = newChannel;
        setIsRealtimeConnected(true);
        return;
      }

      supabase.removeChannel(newChannel);
      switchToPolling();
    };

    // 재구독 실행
    const executeResubscribe = async () => {
      if (hasAttemptedResubscribeRef.current || isCompletedRef.current) return;
      hasAttemptedResubscribeRef.current = true;
      isResubscribingRef.current = true;

      // 기존 채널 정리
      if (channelRef.current) {
        await channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (isCancelled) {
        isResubscribingRef.current = false;
        return;
      }

      // 새 채널 생성
      isResubscribeResultHandled = false;
      const newChannel = supabase.channel(channelName, { config: { private: true } });
      newChannel
        .on('broadcast', { event: 'UPDATE' }, handleBroadcastUpdate)
        .subscribe((status, err) => handleResubscribeResult(status, err, newChannel));
    };

    // 30초 후 재구독 예약
    const scheduleResubscribe = () => {
      if (hasAttemptedResubscribeRef.current) return;
      resubscribeTimerRef.current = setTimeout(() => {
        if (isCancelled) return;
        executeResubscribe();
      }, RESUBSCRIBE_DELAY_MS);
    };

    // 초기 구독 콜백 처리
    let isInitialResultHandled = false;
    const handleInitialSubscribeResult = (
      subscriptionStatus: string,
      err: Error | null | undefined,
      channel: RealtimeChannel,
    ) => {
      if (isInitialResultHandled) return;
      isInitialResultHandled = true;

      if (isCancelled) {
        supabase.removeChannel(channel);
        return;
      }

      if (subscriptionStatus === 'SUBSCRIBED') {
        channelRef.current = channel;
        setIsRealtimeConnected(true);
        scheduleResubscribe();
        return;
      }

      // 실패/타임아웃/닫힘 시 폴링으로 전환
      supabase.removeChannel(channel);
      switchToPolling();
    };

    // 초기 채널 설정
    const setupChannel = async () => {
      await supabase.realtime.setAuth();
      if (isCancelled) return;

      const channel = supabase.channel(channelName, { config: { private: true } });
      channel
        .on('broadcast', { event: 'UPDATE' }, handleBroadcastUpdate)
        .subscribe((status, err) => handleInitialSubscribeResult(status, err, channel));
    };

    setupChannel();

    return () => {
      isCancelled = true;
      clearResubscribeTimer();
      if (channelRef.current) {
        cleanupChannel();
      }
    };
  }, [jobId, user?.id, isCompleted, handleBroadcastUpdate, clearResubscribeTimer, cleanupChannel]);

  return {
    status,
    isRealtimeConnected,
    unsubscribe,
    isCompleted,
  };
};
