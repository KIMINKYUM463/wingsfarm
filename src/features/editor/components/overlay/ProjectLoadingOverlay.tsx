import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ILLUSTRATIONS } from '@/shared/constants/assets';
import type { ProjectGenerationStatus } from '@/shared/types/detail-page';

interface ProjectLoadingOverlayProps {
  jobStatus?: ProjectGenerationStatus | null;
}

/**
 * 상태별 진행률 범위 및 메시지 정의
 *
 * ## 상태 흐름
 * draft_based_pending → context_pending → context_processing
 * → ai_pending → ai_processing → ai_completed
 * → saving_pending → saving_processing → completed
 */
const STATUS_CONFIG: Record<
  ProjectGenerationStatus,
  { range: [number, number]; message: string; speed: number }
> = {
  draft_based_pending: {
    range: [0, 10],
    message: '초안 프로젝트를 불러오고 있습니다.',
    speed: 300,
  },
  context_pending: {
    range: [10, 20],
    message: 'AI 컨텍스트 생성을 준비하고 있습니다.',
    speed: 300,
  },
  context_processing: {
    range: [20, 40],
    message: '상품 정보를 분석하고 아이디어를 정리하고 있습니다.',
    speed: 1500, // 느리게 (무거운 작업)
  },
  ai_pending: {
    range: [40, 50],
    message: 'AI 텍스트 생성을 준비하고 있습니다.',
    speed: 300,
  },
  ai_processing: {
    range: [50, 80],
    message: 'AI가 매력적인 카피라이팅을 작성하고 있습니다.',
    speed: 2000, // 가장 느리게 (가장 무거운 작업)
  },
  ai_completed: {
    range: [80, 85],
    message: 'AI 처리가 완료되었습니다.',
    speed: 200,
  },
  saving_pending: {
    range: [85, 90],
    message: '프로젝트 저장을 준비하고 있습니다.',
    speed: 300,
  },
  saving_processing: {
    range: [90, 98],
    message: '프로젝트를 저장하고 있습니다.',
    speed: 500,
  },
  completed: {
    range: [98, 100],
    message: '프로젝트가 생성되었습니다!',
    speed: 100,
  },
  // 실패 상태들 (진행률 고정)
  context_failed: {
    range: [0, 0],
    message: '컨텍스트 생성에 실패했습니다.',
    speed: 0,
  },
  ai_failed: {
    range: [0, 0],
    message: 'AI 처리에 실패했습니다.',
    speed: 0,
  },
  saving_failed: {
    range: [0, 0],
    message: '저장에 실패했습니다.',
    speed: 0,
  },
};

/**
 * 프로젝트 생성 중 로딩 오버레이
 *
 * 상태 기반 프로그레스 표시 + 상태별 메시지
 */
export default function ProjectLoadingOverlay({ jobStatus }: ProjectLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);

  // 상태에 따라 자동으로 progress 증가
  useEffect(() => {
    if (!jobStatus) return;

    const config = STATUS_CONFIG[jobStatus];
    if (!config) return;

    const [minProgress, maxProgress] = config.range;

    // 완료 상태면 즉시 100%
    if (jobStatus === 'completed') {
      setProgress(100);
      return;
    }

    // 실패 상태면 진행률 고정
    if (jobStatus.endsWith('_failed')) {
      return;
    }

    // 현재 상태의 시작 지점으로 즉시 이동
    setProgress(minProgress);

    // 상태별 속도로 점진적 증가
    const interval = setInterval(() => {
      setProgress((prev) => {
        // 현재 상태의 최대값까지만 증가
        if (prev >= maxProgress) return prev;
        return prev + 1;
      });
    }, config.speed);

    return () => clearInterval(interval);
  }, [jobStatus]);

  // 상태별 메시지 가져오기
  const getMessage = () => {
    if (!jobStatus) return '프로젝트를 생성하고 있습니다.';
    return STATUS_CONFIG[jobStatus]?.message || '프로젝트를 생성하고 있습니다.';
  };

  const message = getMessage();
  const isError = jobStatus?.endsWith('_failed');

  return (
    <div className="fixed inset-0 z-9999 flex animate-overlay-in items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="flex flex-col items-center">
        <Image
          src={ILLUSTRATIONS.ProjectLoading}
          alt="project-loading"
          className="mb-9.25"
          width={262.5}
          height={370.5}
          loading="eager"
        />
        <h3 className={`mb-2 ${isError ? 'text-red-400' : 'text-white'}`}>{message}</h3>
        <p className="text-gray-200 mb-4.5">
          {isError ? '잠시 후 다시 시도해주세요.' : '잠시만 기다려주세요.'}
        </p>
        {!isError && <h1 className="text-white">{`${progress}%`}</h1>}
        {!isError && (
          <p className="text-gray-200 mt-8">이 페이지를 벗어나면 생성이 중단됩니다.</p>
        )}
      </div>
    </div>
  );
}
