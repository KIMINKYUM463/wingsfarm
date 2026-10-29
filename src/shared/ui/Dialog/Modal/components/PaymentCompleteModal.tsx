'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/shared/ui/Button/Button';
import { ROUTES } from '@/shared/constants/routes';
import ModalContent from '../ModalContent';
import type { ModalComponentProps } from '../types';

/** 결제 정보 행 */
interface PaymentDetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

const PaymentDetailRow = ({ label, value, highlight }: PaymentDetailRowProps) => (
  <div className="flex items-center justify-between">
    <span className="p text-gray-400">{label}</span>
    <span className={highlight ? 'p-bold text-(--color-point)' : 'p text-gray-900'}>{value}</span>
  </div>
);

/** 결제 완료 모달 */
const PaymentCompleteModal = ({ data, onClose }: ModalComponentProps) => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const productName = (data?.productName as string) ?? '';
  const amount = (data?.amount as string) ?? '';
  const paymentDate = (data?.paymentDate as string) ?? '';
  const paymentMethod = (data?.paymentMethod as string) ?? '';
  const email = (data?.email as string) ?? '';

  const handleGoToProjects = () => {
    setIsNavigating(true);
    onClose();
    router.push(ROUTES.PROJECTS);
  };

  return (
    <ModalContent
      onClose={onClose}
      maxW="sm"
      className="rounded-2xl bg-white p-6 shadow-(--shadow-md)"
    >
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-center">
          <h3 className="h3-bold">결제가 완료되었습니다!</h3>
        </div>

        {/* 결제 정보 섹션 */}
        <div className="flex flex-col gap-3">
          <h4 className="title-1-bold">결제 정보</h4>
          <div className="h-px w-full bg-gray-900" />

          <div className="flex flex-col gap-4">
            <PaymentDetailRow label="상품" value={productName} />
            <PaymentDetailRow label="결제금액" value={amount} highlight />
            <PaymentDetailRow label="결제일시" value={paymentDate} />
            <PaymentDetailRow label="결제수단" value={paymentMethod} />
            <PaymentDetailRow label="이메일" value={email} />
          </div>
        </div>

        <Button onClick={handleGoToProjects} isLoading={isNavigating} className="btn-primary w-full">
          <span className="p">내 프로젝트로 가기</span>
        </Button>
      </div>
    </ModalContent>
  );
};

export default PaymentCompleteModal;
