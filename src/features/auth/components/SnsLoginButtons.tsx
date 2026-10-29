'use client';

import Button from '@/shared/ui/Button/Button';
import CustomIcon from '@/shared/ui/CustomIcon';
import { signInWithKakao, signInWithGoogle } from '@/features/auth/auth.api';

/**
 * SNS 로그인 버튼 그룹 컴포넌트
 * Kakao와 Google 로그인 버튼을 제공합니다.
 */
const SnsLoginButtons = () => {
  return (
    <div className="flex flex-col gap-2">
      {/* 카카오 로그인 - 공식 가이드: hover 시 약간 어둡게 */}
      <Button
        onClick={signInWithKakao}
        justify="start"
        className="grid h-10 w-full grid-cols-[18px_1fr_18px] items-center gap-2 rounded-lg bg-[#fee500] px-4 hover:bg-[#f5dc00] active:bg-[#e6cf00]"
      >
        <CustomIcon name="kakao" width={18} height={18} />
        <span className="p text-center">카카오로 시작하기</span>
      </Button>

      {/* 구글 로그인 - 공식 가이드: hover 시 연한 회색 배경 */}
      <Button
        onClick={signInWithGoogle}
        justify="start"
        className="grid h-10 w-full grid-cols-[18px_1fr_18px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 hover:bg-[#f8f9fa] active:bg-[#e8e8e8]"
      >
        <CustomIcon name="google" width={18} height={18} />
        <span className="p text-center">구글로 시작하기</span>
      </Button>
    </div>
  );
};

export default SnsLoginButtons;
