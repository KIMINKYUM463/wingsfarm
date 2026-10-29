/**
 * Project Generation Job 조회 + Realtime 구독 훅 (Broadcast 방식)
 *
 * ## 특징
 * 1. **초기 조회**: useQuery로 REST API 호출
 * 2. **실시간 업데이트**: Broadcast 이벤트 (private channel)
 * 3. **서버 채널 구조**: `project_generation_jobs_status_realtime:${userId}:${jobId}`
 * 4. **조기 반환 패턴**: 완료/실패 시 자동 구독 해제
 *
 * ## 서버 broadcast 형식
 * ```typescript
 * channel.send({
 *   type: 'broadcast',
 *   event: 'UPDATE',
 *   payload: { record: { id, status, project_id, error_message } }
 * });
 * ```
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getProjectGenerationJob } from '../api';
import { getBrowserSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type {
  ProjectGenerationStatus,
  ProjectGenerationJobRealtimeUpdate,
} from '@/shared/types/detail-page';

// 재구독 설정: 구독 성공 후 30초 뒤 무조건 재구독 1회, 그 후 폴링 전환
const RESUBSCRIBE_DELAY_MS = 30000; // 30초

// 상태 진행도 (높을수록 진행됨, failed는 터미널이므로 최대값)
const STATUS_PROGRESS: Record<string, number> = {
  pending: 0,
  context_pending: 1,
  context_processing: 2,
  ai_pending: 3,
  ai_processing: 4,
  ai_completed: 5,
  saving_pending: 6,
  saving_processing: 7,
  completed: 8,
  // failed 상태들은 터미널
  context_failed: 100,
  ai_failed: 100,
  saving_failed: 100,
};

const getStatusProgress = (s: string | null): number => {
  if (!s) return -1;
  return STATUS_PROGRESS[s] ?? -1;
};

export const useProjectGenerationJob = (
  jobId: string | null,
  onComplete?: (projectId: string) => void,
  onStatusChange?: (status: ProjectGenerationStatus | null, errorMessage: string | null) => void,
) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasCompletedRef = useRef(false); // onComplete 중복 호출 방지
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // 상태 전환 시간 측정용
  const lastStatusChangeTimeRef = useRef<number>(Date.now());
  const prevStatusRef = useRef<ProjectGenerationStatus | null>(null);

  // 재구독 관련
  const resubscribeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedResubscribeRef = useRef(false);
  const isResubscribingRef = useRef(false); // 재구독 중 상태 정체 감지 비활성화용
  const stagnationTimeRef = useRef<number>(Date.now()); // 상태 정체 감지용 타임스탬프

  // status 상태 관리 (초기 API + Realtime 업데이트)
  const [status, setStatus] = useState<ProjectGenerationStatus | null>(null);

  // Realtime 연결 상태 (실패 시 polling으로 전환)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);

  // saving 상태인지 확인 (saving_pending, saving_processing)
  const isSavingStatus = status?.startsWith('saving_');

  // 초기 상태 조회 (REST API)
  // saving 상태 또는 Realtime 실패 시 polling
  const { data: initialJobData, isLoading: isInitialLoading } = useQuery({
    queryKey: ['projectGenerationJob', jobId],
    queryFn: () => getProjectGenerationJob(jobId!),
    enabled: !!jobId,
    staleTime: 0, // 항상 최신 상태 조회
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // saving 상태: 5초마다 polling (Realtime 놓칠 수 있음)
    // Realtime 실패 시: 10초마다 polling
    // ai_completed: 사용자 입력 대기 상태 - polling 불필요
    refetchInterval: (() => {
      if (!status || status === 'completed' || status === 'ai_completed' || status.endsWith('_failed')) return false;
      if (isSavingStatus) return 5000; // saving 상태는 5초
      if (!isRealtimeConnected) return 10000; // Realtime 실패 시 10초
      return false;
    })(),
  });

  // 초기 상태 설정 및 완료된 Job 처리
  useEffect(() => {
    if (!initialJobData) return;

    const { status: initialStatus, projectId } = initialJobData;

    // 상태 진행도 비교 - API 응답이 더 진행된 상태면 적용 (Realtime 놓침 복구)
    const currentProgress = getStatusProgress(status);
    const newProgress = getStatusProgress(initialStatus);

    if (newProgress <= currentProgress) {
      return;
    }

    setStatus(initialStatus);

    // 완료된 경우 즉시 리다이렉트 (중복 호출 방지)
    if (initialStatus === 'completed' && projectId && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onCompleteRef.current?.(projectId);
    }
  }, [initialJobData, status]);

  // 실시간 처리 중 여부 계산
  const isRealTimePending = useMemo(() => {
    if (!status) return true;
    if (status.endsWith('_failed')) return false;
    return status !== 'completed';
  }, [status]);

  // 재구독 타이머 정리
  const clearResubscribeTimer = useCallback(() => {
    if (!resubscribeTimerRef.current) return;
    clearTimeout(resubscribeTimerRef.current);
    resubscribeTimerRef.current = null;
  }, []);

  // 채널 정리
  const cleanupChannel = useCallback(() => {
    if (!channelRef.current) return;
    const supabase = getBrowserSupabaseClient();
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  // 콜백을 ref로 안정화 (effect 재실행 방지)
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // 상태 변경 핸들러
  const handleStatusChange = useCallback(
    (newStatus: ProjectGenerationStatus | null, errorMessage: string | null) => {
      onStatusChangeRef.current?.(newStatus, errorMessage);

      // ai_completed: 사용자 입력 대기 상태 - 재구독 타이머만 클리어 (Realtime은 유지)
      if (newStatus === 'ai_completed') {
        clearResubscribeTimer();
        return;
      }

      const isFinished = newStatus === 'completed' || newStatus?.endsWith('_failed');
      if (!isFinished) return;

      clearResubscribeTimer();
      cleanupChannel();
    },
    [clearResubscribeTimer, cleanupChannel],
  );

  // 상태 정체 감지 - 재구독 후 30초 무응답 시 Realtime 끊고 폴링으로 완전 전환
  useEffect(() => {
    // ai_completed: 사용자 입력 대기 상태 - 정체 감지 불필요
    if (!jobId || !status || status === 'completed' || status === 'ai_completed' || status.endsWith('_failed')) return;
    // 이미 폴링 모드면 스킵
    if (!isRealtimeConnected) return;

    const STATUS_TIMEOUT = 30000; // 30초
    stagnationTimeRef.current = Date.now(); // status 변경 시 리셋

    const interval = setInterval(() => {
      // 재구독 중에는 상태 정체 감지 스킵
      if (isResubscribingRef.current) return;
      // 재구독 시도 전에는 상태 정체 감지 스킵 (재구독 후부터 체크)
      if (!hasAttemptedResubscribeRef.current) return;

      if (Date.now() - stagnationTimeRef.current > STATUS_TIMEOUT) {
        // Realtime 끊고 폴링으로 완전 전환
        clearResubscribeTimer();
        cleanupChannel();
        setIsRealtimeConnected(false);
      }
    }, 10000); // 10초마다 체크

    return () => clearInterval(interval);
  }, [status, jobId, isRealtimeConnected, clearResubscribeTimer, cleanupChannel]);

  // Broadcast 이벤트 핸들러
  const handleBroadcastUpdate = useCallback(
    (response: unknown) => {
      const realtimeUpdate = response as ProjectGenerationJobRealtimeUpdate;
      if (!realtimeUpdate?.payload?.record?.status) return;

      const { status: newStatus, project_id: projectId, job_id: receivedJobId } = realtimeUpdate.payload.record;

      lastStatusChangeTimeRef.current = Date.now();
      prevStatusRef.current = newStatus;

      setStatus(newStatus);

      // 완료 시 캐시 최적화 + 콜백 호출
      if (newStatus === 'completed' && projectId && jobId) {
        queryClient.setQueryData(['projectGenerationJob', jobId], {
          status: newStatus,
          jobId: receivedJobId,
          projectId,
          updatedAt: realtimeUpdate.payload.record.updated_at,
        });
        queryClient.setQueryDefaults(['projectGenerationJob', jobId], {
          staleTime: Infinity,
          gcTime: Infinity,
        });

        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onCompleteRef.current?.(projectId);
        }
      }

      handleStatusChange(newStatus, null);
    },
    [handleStatusChange, jobId, queryClient],
  );

  // Broadcast 구독 설정
  useEffect(() => {
    if (!jobId || !user?.id) return;

    const supabase = getBrowserSupabaseClient();
    const channelName = `project_generation_jobs_status_realtime:${user.id}:${jobId}`;
    let isCancelled = false;

    // jobId 변경 시 상태 및 ref 초기화 (이전 job 상태가 남아있으면 안됨)
    setStatus(null);
    setIsRealtimeConnected(true);
    hasAttemptedResubscribeRef.current = false;
    isResubscribingRef.current = false;
    hasCompletedRef.current = false;
    stagnationTimeRef.current = Date.now();
    prevStatusRef.current = null;
    lastStatusChangeTimeRef.current = Date.now();

    // 폴링으로 전환
    const switchToPolling = () => {
      cleanupChannel();
      setIsRealtimeConnected(false);
    };

    // 재구독 콜백 처리
    let isResubscribeResultHandled = false; // removeChannel이 CLOSED를 다시 트리거하는 무한 루프 방지
    const handleResubscribeResult = (status: string, _err: Error | null | undefined, newChannel: RealtimeChannel) => {
      // 이미 처리됨 - removeChannel이 onClose를 다시 트리거할 수 있음
      if (isResubscribeResultHandled) return;
      isResubscribeResultHandled = true;

      isResubscribingRef.current = false;
      stagnationTimeRef.current = Date.now();

      // unmount 후 콜백 도착 시 채널 정리 후 종료
      if (isCancelled) {
        supabase.removeChannel(newChannel);
        return;
      }

      if (status === 'SUBSCRIBED') {
        channelRef.current = newChannel;
        setIsRealtimeConnected(true);
        return;
      }

      // 실패 시 새 채널 정리
      supabase.removeChannel(newChannel);
      switchToPolling();
    };

    // 재구독 실행
    const executeResubscribe = async () => {
      // 이중 실행 방지 (타이머 orphan 대비)
      if (hasAttemptedResubscribeRef.current) return;

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

      // 새 채널 생성 및 구독
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
    let isInitialResultHandled = false; // removeChannel이 CLOSED를 다시 트리거하는 무한 루프 방지
    const handleInitialSubscribeResult = (status: string, _err: Error | null | undefined, channel: RealtimeChannel) => {
      // 이미 처리됨 - removeChannel이 onClose를 다시 트리거할 수 있음
      if (isInitialResultHandled) return;
      isInitialResultHandled = true;

      // unmount 후 콜백 도착 시 채널 정리 후 종료
      if (isCancelled) {
        supabase.removeChannel(channel);
        return;
      }

      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
        setIsRealtimeConnected(true);
        scheduleResubscribe();
        return;
      }

      // 실패/끊김 시 채널 정리 및 폴링 전환
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsRealtimeConnected(false);

      // 재구독 미시도 시에만 예약 (중복 예약 방지)
      if (!hasAttemptedResubscribeRef.current) {
        scheduleResubscribe();
      }
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
  }, [jobId, user?.id, handleBroadcastUpdate, clearResubscribeTimer, cleanupChannel]);

  // 외부에서 구독 해제
  const unsubscribe = useCallback(() => {
    clearResubscribeTimer();
    cleanupChannel();
    hasCompletedRef.current = true;
  }, [clearResubscribeTimer, cleanupChannel]);

  return { status, isRealTimePending, isInitialLoading, unsubscribe };
};
