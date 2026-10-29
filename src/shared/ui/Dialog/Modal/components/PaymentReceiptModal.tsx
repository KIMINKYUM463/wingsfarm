'use client';

import Button from '@/shared/ui/Button/Button';
import ModalContent from '../ModalContent';
import type { ModalComponentProps } from '../types';
import type { PaymentHistoryItem } from '@/shared/types/subscription.types';

/** 결제 상태 한글 변환 */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  paid: '결제완료',
  failed: '결제실패',
  cancelled: '취소됨',
};

/** 결제일시 포맷 (yyyy년 M월 d일 HH:mm:ss) */
function formatReceiptDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
}

/** 금액 포맷 */
function formatAmount(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

/** 결제 정보 행 */
interface PaymentDetailRowProps {
  label: string;
  value: string;
  bold?: boolean;
}

const PaymentDetailRow = ({ label, value, bold }: PaymentDetailRowProps) => (
  <div className="flex items-center justify-between">
    <span className="p text-gray-400">{label}</span>
    <span className={bold ? 'p-bold text-gray-900' : 'p text-gray-900'}>{value}</span>
  </div>
);

/** 결제 청구서 모달 */
const PaymentReceiptModal = ({ data, onClose }: ModalComponentProps) => {
  const { paymentId, paidAt, paymentMethod, status, customerEmail, amount, receiptUrl } = (data ??
    {}) as Partial<PaymentHistoryItem>;

  const handleDownloadReceipt = () => {
    if (!receiptUrl) return;
    window.open(receiptUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <ModalContent
      onClose={onClose}
      maxW="sm"
      className="rounded-2xl bg-white p-6 shadow-(--shadow-md)"
    >
      <div className="flex flex-col gap-8">
        {/* 헤더 */}
        <div className="flex items-center justify-center">
          <h3 className="h2-bold">결제 청구서</h3>
        </div>

        <div className="flex flex-col gap-4">
          {/* 결제 정보 */}
          <div className="flex flex-col gap-3">
            <h4 className="title-1-bold">결제 정보</h4>
            <div className="h-px w-full" />
            <div className="flex flex-col gap-3">
              <PaymentDetailRow label="청구번호" value={paymentId ?? '-'} />
              <PaymentDetailRow label="결제일시" value={paidAt ? formatReceiptDate(paidAt) : '-'} />
              <PaymentDetailRow label="결제수단" value={paymentMethod ?? '-'} />
              <PaymentDetailRow
                label="결제상태"
                value={status ? (PAYMENT_STATUS_LABEL[status] ?? status) : '-'}
              />
            </div>
          </div>

          {/* 구매자 정보 */}
          <div className="flex flex-col gap-3">
            <h4 className="title-1-bold">구매자 정보</h4>
            <div className="h-px w-full" />
            <div className="flex flex-col gap-4">
              <PaymentDetailRow label="이메일" value={customerEmail ?? '-'} />
            </div>
          </div>

          {/* 상품 내역 */}
          <div className="flex flex-col gap-3">
            <h4 className="title-1-bold">상품 내역</h4>
            <div className="h-px w-full" />
            <div className="flex flex-col gap-4">
              <PaymentDetailRow
                label="결제금액"
                value={amount != null ? formatAmount(amount) : '-'}
                bold
              />
            </div>
          </div>

          {/* 영수증 다운로드 버튼 */}
          <Button
            onClick={handleDownloadReceipt}
            disabled={!receiptUrl}
            className="btn-primary mt-2 w-full"
          >
            <span className="p">영수증 다운로드</span>
          </Button>
        </div>
      </div>
    </ModalContent>
  );
};

export default PaymentReceiptModal;
