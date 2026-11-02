'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants/routes';
import IconButton from './Button/IconButton';

interface StartButtonProps {
  variant?: 'header' | 'cta';
}

/**
 * 랜딩 페이지 "시작하기" 버튼
 *
 * 클릭하면 상세페이지 프로젝트 목록으로 이동한다.
 */
const StartButton = ({ variant = 'cta' }: StartButtonProps) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(ROUTES.PROJECTS);
  };

  // 기존 이메일 모달 방식 (waitlist)
  // const { openModal } = useDialog();
  // const handleClick = () => {
  //   openModal('email');
  // };

  if (variant === 'header') {
    return (
      <IconButton
        onClick={handleClick}
        icon="arrow_outward"
        textClassName="p-reg"
        text="시작하기"
        className="btn-primary hidden sm:flex"
      />
    );
  }

  return (
    <IconButton
      onClick={handleClick}
      icon="arrow_forward"
      textClassName="p-reg"
      text="지금 시작하기"
      iconPosition="right"
      className="btn-white mt-6.5"
    />
  );
};

export default StartButton;
