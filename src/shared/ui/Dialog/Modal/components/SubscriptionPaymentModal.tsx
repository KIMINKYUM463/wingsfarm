'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/shared/ui/Button/Button';
import { useDialog } from '../../useDialog';
import { useCreateSubscription } from '@/features/subscription/hooks';
import ModalContent from '../ModalContent';
import type { ModalComponentProps } from '../types';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/shared/constants/routes';

interface PaymentInfoRowProps {
  label: string;
  value: string;
}

const PaymentInfoRow = ({ label, value }: PaymentInfoRowProps) => (
  <div className="flex flex-col gap-1">
    <p className="description text-gray-400">{label}</p>
    <p className="title-1-medium">{value}</p>
  </div>
);

const Divider = () => <div className="h-px w-full bg-gray-100" />;

/** 다음 달 날짜 반환 */
const getNextMonth = (date: Date): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
};

/** 결제 완료 시각 포맷 (yyyy년 M월 d일 HH:mm:ss) */
const formatPaymentDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
};

/** 구독권 결제 모달 */
const SubscriptionPaymentModal = ({ data, onClose }: ModalComponentProps) => {
  const router = useRouter();
  const { openModal, openAlert, setPreventClose } = useDialog();

  const planId = (data?.planId as string) ?? '';
  const planName = (data?.planName as string) ?? 'pro 플랜';
  const price = (data?.price as string) ?? '19,000원/월';
  const paymentDate = (data?.paymentDate as string) ?? formatDate(new Date());
  const nextPaymentDate = (data?.nextPaymentDate as string) ?? formatDate(getNextMonth(new Date()));
  const email = (data?.email as string) ?? '';
  const title = (data?.title as string) ?? '결제 완료하기';
  const buttonText = (data?.buttonText as string) ?? '결제하기';
  const isTrial = (data?.isTrial as boolean) ?? false;

  const { mutate: createSubscription, isPending } = useCreateSubscription({
    onSuccess: (billingKey) => {
      onClose();

      if (isTrial) {
        // 첫 구독(무료체험): Alert 표시
        openAlert({
          title: '무료체험이 시작되었습니다!',
          description: `오늘부터 1개월간 무료 체험이 시작됩니다.\n(다음 결제일: ${nextPaymentDate})`,
          confirmText: '내 프로젝트로 가기',
        }).then(() => {
          router.push(ROUTES.PROJECTS);
        });
      } else {
        // 일반 구독: 결제 완료 모달 표시
        openModal('paymentComplete', {
          productName: planName,
          amount: price,
          paymentDate: formatPaymentDateTime(new Date()),
          paymentMethod: `${billingKey.cardName} **** **** **** ${billingKey.cardNumberLast4}`,
          email,
        });
      }

      router.refresh();
    },
    onNoBillingKey: () => {
      // effect 실행 전에 onClose가 호출되므로 명시적으로 preventClose 해제
      setPreventClose(false);
      onClose();
    },
  });

  // 로딩 중 모달 닫기 방지 (언마운트 시 리셋)
  useEffect(() => {
    setPreventClose(isPending);
    return () => setPreventClose(false);
  }, [isPending, setPreventClose]);

  const handlePayment = () => {
    if (!planId) return;
    createSubscription({ planId, billingCycle: 'monthly' });
  };

  return (
    <ModalContent
      onClose={onClose}
      maxW="sm"
      className="rounded-xl bg-white p-6 shadow-(--shadow-md)"
    >
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-center">
          <h3 className="h3-bold">{title}</h3>
        </div>

        {/* 결제 정보 */}
        <div className="flex flex-col gap-3">
          <PaymentInfoRow label="상품" value={planName} />
          <Divider />
          <PaymentInfoRow label="결제금액" value={price} />
          <Divider />
          <PaymentInfoRow label="결제일" value={paymentDate} />
          <Divider />
          <PaymentInfoRow label="다음 결제일" value={nextPaymentDate} />
          <Divider />
          <PaymentInfoRow label="청구 이메일 주소" value={email} />
        </div>

        <Button onClick={handlePayment} isLoading={isPending} className="btn-primary w-full">
          <span className="p">{buttonText}</span>
        </Button>
      </div>
    </ModalContent>
  );
};

export default SubscriptionPaymentModal;
